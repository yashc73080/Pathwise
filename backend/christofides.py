import googlemaps
import itertools
import networkx as nx
from dotenv import load_dotenv
import os

# Load environment variables from backend/.env.local
env_path = os.path.join(os.path.dirname(__file__), '.env.local')
load_dotenv(env_path)

# Initialize the Google Maps client with your API key
GOOGLE_MAPS_API_KEY = os.getenv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY')
if not GOOGLE_MAPS_API_KEY:
    raise ValueError("Google Maps API key not found in .env.local file")

gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY)

def get_travel_distance(origin, destination):
    """Get the driving distance between two locations."""
    try:
        result = gmaps.distance_matrix(
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

def build_graph(locations):
    """Build a complete graph with distances between all location pairs."""
    G = nx.Graph()
    
    for i in range(len(locations)):
        for j in range(i + 1, len(locations)):
            distance = get_travel_distance(locations[i], locations[j])
            G.add_edge(i, j, weight=distance)
    
    return G

def find_minimum_weight_perfect_matching(G, odd_degree_vertices):
    """Find a minimum weight perfect matching for the given vertices."""
    H = nx.Graph()
    for u, v in itertools.combinations(odd_degree_vertices, 2):
        weight = nx.shortest_path_length(G, u, v, weight='weight')
        H.add_edge(u, v, weight=weight)
    
    matching = nx.min_weight_matching(H)
    return matching

def tsp(locations, start_index=0):
    """
    Implementation of Christofides algorithm for TSP.
    
    Args:
        locations: List of dictionaries containing location data with 'lat' and 'lng'
        start_index: Index of the starting location
    
    Returns:
        List of locations in optimized order
    """
    if len(locations) < 2:
        return locations
    
    # Build the complete graph
    G = build_graph(locations)
    
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
        # If no Eulerian circuit exists, fall back to a simple path
        euler_circuit = list(nx.edge_dfs(H, source=start_index))
    
    # Convert Eulerian circuit to Hamiltonian cycle
    visited = set()
    hamiltonian_path = []
    
    for u, v in euler_circuit:
        if u not in visited:
            hamiltonian_path.append(u)
            visited.add(u)
    
    # Ensure we start with the start_index
    if hamiltonian_path[0] != start_index:
        start_pos = hamiltonian_path.index(start_index)
        hamiltonian_path = hamiltonian_path[start_pos:] + hamiltonian_path[:start_pos]
    
    # Complete the cycle
    if hamiltonian_path[-1] != start_index:
        hamiltonian_path.append(start_index)
    
    # Convert indices back to locations
    optimized_route = [locations[i] for i in hamiltonian_path]
    return optimized_route

if __name__ == '__main__':
    # Example usage
    test_locations = [
        {"name": "Location 1", "lat": 40.712776, "lng": -74.005974},
        {"name": "Location 2", "lat": 34.052235, "lng": -118.243683},
        {"name": "Location 3", "lat": 41.878114, "lng": -87.629798},
    ]
    
    route = tsp(test_locations)
    print("Optimized route:", route)