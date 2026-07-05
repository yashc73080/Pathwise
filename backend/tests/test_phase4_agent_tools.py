import math
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
if not hasattr(_firebase_stub, "auth"):
    _firebase_stub.auth = types.SimpleNamespace(verify_id_token=lambda token: {"uid": token})

from agent import TripToolExecutor
from services.trip_repository import InMemoryTripRepository
from services.trip_service import TripService


class FakeGmapsClient:
    """Distance Matrix stub returning straight-line distances in meters."""

    def distance_matrix(self, origins, destinations, mode="driving"):
        def parse(coord):
            lat, lng = coord.split(",")
            return float(lat), float(lng)

        rows = []
        for origin in origins if isinstance(origins, list) else [origins]:
            o = parse(origin)
            elements = []
            for destination in destinations if isinstance(destinations, list) else [destinations]:
                d = parse(destination)
                meters = math.dist(o, d) * 111_000
                elements.append({"status": "OK", "distance": {"value": meters}})
            rows.append({"elements": elements})
        return {"rows": rows}

    def geocode(self, query):
        return [{
            "geometry": {"location": {"lat": 37.80, "lng": -122.41}},
            "formatted_address": f"{query}, San Francisco, CA",
            "place_id": "fake_place",
        }]


def make_executor():
    service = TripService(InMemoryTripRepository(), gmaps_client=FakeGmapsClient())
    trip = service.create_trip(owner_id="user_123", title="SF Trip", days=[
        {"stops": [
            {"name": "Golden Gate Bridge", "lat": 37.8199, "lng": -122.4783},
            {"name": "Ferry Building", "lat": 37.7955, "lng": -122.3937},
            {"name": "Palace of Fine Arts", "lat": 37.8029, "lng": -122.4484},
        ]},
        {"stops": []},
    ])
    return service, trip, TripToolExecutor(service, trip.id, uid="user_123")


class Phase4AgentToolsTest(unittest.TestCase):
    def test_add_stops_geocodes_missing_coordinates(self):
        service, trip, executor = make_executor()
        day2 = trip.days[1]
        outcome = executor.add_stops([{"name": "Coit Tower"}], day_id=day2.id)

        self.assertIn("Coit Tower", outcome)
        stored = service.get_trip(trip.id, uid="user_123")
        stop = stored.days[1].stops[0]
        self.assertEqual(stop.lat, 37.80)
        self.assertIsNotNone(stop.address)

    def test_move_and_remove_by_name(self):
        service, trip, executor = make_executor()
        day2_id = trip.days[1].id

        outcome = executor.move_stop(day2_id, stop_name="ferry building")
        self.assertIn("Moved Ferry Building", outcome)

        outcome = executor.remove_stop(stop_name="palace")
        self.assertIn("Removed Palace of Fine Arts", outcome)

        stored = service.get_trip(trip.id, uid="user_123")
        self.assertEqual([s.name for s in stored.days[0].stops], ["Golden Gate Bridge"])
        self.assertEqual([s.name for s in stored.days[1].stops], ["Ferry Building"])

    def test_optimize_day_returns_order_and_distance(self):
        service, trip, executor = make_executor()
        outcome = executor.optimize_day()

        self.assertIn("Optimized Day 1", outcome)
        self.assertIn("->", outcome)
        self.assertIn("miles total", outcome)
        stored = service.get_trip(trip.id, uid="user_123")
        self.assertEqual(len(stored.days[0].route.order), 3)

    def test_set_dates_and_create_day(self):
        service, trip, executor = make_executor()
        executor.set_dates(start_date="2026-08-01", end_date="2026-08-03")
        executor.create_day(date="2026-08-03")

        stored = service.get_trip(trip.id, uid="user_123")
        self.assertEqual(stored.startDate, "2026-08-01")
        self.assertEqual(len(stored.days), 3)

    def test_update_trip_days_patch_replaces_itinerary(self):
        service, trip, _ = make_executor()
        service.update_trip(trip.id, {"days": [
            {"stops": [{"name": "New Stop", "lat": 1.0, "lng": 2.0}]}
        ]}, uid="user_123")

        stored = service.get_trip(trip.id, uid="user_123")
        self.assertEqual(len(stored.days), 1)
        self.assertEqual(stored.days[0].stops[0].name, "New Stop")


if __name__ == "__main__":
    unittest.main()
