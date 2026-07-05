import os
import sys
import types
import unittest

os.environ.setdefault("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-key")
sys.modules.setdefault(
    "googlemaps",
    types.SimpleNamespace(Client=lambda key: None),
)
sys.modules.setdefault(
    "firebase_admin",
    types.SimpleNamespace(
        firestore=types.SimpleNamespace(
            SERVER_TIMESTAMP="SERVER_TIMESTAMP",
            Query=types.SimpleNamespace(DESCENDING="DESCENDING"),
        )
    ),
)

from models import legacy_trip_to_v2
from services.trip_repository import InMemoryTripRepository
from services.trip_service import AuthorizationError, TripService


class Phase0TripServiceTest(unittest.TestCase):
    def test_legacy_trip_to_v2_converts_indices_to_stable_stop_ids(self):
        trip = legacy_trip_to_v2(
            {
                "name": "NYC Day",
                "userId": "user_123",
                "locations": [
                    {"name": "A", "lat": 40.0, "lng": -73.0},
                    {"name": "B", "lat": 41.0, "lng": -74.0},
                    {"name": "C", "lat": 42.0, "lng": -75.0},
                ],
                "optimizedRoute": [2, 0, 1],
                "startIndex": 2,
                "endIndex": 1,
            },
            legacy_id="legacy_abc",
        )

        day = trip.days[0]
        stop_ids = [stop.id for stop in day.stops]

        self.assertEqual(trip.schemaVersion, 2)
        self.assertEqual(trip.ownerId, "user_123")
        self.assertEqual(trip.legacyId, "legacy_abc")
        self.assertEqual(day.route.order, [stop_ids[2], stop_ids[0], stop_ids[1]])
        self.assertEqual(day.route.startStopId, stop_ids[2])
        self.assertEqual(day.route.endStopId, stop_ids[1])

    def test_trip_service_creates_anonymous_claimable_trip_and_claims_it(self):
        service = TripService(InMemoryTripRepository())
        trip = service.create_trip(owner_id=None, title="Weekend", created_by="mcp")

        self.assertTrue(trip.claimToken)
        self.assertEqual(trip.visibility, "link")
        self.assertEqual(trip.createdBy, "mcp")

        with self.assertRaises(AuthorizationError):
            service.update_trip(trip.id, {"title": "Nope"})

        claimed = service.claim_trip(trip.id, trip.claimToken, uid="user_123")

        self.assertEqual(claimed.ownerId, "user_123")
        self.assertEqual(claimed.visibility, "private")
        self.assertEqual(service.get_trip(trip.id, uid="user_123").title, "Weekend")

    def test_trip_service_adds_and_reorders_stops(self):
        service = TripService(InMemoryTripRepository())
        trip = service.create_trip(owner_id="user_123", title="Day Out")
        day_id = trip.days[0].id

        first = service.add_stop(trip.id, day_id, {"name": "First", "lat": 1, "lng": 1}, uid="user_123")
        second = service.add_stop(trip.id, day_id, {"name": "Second", "lat": 2, "lng": 2}, uid="user_123")
        day = service.reorder_stops(trip.id, day_id, [second.id, first.id], uid="user_123")

        self.assertEqual([stop.id for stop in day.stops], [second.id, first.id])
        self.assertEqual(day.route.order, [second.id, first.id])


if __name__ == "__main__":
    unittest.main()
