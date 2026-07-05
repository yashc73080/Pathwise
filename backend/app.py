from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import googlemaps
from dotenv import load_dotenv
import os
from christofides import route_total_distance, tsp
from agent import get_chat_response
from trip_naming import generate_trip_name
from weather import get_weather_for_locations
import json
import firebase_admin
from firebase_admin import credentials, firestore, auth as firebase_auth
from session_service import FirestoreSessionService, InMemorySessionService
from routes.trips import create_trips_blueprint
from services.trip_repository import FirestoreTripRepository, InMemoryTripRepository
from services.trip_service import TripService
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
    trip_repository = FirestoreTripRepository(db)
    print("INFO: FirestoreSessionService initialized successfully")
except Exception as e:
    print(f"Warning: Firebase Admin init failed: {e}. Using InMemorySessionService.")
    db = None
    session_service = InMemorySessionService()
    trip_repository = InMemoryTripRepository()

trip_service = TripService(trip_repository, gmaps_client=gmaps)


app = Flask(__name__)
# Allowed origins: localhost + private LAN IPs (dev/mobile testing on local
# network), Capacitor webview origins (native app), and production hosting.
CORS(app, resources={r"/*": {"origins": [
    r"http://localhost:\d+",
    r"http://192\.168\.\d{1,3}\.\d{1,3}:3000",
    r"http://10\.\d{1,3}\.\d{1,3}\.\d{1,3}:3000",
    "capacitor://localhost",
    "http://localhost",
    "https://localhost",
    "https://pathwise.web.app",
]}}, allow_headers=["Content-Type", "Authorization", "X-Claim-Token"], methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"])

@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    allowed_origin = (
        bool(origin and re.match(r"^http://localhost:\d+$", origin))
        or origin == "https://pathwise.web.app"
        or bool(origin and re.match(r"^http://192\.168\.\d{1,3}\.\d{1,3}:3000$", origin))
        or bool(origin and re.match(r"^http://10\.\d{1,3}\.\d{1,3}\.\d{1,3}:3000$", origin))
    )
    if allowed_origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Claim-Token"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, DELETE, OPTIONS"
    return response

app.register_blueprint(create_trips_blueprint(trip_service))

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
    total_distance = route_total_distance(optimized_route, gmaps_client=gmaps)
    
    # Rough estimate: 50 miles per hour average
    total_time = f"{total_distance / 50:.1f} hours"
    
    return jsonify({
        'route': optimized_route,
        'total_distance': round(total_distance, 1),
        'total_time': total_time
    })

def build_trip_prompt_context(trip):
    """Compact trip state for the agent's system prompt: day/stop ids are the
    handles the model passes to tools, plus a centroid for nearby searches."""
    days = []
    all_coords = []
    for day in trip.days:
        stops = []
        for stop in day.stops:
            entry = {"id": stop.id, "name": stop.name}
            if stop.lat is not None and stop.lng is not None:
                entry["lat"] = stop.lat
                entry["lng"] = stop.lng
                all_coords.append((stop.lat, stop.lng))
            if stop.arrivalTime:
                entry["arrivalTime"] = stop.arrivalTime
            stops.append(entry)
        days.append({
            "id": day.id,
            "label": day.label,
            "date": day.date,
            "stops": stops,
            "optimized": bool(day.route and day.route.order),
        })
    state = {
        "title": trip.title,
        "startDate": trip.startDate,
        "endDate": trip.endDate,
        "days": days,
    }
    centroid_info = ""
    if all_coords:
        center_lat = sum(lat for lat, _ in all_coords) / len(all_coords)
        center_lng = sum(lng for _, lng in all_coords) / len(all_coords)
        centroid_info = (
            f"\nThe trip centroid is approximately lat:{center_lat:.4f}, lng:{center_lng:.4f}. "
            "Use it as the 'location' parameter in search_places for general 'nearby' queries."
        )
    return json.dumps(state), centroid_info


@app.route('/chat', methods=['POST'])
def chat():
    try:
        messages = request.json
        chat_id_arg = request.args.get('chatId')
        trip_id = request.args.get('tripId')
        claim_token = request.headers.get('X-Claim-Token') or request.args.get('claimToken')

        # Pre-verify user if auth header exists
        auth_header = request.headers.get('Authorization')
        user_id = None
        if auth_header and auth_header.startswith("Bearer "):
            try:
                token = auth_header.split("Bearer ")[1]
                decoded_token = firebase_auth.verify_id_token(token)
                user_id = decoded_token['uid']
            except Exception as auth_error:
                print(f"DEBUG: Auth verification failed: {auth_error}")

        # Load the stored trip the agent will operate on
        trip_state_json = "null"
        centroid_info = ""
        agent_trip_id = None
        if trip_id:
            try:
                trip = trip_service.get_trip(trip_id, uid=user_id, claim_token=claim_token, write=False)
                trip_state_json, centroid_info = build_trip_prompt_context(trip)
                agent_trip_id = trip_id
            except Exception as trip_error:
                print(f"DEBUG: Could not load trip {trip_id} for chat: {trip_error}")

        system_message = {
            "role": "system",
            "content": f"""You are Pathwise AI, a travel assistant that operates directly on the user's stored trip.

Current trip state (day ids and stop ids are the handles for your tools):
{trip_state_json}
{centroid_info}

Your tools:
- `search_places` - Search for places. Results are shown to the user as visual cards.
- `plan_trip` - Road trips between cities: returns waypoints and places along the route.
- `add_stops` - Add stops to a day of the trip (geocoded automatically if coordinates are missing).
- `remove_stop` / `move_stop` - Remove a stop, or move it to another day.
- `optimize_day` - Optimize a day's visiting order (shortest driving route).
- `create_day` / `set_dates` - Extend the trip or set its dates.

Guidelines:
- Changes you make through tools appear in the user's map and itinerary immediately; after acting, summarize briefly what you changed instead of restating the trip.
- NEVER create a day and reference it in the same turn. Call `create_day` alone first, read the new day's id from the result, then move or add stops to it in the next step.
- ROAD TRIP WORKFLOW: `plan_trip` first, then `add_stops` for the places the user wants, then `optimize_day`.
- For "nearby" queries prefer passing 'location' (lat,lng) and 'radius' to `search_places` (use the centroid or a specific stop's coordinates).
- When `search_places` returns results the user sees them as cards: DO NOT repeat names, addresses, or ratings in your text. Offer a brief summary or advice only.
- If the trip state is null, you can still search and give advice, but tell the user to add a location before asking you to edit the trip.
""".strip()
        }
        messages.insert(0, system_message)

        def generate():
            full_text = ""
            for event in get_chat_response(
                messages,
                gmaps,
                trip_service=trip_service,
                trip_id=agent_trip_id,
                uid=user_id,
                claim_token=claim_token,
            ):
                if event.get("type") == "text":
                    full_text += event.get("delta") or ""
                yield json.dumps(event) + "\n"

            # Save the conversation using session_service
            if user_id and chat_id_arg:
                try:
                    user_content = messages[-1]['content']
                    session_service.add_message(user_id, chat_id_arg, 'user', user_content)
                    session_service.add_message(user_id, chat_id_arg, 'assistant', full_text)
                    session_service.update_session(user_id, chat_id_arg, {
                        'tripId': trip_id,
                        'lastMessage': full_text.strip()[:200]
                    })
                except Exception as save_error:
                    print(f"Error saving chat: {save_error}")

        return Response(generate(), mimetype='application/x-ndjson')

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
        decoded_token = firebase_auth.verify_id_token(token)
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
        decoded_token = firebase_auth.verify_id_token(token)
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
