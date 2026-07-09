import googlemaps
import itertools
import networkx as nx
from dotenv import load_dotenv
import os
from typing import Callable, Dict, List, Optional, Tuple

# Load environment variables from backend/.env.local
env_path = os.path.join(os.path.dirname(__file__), '.env.local')
load_dotenv(env_path)

# Initialize the Google Maps client with your API key
GOOGLE_MAPS_API_KEY = os.getenv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY')
if not GOOGLE_MAPS_API_KEY:
    raise ValueError("Google Maps API key not found in .env.local file")

gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY)

DistanceFn = Callable[[dict, dict], float]


def _location_key(location: dict) -> Tuple[float, float]:
    return (round(float(location["lat"]), 6), round(float(location["lng"]), 6))


def get_travel_distance(origin, destination, gmaps_client=None):
    """Get the driving distance between two locations."""
    try:
        client = gmaps_client or gmaps
        result = client.distance_matrix(
            origins=(f"{origin['lat']},{origin['lng']}"),
            destinations=(f"{destination['lat']},{destination['lng']}"),
            mode="driving"
        )
        
        if result['rows'][0]['elements'][0]['status'] == 'OK':
            distance = result['rows'][0]['elements'][0]['distance']['value']
            return distance * 0.000621371  # Convert meters to miles
        else:
            print(f"Error getting distance between {origin} and {destination}")
            return float('inf')
    except Exception as e:
        print(f"Error in get_travel_distance: {str(e)}")
        return float('inf')


def build_distance_lookup(locations: List[dict], gmaps_client=None) -> Dict[Tuple[int, int], float]:
    """
    Build a pairwise driving-distance lookup with batched Distance Matrix calls.

    Google caps Distance Matrix requests at 25 origins, 25 destinations, and
    100 elements. Using 10x10 chunks stays inside all three limits and replaces
    the previous N^2/2 one-request-per-pair behavior.
    """
    lookup: Dict[Tuple[int, int], float] = {}
    client = gmaps_client or gmaps
    chunk_size = 10

    for origin_start in range(0, len(locations), chunk_size):
        origin_indices = list(range(origin_start, min(origin_start + chunk_size, len(locations))))
        origins = [f"{locations[i]['lat']},{locations[i]['lng']}" for i in origin_indices]

        for dest_start in range(0, len(locations), chunk_size):
            dest_indices = list(range(dest_start, min(dest_start + chunk_size, len(locations))))
            destinations = [f"{locations[i]['lat']},{locations[i]['lng']}" for i in dest_indices]

            try:
                result = client.distance_matrix(
                    origins=origins,
                    destinations=destinations,
                    mode="driving",
                )
            except Exception as e:
                print(f"Error in batched distance_matrix: {str(e)}")
                for i in origin_indices:
                    for j in dest_indices:
                        lookup[(i, j)] = float("inf")
                continue

            rows = result.get("rows", [])
            for row_offset, row in enumerate(rows):
                i = origin_indices[row_offset]
                for col_offset, element in enumerate(row.get("elements", [])):
                    j = dest_indices[col_offset]
                    if i == j:
                        lookup[(i, j)] = 0
                    elif element.get("status") == "OK":
                        lookup[(i, j)] = element.get("distance", {}).get("value", float("inf")) * 0.000621371
                    else:
                        lookup[(i, j)] = float("inf")

    return lookup


def make_cached_distance_fn(locations: List[dict], gmaps_client=None) -> DistanceFn:
    lookup = build_distance_lookup(locations, gmaps_client=gmaps_client)
    index_by_key = {_location_key(location): index for index, location in enumerate(locations)}
    pair_cache: Dict[Tuple[int, int], float] = {}

    def distance(origin: dict, destination: dict) -> float:
        i = index_by_key[_location_key(origin)]
        j = index_by_key[_location_key(destination)]
        key = tuple(sorted((i, j)))
        if key not in pair_cache:
            pair_cache[key] = lookup.get((i, j), lookup.get((j, i), float("inf")))
        return pair_cache[key]

    return distance


# Trips up to this size are solved exactly with Held-Karp instead of a heuristic.
# 13 stops => at most 2^12 * 12 * 12 DP transitions, well under a second.
EXACT_SOLVE_MAX_STOPS = 13


def build_graph(locations, distance_fn: Optional[DistanceFn] = None):
    """Build a complete graph with distances between all location pairs."""
    G = nx.Graph()
    distance = distance_fn or make_cached_distance_fn(locations)

    for i in range(len(locations)):
        for j in range(i + 1, len(locations)):
            G.add_edge(i, j, weight=distance(locations[i], locations[j]))

    return G


