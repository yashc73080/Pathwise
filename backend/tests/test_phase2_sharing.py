import os
import sys
import types
import unittest

os.environ.setdefault("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-key")
sys.modules.setdefault(
    "googlemaps",
    types.SimpleNamespace(Client=lambda key: None),
)
_firebase_stub = sys.modules.setdefault(
    "firebase_admin",
    types.SimpleNamespace(
        firestore=types.SimpleNamespace(
            SERVER_TIMESTAMP="SERVER_TIMESTAMP",
            Query=types.SimpleNamespace(DESCENDING="DESCENDING"),
        ),
    ),
)
# Other test files may have stubbed firebase_admin first; make sure the auth
# module used by backend/auth.py exists either way.
if not hasattr(_firebase_stub, "auth"):
    _firebase_stub.auth = types.SimpleNamespace(verify_id_token=lambda token: {"uid": token})

from flask import Flask

from routes.trips import create_trips_blueprint
from services.trip_repository import InMemoryTripRepository
from services.trip_service import TripService


def make_client():
    app = Flask(__name__)
    service = TripService(InMemoryTripRepository())
    app.register_blueprint(create_trips_blueprint(service))
    return app.test_client(), service


class Phase2SharingTest(unittest.TestCase):
    def test_anonymous_create_returns_claim_token_and_share_url_once(self):
        client, _ = make_client()
        response = client.post("/api/trips", json={"title": "SF Weekend"})
        payload = response.get_json()

        self.assertEqual(response.status_code, 201)
        self.assertTrue(payload["claimToken"])
        self.assertIn(f"/trip/?id={payload['trip']['id']}", payload["shareUrl"])
        self.assertIn(f"#claim={payload['claimToken']}", payload["shareUrl"])
        # The claim token must never ride along inside the trip document itself.
        self.assertNotIn("claimToken", payload["trip"])

    def test_get_by_link_visibility_never_exposes_claim_token(self):
        client, _ = make_client()
        created = client.post("/api/trips", json={"title": "SF Weekend"}).get_json()
        trip_id = created["trip"]["id"]

        fetched = client.get(f"/api/trips/{trip_id}").get_json()
        self.assertNotIn("claimToken", fetched["trip"])

    def test_claim_token_never_stored_on_readable_trip_document(self):
        # Firestore rules cannot hide fields, so the token must live outside
        # the trips document that link-visibility clients can read directly.
        client, service = make_client()
        created = client.post("/api/trips", json={"title": "SF Weekend"}).get_json()
        trip_id = created["trip"]["id"]

        stored_document = service.repository._trips[trip_id]
        self.assertNotIn("claimToken", stored_document)
        self.assertEqual(service.repository.get_claim_token(trip_id), created["claimToken"])

    def test_write_requires_claim_token_until_claimed(self):
        client, _ = make_client()
        created = client.post("/api/trips", json={"title": "SF Weekend"}).get_json()
        trip_id = created["trip"]["id"]
        token = created["claimToken"]

        denied = client.patch(f"/api/trips/{trip_id}", json={"title": "Hijacked"})
        self.assertEqual(denied.status_code, 403)

        allowed = client.patch(
            f"/api/trips/{trip_id}",
            json={"title": "Renamed"},
            headers={"X-Claim-Token": token},
        )
        self.assertEqual(allowed.status_code, 200)
        self.assertEqual(allowed.get_json()["trip"]["title"], "Renamed")

    def test_claim_transfers_ownership_and_locks_out_link_readers(self):
        client, _ = make_client()
        created = client.post("/api/trips", json={"title": "SF Weekend"}).get_json()
        trip_id = created["trip"]["id"]
        token = created["claimToken"]

        claimed = client.post(
            f"/api/trips/{trip_id}/claim",
            json={"claimToken": token},
            headers={"Authorization": "Bearer user_123"},
        )
        self.assertEqual(claimed.status_code, 200)
        self.assertEqual(claimed.get_json()["trip"]["ownerId"], "user_123")
        self.assertEqual(claimed.get_json()["trip"]["visibility"], "private")

        anonymous_read = client.get(f"/api/trips/{trip_id}")
        self.assertEqual(anonymous_read.status_code, 403)

        owner_read = client.get(
            f"/api/trips/{trip_id}", headers={"Authorization": "Bearer user_123"}
        )
        self.assertEqual(owner_read.status_code, 200)


if __name__ == "__main__":
    unittest.main()
