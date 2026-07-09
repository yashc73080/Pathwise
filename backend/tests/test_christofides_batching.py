import os
import sys
import types
import unittest

os.environ.setdefault("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-key")
sys.modules.setdefault(
    "googlemaps",
    types.SimpleNamespace(Client=lambda key: None),
)

from christofides import build_distance_lookup, tsp


class FakeMapsClient:
    def __init__(self):
        self.calls = []

    def distance_matrix(self, origins, destinations, mode):
        self.calls.append((origins, destinations, mode))
        return {
            "rows": [
                {
                    "elements": [
                        {"status": "OK", "distance": {"value": (origin_index + 1) * (dest_index + 1) * 1000}}
                        for dest_index, _ in enumerate(destinations)
                    ]
                }
                for origin_index, _ in enumerate(origins)
            ]
        }


class ChristofidesBatchingTest(unittest.TestCase):
    def test_distance_lookup_batches_matrix_requests(self):
        locations = [{"name": f"Stop {i}", "lat": i, "lng": -i} for i in range(12)]
        client = FakeMapsClient()

        lookup = build_distance_lookup(locations, gmaps_client=client)

        self.assertEqual(len(client.calls), 4)
        self.assertGreater(lookup[(0, 1)], 0)
        for origins, destinations, mode in client.calls:
            self.assertEqual(mode, "driving")
            self.assertLessEqual(len(origins), 25)
            self.assertLessEqual(len(destinations), 25)
            self.assertLessEqual(len(origins) * len(destinations), 100)

    def test_tsp_accepts_injected_distance_function(self):
        locations = [
            {"name": "A", "lat": 0, "lng": 0},
            {"name": "B", "lat": 1, "lng": 0},
            {"name": "C", "lat": 2, "lng": 0},
        ]

        def distance(origin, destination):
            return abs(origin["lat"] - destination["lat"])

        route = tsp(locations, start_index=0, end_index=2, distance_fn=distance)

        self.assertEqual(route[0]["name"], "A")
        self.assertEqual(route[-1]["name"], "C")

    def test_tsp_finds_optimal_order_where_greedy_fails(self):
        # Points on a line: start=0, X=1, Y=-3, end=10. Greedy nearest-neighbor
        # from start grabs X first (0->1->-3->10 = 18); the optimum backtracks
        # to Y first (0->-3->1->10 = 16).
        locations = [
            {"name": "start", "lat": 0.0, "lng": 0.0},
            {"name": "X", "lat": 1.0, "lng": 0.0},
            {"name": "Y", "lat": -3.0, "lng": 0.0},
            {"name": "end", "lat": 10.0, "lng": 0.0},
        ]

        def distance(origin, destination):
            return abs(origin["lat"] - destination["lat"])

        route = tsp(locations, start_index=0, end_index=3, distance_fn=distance)
        total = sum(distance(route[i], route[i + 1]) for i in range(len(route) - 1))

        self.assertEqual([stop["name"] for stop in route], ["start", "Y", "X", "end"])
        self.assertAlmostEqual(total, 16.0)


if __name__ == "__main__":
    unittest.main()
