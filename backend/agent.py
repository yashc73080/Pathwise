import os
import vertexai
from vertexai.generative_models import GenerativeModel, Tool, Part, Content, ChatSession, FunctionDeclaration
import vertexai.preview.generative_models as generative_models
import googlemaps
import json
from typing import List, Dict, Any, Generator

# Initialize Vertex AI
project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
location = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")

try:
    if project_id:
        vertexai.init(project=project_id, location=location)
    else:
        vertexai.init(location=location)
except Exception as e:
    print(f"Warning: Vertex AI init failed: {e}. Ensure credentials are set.")

def search_places(query: str, location: str = None, radius: int = None, gmaps_client: googlemaps.Client = None) -> List[Dict[str, Any]]:
    """
    Search for places using Google Maps API.
    """
    if not gmaps_client:
        return []

    try:
        # Build arguments explicitly
        kwargs = {"query": query}
        if location:
            kwargs["location"] = location
        if radius:
            kwargs["radius"] = radius
            
        response = gmaps_client.places(**kwargs)
        results = response.get('results', [])
        places = []
        for result in results[:5]: 
            places.append({
                "name": result.get("name"),
                "address": result.get("formatted_address"),
                "place_id": result.get("place_id"),
                "rating": result.get("rating"),
                "location": result.get("geometry", {}).get("location"),
                "types": result.get("types")
            })
        return places
    except Exception as e:
        print(f"Error searching places: {e}")
        return []

def plan_trip(origin: str, destination: str, stop_types: List[str] = None, gmaps_client: googlemaps.Client = None) -> Dict[str, Any]:
    """
    Plan a trip route, find waypoints, and search for places at each waypoint.
    This is a compound tool that returns the route + all found places.
    """
    if not gmaps_client:
        return {"error": "Maps client not available"}
    
    if not stop_types:
        stop_types = ["attractions", "restaurants", "gas stations"]
    
    try:
        # Get directions from origin to destination
        directions = gmaps_client.directions(origin, destination, mode="driving")
        
        if not directions:
            return {"error": f"Could not find route from {origin} to {destination}"}
        
        route = directions[0]
        legs = route.get("legs", [])
        
        if not legs:
            return {"error": "No route legs found"}
        
        leg = legs[0]
        total_distance_m = leg.get("distance", {}).get("value", 0)
        total_duration_s = leg.get("duration", {}).get("value", 0)
        
        # Get start and end coordinates
        start_location = leg.get("start_location", {})
        end_location = leg.get("end_location", {})
        
        # Sample waypoints along the route
        total_distance_miles = total_distance_m * 0.000621371
        num_stops = max(2, min(5, int(total_distance_miles / 150)))  # 2-5 intermediate stops
        
        waypoints = []
        steps = leg.get("steps", [])
        
        # Calculate cumulative distance to find evenly spaced points
        cumulative_distance = 0
        distance_per_stop = total_distance_m / (num_stops + 1)
        next_stop_distance = distance_per_stop
        stop_count = 0
        
        # Always add origin
        origin_city = leg.get("start_address", origin).split(",")[0]
        waypoints.append({
            "city": origin_city,
            "lat": start_location.get("lat"),
            "lng": start_location.get("lng"),
            "type": "origin"
        })
        
        # Find intermediate waypoints
        for step in steps:
            step_distance = step.get("distance", {}).get("value", 0)
            cumulative_distance += step_distance
            
            if cumulative_distance >= next_stop_distance and stop_count < num_stops:
                step_end = step.get("end_location", {})
                lat = step_end.get("lat")
                lng = step_end.get("lng")
                
                # Reverse geocode to get city name
                try:
                    reverse_result = gmaps_client.reverse_geocode((lat, lng))
                    city_name = "Unknown"
                    for component in reverse_result[0].get("address_components", []):
                        if "locality" in component.get("types", []):
                            city_name = component.get("long_name")
                            break
                        elif "administrative_area_level_2" in component.get("types", []):
                            city_name = component.get("long_name")
                except:
                    city_name = f"Stop {stop_count + 1}"
                
                waypoints.append({
                    "city": city_name,
                    "lat": lat,
                    "lng": lng,
                    "type": "waypoint"
                })
                
                stop_count += 1
                next_stop_distance += distance_per_stop
        
        # Always add destination
        dest_city = leg.get("end_address", destination).split(",")[0]
        waypoints.append({
            "city": dest_city,
            "lat": end_location.get("lat"),
            "lng": end_location.get("lng"),
            "type": "destination"
        })
        
        print(f"  Plan: Found {len(waypoints)} waypoints, now searching at each...")
        
        # NOW SEARCH FOR PLACES AT EACH WAYPOINT
        all_places = []
        
        for wp in waypoints:
            city = wp["city"]
            lat = wp["lat"]
            lng = wp["lng"]
            location_str = f"{lat},{lng}"
            
            # Search for each stop type at this waypoint
            for stop_type in stop_types:
                # Build search query
                if stop_type == "gas stations":
                    query = "gas station"
                elif stop_type == "restaurants":
                    query = "restaurant"
                elif stop_type == "attractions":
                    query = f"tourist attractions in {city}"
                else:
                    query = stop_type
                
                print(f"    Searching: {query} near {city}")
                
                try:
                    results = search_places(query, location=location_str, radius=15000, gmaps_client=gmaps_client)
                    # Take top 1-2 results per search to avoid overwhelming
                    for place in results[:2]:
                        place["waypoint_city"] = city
                        place["stop_type"] = stop_type
                        all_places.append(place)
                except Exception as search_error:
                    print(f"    Search error: {search_error}")
        
        # Deduplicate by place_id (same location can appear in multiple searches)
        seen_place_ids = set()
        unique_places = []
        for place in all_places:
            place_id = place.get("place_id")
            # Also check by name if no place_id
            place_key = place_id or place.get("name", "")
            if place_key and place_key not in seen_place_ids:
                seen_place_ids.add(place_key)
                unique_places.append(place)
        
        print(f"  Found {len(all_places)} total places, {len(unique_places)} unique")
        
        return {
            "origin": origin,
            "destination": destination,
            "total_distance_miles": round(total_distance_miles, 1),
            "total_duration_hours": round(total_duration_s / 3600, 1),
            "num_waypoints": len(waypoints),
            "waypoints": waypoints,
            "places_found": unique_places,
            "success": True
        }
        
    except Exception as e:
        print(f"Error planning trip: {e}")
        return {"error": str(e)}