def _build_distance_matrix(locations, distance_fn: DistanceFn) -> List[List[float]]:
    n = len(locations)
    dist = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            d = distance_fn(locations[i], locations[j])
            dist[i][j] = d
            dist[j][i] = d
    return dist


def _held_karp(dist: List[List[float]], start: int, end: int) -> List[int]:
    """
    Exact minimum Hamiltonian path from start to end via Held-Karp DP.
    Pass end == start to solve the cycle variant; the returned order then
    starts and finishes at start.
    """
    n = len(dist)
    others = [i for i in range(n) if i != start and i != end]
    m = len(others)
    if m == 0:
        return [start, end]

    inf = float("inf")
    size = 1 << m
    dp = [[inf] * m for _ in range(size)]
    parent = [[-1] * m for _ in range(size)]
    for k in range(m):
        dp[1 << k][k] = dist[start][others[k]]

    for mask in range(size):
        row = dp[mask]
        for k in range(m):
            cost = row[k]
            if cost == inf:
                continue
            base = dist[others[k]]
            for nxt in range(m):
                if (mask >> nxt) & 1:
                    continue
                nmask = mask | (1 << nxt)
                cand = cost + base[others[nxt]]
                if cand < dp[nmask][nxt]:
                    dp[nmask][nxt] = cand
                    parent[nmask][nxt] = k

    full = size - 1
    best_k = min(range(m), key=lambda k: dp[full][k] + dist[others[k]][end])

    order = []
    mask, k = full, best_k
    while k != -1:
        order.append(others[k])
        prev = parent[mask][k]
        mask ^= 1 << k
        k = prev
    order.reverse()
    return [start] + order + [end]


def _two_opt_pass(order: List[int], dist: List[List[float]]) -> bool:
    """One sweep of 2-opt segment reversals; endpoints stay fixed."""
    improved = False
    for i in range(1, len(order) - 2):
        for j in range(i + 1, len(order) - 1):
            a, b = order[i - 1], order[i]
            c, d = order[j], order[j + 1]
            delta = dist[a][c] + dist[b][d] - dist[a][b] - dist[c][d]
            if delta < -1e-9:
                order[i:j + 1] = order[i:j + 1][::-1]
                improved = True
    return improved


def _or_opt_pass(order: List[int], dist: List[List[float]]) -> bool:
    """One sweep of Or-opt: relocate segments of 1-3 stops; endpoints stay fixed."""
    improved = False
    for seg_len in (1, 2, 3):
        i = 1
        while i + seg_len <= len(order) - 1:
            seg = order[i:i + seg_len]
            before, after = order[i - 1], order[i + seg_len]
            removal_gain = (
                dist[before][seg[0]] + dist[seg[-1]][after] - dist[before][after]
            )
            if removal_gain <= 1e-9:
                i += 1
                continue

            rest = order[:i] + order[i + seg_len:]
            best_pos, best_delta = None, 1e-9
            for pos in range(1, len(rest)):
                u, v = rest[pos - 1], rest[pos]
                insert_cost = dist[u][seg[0]] + dist[seg[-1]][v] - dist[u][v]
                delta = removal_gain - insert_cost
                if delta > best_delta:
                    best_delta = delta
                    best_pos = pos
            if best_pos is not None:
                order[:] = rest[:best_pos] + seg + rest[best_pos:]
                improved = True
                i = 1
            else:
                i += 1
    return improved


def _local_search(order: List[int], dist: List[List[float]]) -> List[int]:
    """Run 2-opt and Or-opt to convergence on an order with fixed endpoints."""
    while True:
        improved = _two_opt_pass(order, dist)
        improved = _or_opt_pass(order, dist) or improved
        if not improved:
            return order


def find_minimum_weight_perfect_matching(G, odd_degree_vertices):
    """Find a minimum weight perfect matching for the given vertices."""
    H = nx.Graph()
    for u, v in itertools.combinations(odd_degree_vertices, 2):
        weight = nx.shortest_path_length(G, u, v, weight='weight')
        H.add_edge(u, v, weight=weight)
    
    matching = nx.min_weight_matching(H)
    return matching

