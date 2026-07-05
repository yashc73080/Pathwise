from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Dict, List, Optional
from uuid import uuid4

from firebase_admin import firestore

from models import Trip


class TripRepository(ABC):
    @abstractmethod
    def create(self, trip: Trip) -> Trip:
        pass

    @abstractmethod
    def get(self, trip_id: str) -> Optional[Trip]:
        pass

    @abstractmethod
    def update(self, trip: Trip) -> Trip:
        pass

    @abstractmethod
    def delete(self, trip_id: str) -> None:
        pass

    @abstractmethod
    def list_for_owner(self, owner_id: str) -> List[Trip]:
        pass

    @abstractmethod
    def get_claim_token(self, trip_id: str) -> Optional[str]:
        pass


class InMemoryTripRepository(TripRepository):
    def __init__(self):
        self._trips: Dict[str, Dict] = {}
        self._claim_tokens: Dict[str, str] = {}

    def create(self, trip: Trip) -> Trip:
        trip.id = trip.id or uuid4().hex
        now = datetime.now(timezone.utc).isoformat()
        trip.createdAt = trip.createdAt or now
        trip.updatedAt = now
        self._trips[trip.id] = self._store_claim_token(trip)
        return Trip.from_dict(self._trips[trip.id], trip.id)

    def get(self, trip_id: str) -> Optional[Trip]:
        data = self._trips.get(trip_id)
        return Trip.from_dict(data, trip_id) if data else None

    def update(self, trip: Trip) -> Trip:
        if not trip.id or trip.id not in self._trips:
            raise KeyError("Trip not found")
        trip.updatedAt = datetime.now(timezone.utc).isoformat()
        self._trips[trip.id] = self._store_claim_token(trip)
        return Trip.from_dict(self._trips[trip.id], trip.id)

    def delete(self, trip_id: str) -> None:
        self._trips.pop(trip_id, None)
        self._claim_tokens.pop(trip_id, None)

    def get_claim_token(self, trip_id: str) -> Optional[str]:
        return self._claim_tokens.get(trip_id)

    def _store_claim_token(self, trip: Trip) -> Dict:
        # The claim token is a write capability, so it lives outside the trip
        # document that link-visibility clients are allowed to read.
        data = trip.to_dict()
        token = data.pop("claimToken", None)
        if token:
            self._claim_tokens[trip.id] = token
        return data

    def list_for_owner(self, owner_id: str) -> List[Trip]:
        trips = [
            Trip.from_dict(data, trip_id)
            for trip_id, data in self._trips.items()
            if data.get("ownerId") == owner_id
        ]
        return sorted(trips, key=lambda trip: str(trip.updatedAt or ""), reverse=True)


class FirestoreTripRepository(TripRepository):
    def __init__(self, db):
        self.db = db
        self.collection = db.collection("trips")
        # Claim tokens are write capabilities. They live in a collection the
        # security rules never expose, because rules cannot hide individual
        # fields on the readable trips documents.
        self.claims = db.collection("trip_claims")

    def create(self, trip: Trip) -> Trip:
        data = trip.to_dict()
        token = data.pop("claimToken", None)
        data["createdAt"] = data.get("createdAt") or firestore.SERVER_TIMESTAMP
        data["updatedAt"] = firestore.SERVER_TIMESTAMP
        if trip.id:
            doc_ref = self.collection.document(trip.id)
        else:
            doc_ref = self.collection.document()
        doc_ref.set(data)
        if token:
            self.claims.document(doc_ref.id).set({"claimToken": token})
        return self.get(doc_ref.id)

    def get(self, trip_id: str) -> Optional[Trip]:
        doc = self.collection.document(trip_id).get()
        if not doc.exists:
            return None
        return Trip.from_dict(doc.to_dict(), doc.id)

    def update(self, trip: Trip) -> Trip:
        if not trip.id:
            raise ValueError("Trip id is required")
        data = trip.to_dict()
        token = data.pop("claimToken", None)
        data["updatedAt"] = firestore.SERVER_TIMESTAMP
        self.collection.document(trip.id).set(data, merge=False)
        if token:
            self.claims.document(trip.id).set({"claimToken": token})
        return self.get(trip.id)

    def delete(self, trip_id: str) -> None:
        self.collection.document(trip_id).delete()
        self.claims.document(trip_id).delete()

    def get_claim_token(self, trip_id: str) -> Optional[str]:
        doc = self.claims.document(trip_id).get()
        if not doc.exists:
            return None
        return (doc.to_dict() or {}).get("claimToken")

    def list_for_owner(self, owner_id: str) -> List[Trip]:
        docs = self.collection.where("ownerId", "==", owner_id).stream()
        trips = [Trip.from_dict(doc.to_dict(), doc.id) for doc in docs]
        return sorted(trips, key=lambda trip: str(trip.updatedAt or ""), reverse=True)