search_places_func = FunctionDeclaration(
    name="search_places",
    description="Search for places using Google Maps to find specific locations, restaurants, or attractions.",
    parameters={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The search query for places, e.g., 'Italian restaurants in SOHO'"
            },
            "location": {
                "type": "string",
                "description": "The latitude/longitude to bias the search around, in format 'lat,lng' (e.g., '40.7128,-74.0060'). Use the trip centroid or a specific location's coordinates."
            },
            "radius": {
                "type": "integer",
                "description": "The radius in meters to search within. Default is usually 50000 locally, but explicit radius helps narrow down 'nearby' queries."
            }
        },
        "required": ["query"]
    },
)

# Function to add multiple locations to the itinerary at once
add_locations_func = FunctionDeclaration(
    name="add_locations_to_itinerary",
    description="Add multiple locations to the user's trip itinerary at once. Use this when the user wants to plan a trip with multiple stops, or after searching for places along a route. This will automatically add all specified locations as waypoints.",
    parameters={
        "type": "object",
        "properties": {
            "locations": {
                "type": "array",
                "description": "Array of locations to add to the itinerary",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Name of the location"},
                        "address": {"type": "string", "description": "Full address of the location"},
                        "lat": {"type": "number", "description": "Latitude coordinate"},
                        "lng": {"type": "number", "description": "Longitude coordinate"},
                        "place_id": {"type": "string", "description": "Google Places ID (optional)"}
                    },
                    "required": ["name", "lat", "lng"]
                }
            }
        },
        "required": ["locations"]
    },
)

# Function to optimize the current route
optimize_route_func = FunctionDeclaration(
    name="optimize_route",
    description="Optimize the route for all locations currently in the user's itinerary. Call this after adding locations to calculate the most efficient travel order. This uses the Christofides algorithm to find the optimal path.",
    parameters={
        "type": "object",
        "properties": {},
        "required": []
    },
)

# Function to plan a trip route and get waypoints
plan_trip_func = FunctionDeclaration(
    name="plan_trip",
    description="Plan a road trip route between two cities. Returns waypoint cities along the route with coordinates and suggested search categories (attractions, restaurants, gas stations). ALWAYS call this FIRST when user asks for a multi-city trip or road trip to understand the route geography before searching for places.",
    parameters={
        "type": "object",
        "properties": {
            "origin": {
                "type": "string",
                "description": "Starting city or address (e.g., 'New York City' or 'NYC')"
            },
            "destination": {
                "type": "string",
                "description": "Ending city or address (e.g., 'Chicago' or 'Chicago, IL')"
            },
            "stop_types": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Types of stops to find (e.g., ['attractions', 'restaurants', 'gas_stations']). Defaults to all three."
            }
        },
        "required": ["origin", "destination"]
    },
)

# Tool with all function declarations
agent_tools = Tool(
    function_declarations=[search_places_func, add_locations_func, optimize_route_func, plan_trip_func],
)