def tsp(locations, start_index=0, end_index=None, distance_fn: Optional[DistanceFn] = None, gmaps_client=None):
    """
    Implementation of Christofides algorithm for TSP.
    
    Args:
        locations: List of dictionaries containing location data with 'lat' and 'lng'
        start_index: Index of the starting location
        end_index: Optional index of the ending location (if None, creates a cycle)
    
    Returns:
        List of locations in optimized order
    """
    if len(locations) < 2:
        return locations
    
    if len(locations) == 2:
        return locations if start_index == 0 else [locations[1], locations[0]]
    
    # Validate indices
    if start_index < 0 or start_index >= len(locations):
        start_index = 0
    if end_index is not None:
        if end_index < 0 or end_index >= len(locations):
            end_index = None
        elif end_index == start_index:
            # If start and end are the same, treat as cycle
            end_index = None
    
    distance = distance_fn or make_cached_distance_fn(locations, gmaps_client=gmaps_client)
    dist = _build_distance_matrix(locations, distance)
    is_cycle = end_index is None

    # Small trips get the true optimum; cycles are the end == start case.
    if len(locations) <= EXACT_SOLVE_MAX_STOPS:
        order = _held_karp(dist, start_index, start_index if is_cycle else end_index)
        return [locations[i] for i in order]

    if is_cycle:
        order = _christofides_cycle(dist, start_index)
    else:
        order = _nearest_neighbor_path(dist, start_index, end_index)
    order = _local_search(order, dist)
    return [locations[i] for i in order]


def _christofides_cycle(dist: List[List[float]], start_index: int) -> List[int]:
    """Christofides construction; returns a cycle order with start_index repeated last."""
    G = nx.Graph()
    n = len(dist)
    for i in range(n):
        for j in range(i + 1, n):
            G.add_edge(i, j, weight=dist[i][j])

    # Find minimum spanning tree
    T = nx.minimum_spanning_tree(G, weight='weight')

    # Find vertices with odd degree
    odd_degree_vertices = [v for v, d in T.degree() if d % 2 == 1]

    # Find minimum weight perfect matching of odd degree vertices
    if odd_degree_vertices:
        M = find_minimum_weight_perfect_matching(G, odd_degree_vertices)

        # Combine MST and matching to create multigraph
        H = nx.MultiGraph(T)
        H.add_edges_from(M)
    else:
        H = nx.MultiGraph(T)

    # Find Eulerian circuit
    try:
        euler_circuit = list(nx.eulerian_circuit(H, source=start_index))
    except nx.NetworkXError:
        euler_circuit = list(nx.eulerian_circuit(nx.eulerize(H), source=start_index))

    # Convert Eulerian circuit to Hamiltonian path
    visited = set()
    hamiltonian_path = []

    for u, v in euler_circuit:
        if u not in visited:
            hamiltonian_path.append(u)
            visited.add(u)

    # Add the last vertex if not included
    if euler_circuit:
        last_v = euler_circuit[-1][1]
        if last_v not in visited:
            hamiltonian_path.append(last_v)

    # Ensure we start with start_index (rotate the cycle)
    if hamiltonian_path and hamiltonian_path[0] != start_index:
        if start_index in hamiltonian_path:
            start_pos = hamiltonian_path.index(start_index)
            hamiltonian_path = hamiltonian_path[start_pos:] + hamiltonian_path[:start_pos]

    # Complete the cycle
    if hamiltonian_path and hamiltonian_path[-1] != start_index:
        hamiltonian_path.append(start_index)

    return hamiltonian_path


def route_total_distance(route, distance_fn: Optional[DistanceFn] = None, gmaps_client=None):
    if len(route) < 2:
        return 0
    distance = distance_fn or make_cached_distance_fn(route, gmaps_client=gmaps_client)
    return sum(distance(route[i], route[i + 1]) for i in range(len(route) - 1))


def _nearest_neighbor_path(dist: List[List[float]], start_index: int, end_index: int) -> List[int]:
    """Greedy nearest-neighbor construction for a fixed start and end; the
    caller is expected to clean it up with _local_search."""
    unvisited = set(range(len(dist)))
    unvisited.remove(start_index)
    unvisited.remove(end_index)

    path = [start_index]
    current = start_index
    while unvisited:
        nearest = min(unvisited, key=lambda node: dist[current][node])
        path.append(nearest)
        unvisited.remove(nearest)
        current = nearest

    path.append(end_index)
    return path

if __name__ == '__main__':
    # Example usage
    test_locations = [
        {"name": "Location 1", "lat": 40.712776, "lng": -74.005974},
        {"name": "Location 2", "lat": 34.052235, "lng": -118.243683},
        {"name": "Location 3", "lat": 41.878114, "lng": -87.629798},
    ]
    
    route = tsp(test_locations)
    print("Optimized route:", route)
