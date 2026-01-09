from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import googlemaps
from dotenv import load_dotenv
import os
from christofides import tsp
from agent import get_chat_response
from trip_naming import generate_trip_name
from weather import get_weather_for_locations
import json
import firebase_admin
from firebase_admin import credentials, firestore, auth
from session_service import FirestoreSessionService, InMemorySessionService
import re

# Load environment variables from backend/.env.local
env_path = os.path.join(os.path.dirname(__file__), '.env.local')
load_dotenv(env_path)

# Initialize the Google Maps client with your API key
GOOGLE_MAPS_API_KEY = os.getenv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY')
if not GOOGLE_MAPS_API_KEY:
    raise ValueError("Google Maps API key not found in .env.local file")

gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY)

# Initialize Firebase Admin SDK
# Use service account credentials from GOOGLE_APPLICATION_CREDENTIALS
try:
    if not firebase_admin._apps:
        creds_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
        if creds_path:
            cred = credentials.Certificate(creds_path.strip())
            print(f"INFO: Using Firebase service account from {creds_path}")
        else:
            cred = credentials.ApplicationDefault()
            print("INFO: Using Application Default Credentials")
        firebase_admin.initialize_app(cred)
    db = firestore.client()
    session_service = FirestoreSessionService(db)
    print("INFO: FirestoreSessionService initialized successfully")
except Exception as e:
    print(f"Warning: Firebase Admin init failed: {e}. Using InMemorySessionService.")
    db = None
    session_service = InMemorySessionService()



app = Flask(__name__)
# Allow all origins in development for mobile testing on local network
# In production, you should restrict to specific domains
CORS(app, resources={r"/*": {"origins": "*"}})  # Enable CORS for all routes

@app.route('/')
def home():
    return "Welcome to the Pathwise API! Use the /submit-itinerary endpoint to calculate routes."

