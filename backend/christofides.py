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

def tsp(locations, start_index=0, end_index=None):
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
    
    # Validate indices
    if start_index < 0 or start_index >= len(locations):
        start_index = 0
    if end_index is not None:
        if end_index < 0 or end_index >= len(locations):
            end_index = None
        elif end_index == start_index and len(locations) > 2:
            # If start and end are the same with more than 2 locations, treat as cycle
            end_index = None
    
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
    
    # Find Eulerian circuit/path
    try:
        if end_index is not None and end_index != start_index:
            # Try to find Eulerian path from start to end
            try:
                euler_path = list(nx.eulerian_path(H, source=start_index))
            except:
                euler_path = list(nx.edge_dfs(H, source=start_index))
            euler_edges = euler_path
        else:
            # Find Eulerian circuit for cycle
            try:
                euler_circuit = list(nx.eulerian_circuit(H, source=start_index))
                euler_edges = euler_circuit
            except nx.NetworkXError:
                euler_edges = list(nx.edge_dfs(H, source=start_index))
    except:
        euler_edges = list(nx.edge_dfs(H, source=start_index))
    
    # Convert Eulerian path/circuit to Hamiltonian path
    visited = set()
    hamiltonian_path = []
    
    for u, v in euler_edges:
        if u not in visited:
            hamiltonian_path.append(u)
            visited.add(u)
    
    # Add the last vertex if it's not already included
    if euler_edges:
        last_v = euler_edges[-1][1]
        if last_v not in visited:
            hamiltonian_path.append(last_v)
    
    # Ensure we start with start_index
    if hamiltonian_path and hamiltonian_path[0] != start_index:
        if start_index in hamiltonian_path:
            start_pos = hamiltonian_path.index(start_index)
            hamiltonian_path = hamiltonian_path[start_pos:] + hamiltonian_path[:start_pos]
    
    # Handle end_index for path TSP
    if end_index is not None and end_index != start_index and end_index in hamiltonian_path:
        # Remove end_index from its current position
        end_pos = hamiltonian_path.index(end_index)
        hamiltonian_path.remove(end_index)
        # Add it at the end
        hamiltonian_path.append(end_index)
        # If we removed it from the start, rotate
        if hamiltonian_path[0] != start_index and start_index in hamiltonian_path:
            start_pos = hamiltonian_path.index(start_index)
            hamiltonian_path = hamiltonian_path[start_pos:] + hamiltonian_path[:start_pos]
            # Re-add end_index at the end
            if end_index in hamiltonian_path:
                hamiltonian_path.remove(end_index)
            hamiltonian_path.append(end_index)
    elif end_index is None or end_index == start_index:
        # Complete the cycle if no end_index specified
        if hamiltonian_path and hamiltonian_path[-1] != start_index:
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