def get_chat_response(messages: List[Dict[str, str]], gmaps_client: googlemaps.Client) -> Generator[str, None, None]:
    """
    Generate a chat response using Vertex AI with tool calling.
    Supports multi-turn tool calls for chaining actions (e.g., search -> add -> optimize).
    """
    system_instruction = None
    if messages and messages[0]['role'] == 'system':
        system_instruction = messages[0]['content']
        messages = messages[1:]
    
    model = GenerativeModel(
        "gemini-2.5-flash-lite",
        tools=[agent_tools],
        system_instruction=system_instruction
    )
    
    # Rebuild history
    chat_history = []
    for msg in messages[:-1]:
        role = "user" if msg['role'] == 'user' else "model"
        chat_history.append(Content(role=role, parts=[Part.from_text(msg['content'])]))
    
    chat = model.start_chat(history=chat_history)
    last_user_message = messages[-1]['content']
    
    # Send initial message (non-streaming) to check for tool calls
    response = chat.send_message(last_user_message, stream=False)
    
    # Track places found for potential batch add
    found_places = []
    
    # Process tool calls in a loop (supports multi-turn)
    max_tool_iterations = 15  # Allow for plan -> multiple searches -> add -> optimize
    iteration = 0
    
    while iteration < max_tool_iterations:
        iteration += 1
        
        try:
            part = response.candidates[0].content.parts[0]
        except IndexError:
            yield "I encountered an error processing your request."
            return
        
        # Check if this is a function call
        if not part.function_call:
            # No more tool calls, yield text and exit
            if part.text:
                yield part.text
            return
        
        fn = part.function_call
        print(f"Agent calling tool: {fn.name}")
        
        if fn.name == "search_places":
            query = fn.args.get("query")
            location = fn.args.get("location")
            radius = fn.args.get("radius")
            
            print(f"  -> search_places('{query}', location={location}, radius={radius})")
            
            # Execute tool
            results = search_places(query, location=location, radius=radius, gmaps_client=gmaps_client)
            found_places.extend(results)
            
            # Yield structured place data for frontend to parse
            if results:
                yield f"<!--PLACES_DATA:{json.dumps(results)}:PLACES_DATA-->"
            
            # Send result back to model
            function_response = Part.from_function_response(
                name="search_places",
                response={"content": results},
            )
            
        elif fn.name == "add_locations_to_itinerary":
            locations = fn.args.get("locations", [])
            
            print(f"  -> add_locations_to_itinerary({len(locations)} locations)")
            
            # Yield marker for frontend to add these locations
            yield f"<!--ADD_LOCATIONS:{json.dumps(locations)}:ADD_LOCATIONS-->"
            
            # Send success response back to model
            function_response = Part.from_function_response(
                name="add_locations_to_itinerary",
                response={"content": f"Successfully added {len(locations)} locations to itinerary"},
            )
            
        elif fn.name == "optimize_route":
            print(f"  -> optimize_route()")
            
            # Yield marker for frontend to trigger optimization
            yield "<!--OPTIMIZE_ROUTE:true:OPTIMIZE_ROUTE-->"
            
            # Send success response back to model
            function_response = Part.from_function_response(
                name="optimize_route",
                response={"content": "Route optimization triggered"},
            )
            
        elif fn.name == "plan_trip":
            origin = fn.args.get("origin")
            destination = fn.args.get("destination")
            stop_types = fn.args.get("stop_types")
            
            print(f"  -> plan_trip('{origin}' -> '{destination}', stops={stop_types})")
            
            # Execute the plan_trip function (compound - searches at all waypoints)
            trip_plan = plan_trip(origin, destination, stop_types, gmaps_client=gmaps_client)
            
            if trip_plan.get("error"):
                print(f"     Error: {trip_plan['error']}")
            else:
                print(f"     Route: {trip_plan['num_waypoints']} waypoints, {trip_plan['total_distance_miles']} miles")
                print(f"     Places found: {len(trip_plan.get('places_found', []))}")
                
                # Yield all found places as PLACES_DATA for frontend to display
                places_found = trip_plan.get("places_found", [])
                if places_found:
                    yield f"<!--PLACES_DATA:{json.dumps(places_found)}:PLACES_DATA-->"
            
            # Send summary back to model
            function_response = Part.from_function_response(
                name="plan_trip",
                response={"content": f"Found {len(trip_plan.get('places_found', []))} places across {trip_plan.get('num_waypoints', 0)} waypoints from {origin} to {destination}. Distance: {trip_plan.get('total_distance_miles', 0)} miles."},
            )
            
        else:
            # Unknown function
            print(f"  -> Unknown function: {fn.name}")
            function_response = Part.from_function_response(
                name=fn.name,
                response={"error": "Unknown function"},
            )
        
        # Continue conversation with function response (non-streaming to check for more tool calls)
        response = chat.send_message([function_response], stream=False)
    
    # If we hit max iterations, stream the final response
    try:
        if response.candidates[0].content.parts[0].text:
            yield response.candidates[0].content.parts[0].text
    except (IndexError, AttributeError):
        yield "I completed the requested actions."