@app.route('/submit-itinerary', methods=['POST'])
def submit_itinerary():
    data = request.json
    locations = data.get("locations", [])
    start_index = data.get("start_index", 0)
    end_index = data.get("end_index", None)
    
    if not locations or len(locations) < 2:
        return jsonify({"error": "You need at least two locations to calculate a route."}), 400

    # Validate indices
    if start_index is not None and (start_index < 0 or start_index >= len(locations)):
        start_index = 0
    if end_index is not None and (end_index < 0 or end_index >= len(locations)):
        end_index = None

    try:
        # Run the TSP algorithm on the entered locations
        optimized_route = tsp(locations, start_index, end_index)
        
        # Convert locations to indices for response
        # Since optimized_route contains location dicts in optimized order,
        # we need to map them back to original indices
        route_indices = []
        used_indices = set()
        for loc in optimized_route:
            # Try to find matching location by name and coordinates
            found = False
            for i, orig_loc in enumerate(locations):
                if i not in used_indices and orig_loc['name'] == loc['name']:
                    # Check if coordinates match (with small tolerance for floating point)
                    if abs(orig_loc['lat'] - loc['lat']) < 0.0001 and abs(orig_loc['lng'] - loc['lng']) < 0.0001:
                        route_indices.append(i)
                        used_indices.add(i)
                        found = True
                        break
            if not found:
                # Fallback: find first unused location with matching name
                for i, orig_loc in enumerate(locations):
                    if i not in used_indices and orig_loc['name'] == loc['name']:
                        route_indices.append(i)
                        used_indices.add(i)
                        break
        
        return jsonify({
            "status": "success",
            "optimized_route": route_indices
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/geocode', methods=['POST'])
def geocode_locations():
    """
    Geocode a list of location names to get their latitude and longitude.
    
    Expected input: 
    {
        "locations": ["Empire State Building", "Willis Tower", "Golden Gate Bridge"]
    }
    
    Returns:
    {
        "geocoded_locations": [
            {"name": "Empire State Building", "lat": 40.7484, "lng": -73.9857},
            ...
        ]
    }
    """
    locations = request.json.get('locations', [])
    geocoded_locations = []
    
    for location in locations:
        try:
            # Geocode the location
            geocode_result = gmaps.geocode(location)
            
            if geocode_result:
                lat = geocode_result[0]['geometry']['location']['lat']
                lng = geocode_result[0]['geometry']['location']['lng']
                
                geocoded_locations.append({
                    'name': location,
                    'lat': lat,
                    'lng': lng
                })
            else:
                print(f"Could not geocode location: {location}")
        
        except Exception as e:
            print(f"Error geocoding {location}: {str(e)}")
    
    return jsonify({
        'geocoded_locations': geocoded_locations
    })

@app.route('/optimize_route', methods=['POST'])
def optimize_route():
    """
    Optimize the route for given locations using Christofides algorithm.
    
    Expected input:
    {
        "locations": [
            {"name": "Empire State Building", "lat": 40.7484, "lng": -73.9857},
            ...
        ],
        "start_index": 0 (optional),
        "end_index": null (optional)
    }
    
    Returns:
    {
        "route": [optimized list of locations],
        "total_distance": total_miles,
        "total_time": estimated_time
    }
    """
    locations = request.json.get('locations', [])
    start_index = request.json.get('start_index', 0)
    end_index = request.json.get('end_index', None)
    
    if len(locations) < 2:
        return jsonify({
            'error': 'At least two locations are required for route optimization'
        }), 400
    
    # Validate indices
    if start_index is not None and (start_index < 0 or start_index >= len(locations)):
        start_index = 0
    if end_index is not None and (end_index < 0 or end_index >= len(locations)):
        end_index = None
    
    # Use Christofides algorithm to optimize route
    optimized_route = tsp(locations, start_index, end_index)
    
    # Calculate total distance and estimated time
    total_distance = sum(
        get_travel_distance(optimized_route[i], optimized_route[i+1]) 
        for i in range(len(optimized_route) - 1)
    )
    
    # Rough estimate: 50 miles per hour average
    total_time = f"{total_distance / 50:.1f} hours"
    
    return jsonify({
        'route': optimized_route,
        'total_distance': round(total_distance, 1),
        'total_time': total_time
    })

@app.route('/chat', methods=['POST'])
def chat():
    try:
        messages = request.json
        locations_param = request.args.get('locations')
        centroid_info = ""
        formatted_locations = locations_param
        
        try:
            # Try parsing as JSON first
            if locations_param and (locations_param.startswith('[') or locations_param.startswith('{')):
                locations_data = json.loads(locations_param)
                if isinstance(locations_data, list) and len(locations_data) > 0:
                    # Calculate Centroid
                    lats = [float(loc.get('lat')) for loc in locations_data if loc.get('lat') is not None]
                    lngs = [float(loc.get('lng')) for loc in locations_data if loc.get('lng') is not None]
                    
                    formatted_req_locations = []
                    for loc in locations_data:
                        loc_str = loc.get('name', 'Unknown')
                        if loc.get('lat') and loc.get('lng'):
                            loc_str += f" ({loc['lat']},{loc['lng']})"
                        formatted_req_locations.append(loc_str)
                    formatted_locations = "; ".join(formatted_req_locations)

                    if lats and lngs:
                        center_lat = sum(lats) / len(lats)
                        center_lng = sum(lngs) / len(lngs)
                        centroid_info = f"\nThe geographic center (centroid) of the trip is approximately lat:{center_lat:.4f}, lng:{center_lng:.4f}. Use this coordinates as the 'location' parameter in search_places for general 'nearby' queries."
        except Exception as e:
            # Fallback to assuming it's the old semicolon string format or just plain text
            print(f"Error parsing locations for chat context: {e}")
            pass

        # System message for context
        system_message = {
            "role": "system",
            "content": f"""You are Pathwise AI, an AI travel assistant with advanced action-taking capabilities. 
            Your primary goal is to help users plan and execute their travel itineraries seamlessly.
            The current itinerary includes the following locations: {formatted_locations}.
            {centroid_info}
            When the user asks for "nearby" recommendations without specifying a reference point, infer whether they mean near a specific stop or the general area of the trip. 
            The search_places tool accepts 'location' (lat,lng string) and 'radius' (meters) parameters. PREFER using these parameters with the centroid or a specific location's coordinates over text-based search alone.
            IMPORTANT: When you use the `search_places` tool, the results will be displayed to the user as visual cards. IN YOUR TEXT RESPONSE, DO NOT LIST THE PLACES AGAIN (no names, addresses, or ratings). Only provide a brief summary (e.g., 'I found several options nearby...') or specific advice/directions if asked. Avoid redundancy.
            """
        }
        
        # Add system message at the beginning
        messages.insert(0, system_message)
        
        # Generator for streaming response using Vertex AI agent
        
        # Capture request context needed for the generator
        auth_header = request.headers.get('Authorization')
        chat_id_arg = request.args.get('chatId')
        locations_arg = request.args.get('locations')
        
        # Pre-verify user if auth header exists
        user_id = None
        if auth_header and auth_header.startswith("Bearer "):
            try:
                token = auth_header.split("Bearer ")[1]
                decoded_token = auth.verify_id_token(token)
                user_id = decoded_token['uid']
                print(f"DEBUG: User authenticated: {user_id}")
            except Exception as auth_error:
                print(f"DEBUG: Auth verification failed: {auth_error}")

        # Generator for streaming response using Vertex AI agent
        def generate():
            full_response = ""
            for chunk in get_chat_response(messages, gmaps):
                full_response += chunk
                yield chunk
            
            # Save the conversation using session_service
            if user_id and chat_id_arg:
                try:
                    print(f"DEBUG: Saving to session {chat_id_arg} for user {user_id}")
                    
                    # Save user message (last message before system was inserted)
                    user_content = messages[-1]['content']
                    session_service.add_message(user_id, chat_id_arg, 'user', user_content)
                    
                    # Save assistant response
                    session_service.add_message(user_id, chat_id_arg, 'assistant', full_response)
                    
                    # Sanitize lastMessage for metadata (remove places data)
                    clean_last_message = re.sub(r'<!--PLACES_DATA:[\s\S]*?(?::PLACES_DATA-->|$)', '', full_response).strip()
                    
                    # Update session metadata
                    session_service.update_session(user_id, chat_id_arg, {
                        'locations': locations_arg,
                        'lastMessage': clean_last_message[:200]
                    })
                    
                    print("DEBUG: Chat saved successfully via session_service")
                except Exception as save_error:
                    print(f"Error saving chat: {save_error}")
            else:
                print(f"DEBUG: Skipping save. user_id={user_id}, chat_id={chat_id_arg}")

        return Response(generate(), mimetype='text/event-stream')
    
    except Exception as e:
        print(f"Chat error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/chat/sessions', methods=['GET'])
def get_chat_sessions():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith("Bearer "):
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        token = auth_header.split("Bearer ")[1]
        decoded_token = auth.verify_id_token(token)
        user_id = decoded_token['uid']
        
        sessions = session_service.list_sessions(user_id)
        return jsonify({"sessions": sessions})
    except Exception as e:
         return jsonify({"error": str(e)}), 500

@app.route('/chat/sessions/<chat_id>/messages', methods=['GET'])
def get_chat_messages(chat_id):
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith("Bearer "):
        return jsonify({"error": "Unauthorized"}), 401
        
    try:
        token = auth_header.split("Bearer ")[1]
        decoded_token = auth.verify_id_token(token)
        user_id = decoded_token['uid']
        
        messages = session_service.get_messages(user_id, chat_id)
        return jsonify({"messages": messages})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
            return 0
    except Exception as e:
        print(f"Error in get_travel_distance: {str(e)}")
        return 0

@app.route('/generate-trip-name', methods=['POST'])
def generate_trip_name_endpoint():
    """
    Generate an AI-powered short name for a trip based on its locations.
    
    Expected input:
    {
        "locations": [
            {"name": "Empire State Building", "address": "NYC"},
            {"name": "Central Park", "address": "NYC"}
        ]
    }
    
    Returns:
    {
        "name": "Manhattan Landmarks"
    }
    """
    try:
        data = request.json
        locations = data.get('locations', [])
        
        if not locations:
            return jsonify({"name": "My Trip"})
        
        name = generate_trip_name(locations)
        return jsonify({"name": name})
    except Exception as e:
        print(f"Error generating trip name: {e}")
        return jsonify({"name": "My Trip"})

@app.route('/weather', methods=['POST'])
def get_weather():
    """
    Get weather forecast for trip locations with automatic region clustering.
    
    Expected input:
    {
        "locations": [
            {"name": "Empire State Building", "lat": 40.7484, "lng": -73.9857},
            ...
        ]
    }
    
    Returns:
    {
        "regions": [
            {
                "regionName": "New York City Area",
                "forecast": [...7 days of weather data]
            }
        ],
        "clusterCount": 1,
        "thresholdMiles": 50
    }
    """
    try:
        data = request.json
        locations = data.get('locations', [])
        
        if not locations:
            return jsonify({"regions": [], "clusterCount": 0})
        
        result = get_weather_for_locations(locations)
        return jsonify(result)
    except Exception as e:
        print(f"Error fetching weather: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True, port=5000)