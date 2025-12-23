from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import googlemaps
from dotenv import load_dotenv
import os
from christofides import tsp
from openai import OpenAI
import json

# Load environment variables from a .env file
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env.local')
load_dotenv(env_path)

# Initialize OpenAI client
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv('OPENROUTER_API_KEY')
)

# Initialize the Google Maps client with your API key
GOOGLE_MAPS_API_KEY = os.getenv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY')
if not GOOGLE_MAPS_API_KEY:
    raise ValueError("Google Maps API key not found in .env.local file")

gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["https://tripwhiz.onrender.com", "http://localhost:3000"]}})  # Enable CORS for all routes

@app.route('/')
def home():
    return "Welcome to the TSP API! Use the /submit-itinerary endpoint to calculate routes."

@app.route('/submit-itinerary', methods=['POST'])
def submit_itinerary():
    data = request.json
    locations = data.get("locations", [])
    
    if not locations or len(locations) < 2:
        return jsonify({"error": "You need at least two locations to calculate a route."}), 400

    try:
        # Run the TSP algorithm on the entered locations
        optimized_route = tsp(locations, 0)  # Start from the first location
        return jsonify({
            "status": "success",
            "optimized_route": [locations.index(loc) for loc in optimized_route]
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
        ]
    }
    
    Returns:
    {
        "route": [optimized list of locations],
        "total_distance": total_miles,
        "total_time": estimated_time
    }
    """
    locations = request.json.get('locations', [])
    
    if len(locations) < 2:
        return jsonify({
            'error': 'At least two locations are required for route optimization'
        }), 400
    
    # Use Christofides algorithm to optimize route
    optimized_route = tsp(locations)
    
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
        locations = request.args.get('locations')  # Extract locations from query parameters

        # System message for context
        system_message = {
            "role": "system",
            "content": f"""You are TripWhiz AI, an AI travel assistant with advanced action-taking capabilities. 
            Your primary goal is to help users plan and execute their travel itineraries seamlessly.
            The current itinerary includes the following locations: {locations}.
            """
        }
        
        # Add system message at the beginning
        messages.insert(0, system_message)
        
        # Create chat completion with new API format
        response = client.chat.completions.create(
            model="meta-llama/llama-3.3-70b-instruct:free",
            messages=messages,
            stream=True
        )
        
        def generate():
            for chunk in response:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content
        
        return Response(generate(), mimetype='text/event-stream')
    
    except Exception as e:
        print(f"Chat error: {str(e)}")
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

if __name__ == '__main__':
    app.run(debug=True, port=5000)