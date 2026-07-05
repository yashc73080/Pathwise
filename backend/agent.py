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

# --- Trip mutation tools: executed server-side against TripService ---

add_stops_func = FunctionDeclaration(
    name="add_stops",
    description="Add one or more stops to a day of the user's stored trip. Use after searching for places, or when the user names places directly. Stops without coordinates are geocoded automatically.",
    parameters={
        "type": "object",
        "properties": {
            "stops": {
                "type": "array",
                "description": "Stops to add",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Name of the place"},
                        "address": {"type": "string", "description": "Full address (optional)"},
                        "lat": {"type": "number", "description": "Latitude (optional, geocoded if missing)"},
                        "lng": {"type": "number", "description": "Longitude (optional, geocoded if missing)"},
                        "place_id": {"type": "string", "description": "Google Places ID (optional)"}
                    },
                    "required": ["name"]
                }
            },
            "day_id": {
                "type": "string",
                "description": "The id of the day to add stops to (from the trip state). Defaults to the first day."
            }
        },
        "required": ["stops"]
    },
)

remove_stop_func = FunctionDeclaration(
    name="remove_stop",
    description="Remove a stop from the user's trip. Identify it by stop_id from the trip state, or by name.",
    parameters={
        "type": "object",
        "properties": {
            "stop_id": {"type": "string", "description": "The id of the stop to remove (preferred)"},
            "stop_name": {"type": "string", "description": "The name of the stop, if the id is unknown"}
        },
        "required": []
    },
)

move_stop_func = FunctionDeclaration(
    name="move_stop",
    description="Move a stop to a different day of the trip, e.g. 'move the museum to tomorrow'.",
    parameters={
        "type": "object",
        "properties": {
            "stop_id": {"type": "string", "description": "The id of the stop to move (preferred)"},
            "stop_name": {"type": "string", "description": "The name of the stop, if the id is unknown"},
            "to_day_id": {"type": "string", "description": "The id of the destination day (from the trip state)"}
        },
        "required": ["to_day_id"]
    },
)

optimize_day_func = FunctionDeclaration(
    name="optimize_day",
    description="Optimize the visiting order of a day's stops for shortest driving distance (Christofides TSP). Call after adding or moving stops. Returns the optimized order and total distance.",
    parameters={
        "type": "object",
        "properties": {
            "day_id": {
                "type": "string",
                "description": "The id of the day to optimize. Defaults to the first day with 2+ stops."
            }
        },
        "required": []
    },
)

create_day_func = FunctionDeclaration(
    name="create_day",
    description="Add a new day to the trip, e.g. when the user wants to extend the trip or spread stops out.",
    parameters={
        "type": "object",
        "properties": {
            "date": {"type": "string", "description": "ISO date for the new day, e.g. '2026-08-02' (optional)"}
        },
        "required": []
    },
)

set_dates_func = FunctionDeclaration(
    name="set_dates",
    description="Set or change the trip's start and/or end date.",
    parameters={
        "type": "object",
        "properties": {
            "start_date": {"type": "string", "description": "ISO start date, e.g. '2026-08-01'"},
            "end_date": {"type": "string", "description": "ISO end date, e.g. '2026-08-03'"}
        },
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
    function_declarations=[
        search_places_func,
        plan_trip_func,
        add_stops_func,
        remove_stop_func,
        move_stop_func,
        optimize_day_func,
        create_day_func,
        set_dates_func,
    ],
)

class TripToolExecutor:
    """
    Executes the agent's trip-mutation tools directly against TripService.
    Resolves days/stops by id first, then by (case-insensitive) name so the
    model can reference either.
    """

    def __init__(self, trip_service, trip_id: str, uid: str = None, claim_token: str = None):
        self.service = trip_service
        self.trip_id = trip_id
        self.uid = uid
        self.claim_token = claim_token

    @property
    def _auth(self):
        return {"uid": self.uid, "claim_token": self.claim_token}

    def _trip(self):
        return self.service.get_trip(self.trip_id, write=False, **self._auth)

    def _resolve_day(self, day_id: str = None, require_optimizable: bool = False):
        trip = self._trip()
        if day_id:
            for day in trip.days:
                if day.id == day_id or (day.label or "").lower() == str(day_id).lower():
                    return day
            raise ValueError(f"No day matching '{day_id}'")
        if require_optimizable:
            for day in trip.days:
                if len(day.stops) >= 2:
                    return day
            raise ValueError("No day has 2 or more stops to optimize")
        return trip.days[0]

    def _resolve_stop(self, stop_id: str = None, stop_name: str = None):
        trip = self._trip()
        for day in trip.days:
            for stop in day.stops:
                if stop_id and stop.id == stop_id:
                    return day, stop
        if stop_name:
            needle = stop_name.lower()
            for day in trip.days:
                for stop in day.stops:
                    if needle in stop.name.lower():
                        return day, stop
        raise ValueError(f"No stop matching '{stop_id or stop_name}'")

    def add_stops(self, stops: List[Dict], day_id: str = None) -> str:
        day = self._resolve_day(day_id)
        added = []
        for stop_data in stops:
            stop = self.service.add_stop(self.trip_id, day.id, dict(stop_data), **self._auth)
            added.append(stop.name)
        return f"Added to {day.label}: {', '.join(added)}"

    def remove_stop(self, stop_id: str = None, stop_name: str = None) -> str:
        day, stop = self._resolve_stop(stop_id, stop_name)
        self.service.remove_stop(self.trip_id, day.id, stop.id, **self._auth)
        return f"Removed {stop.name} from {day.label}"

    def move_stop(self, to_day_id: str, stop_id: str = None, stop_name: str = None) -> str:
        _, stop = self._resolve_stop(stop_id, stop_name)
        target = self._resolve_day(to_day_id)
        self.service.move_stop(self.trip_id, stop.id, target.id, **self._auth)
        return f"Moved {stop.name} to {target.label}"

    def optimize_day(self, day_id: str = None) -> str:
        day = self._resolve_day(day_id, require_optimizable=True)
        optimized = self.service.optimize_day(self.trip_id, day.id, **self._auth)
        by_id = {stop.id: stop.name for stop in optimized.stops}
        order = [by_id[sid] for sid in optimized.route.order if sid in by_id]
        distance = optimized.route.totalDistanceMiles
        return f"Optimized {day.label}: {' -> '.join(order)} ({distance} miles total)"

    def create_day(self, date: str = None) -> str:
        day = self.service.add_day(self.trip_id, date=date, **self._auth)
        return f"Created {day.label} with id '{day.id}'" + (f" for {date}" if date else "")

    def set_dates(self, start_date: str = None, end_date: str = None) -> str:
        patch = {}
        if start_date:
            patch["startDate"] = start_date
        if end_date:
            patch["endDate"] = end_date
        if not patch:
            return "No dates provided"
        self.service.update_trip(self.trip_id, patch, **self._auth)
        return f"Trip dates set: {start_date or 'unchanged'} to {end_date or 'unchanged'}"


# Tool names that mutate the stored trip (frontend refreshes on these)
MUTATING_TOOLS = {"add_stops", "remove_stop", "move_stop", "optimize_day", "create_day", "set_dates"}


def _proto_to_python(value):
    """Recursively convert Vertex proto Map/Repeated composites to plain python."""
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if hasattr(value, "items"):
        return {key: _proto_to_python(item) for key, item in value.items()}
    try:
        return [_proto_to_python(item) for item in value]
    except TypeError:
        return value


def get_chat_response(
    messages: List[Dict[str, str]],
    gmaps_client: googlemaps.Client,
    trip_service=None,
    trip_id: str = None,
    uid: str = None,
    claim_token: str = None,
) -> Generator[Dict[str, Any], None, None]:
    """
    Generate a chat response using Vertex AI with server-side tool execution.

    Yields event dicts for the caller to serialize (NDJSON):
      {"type": "text", "delta": str}      - assistant prose
      {"type": "places", "places": [...]} - search results to render as cards
      {"type": "trip_updated"}            - the stored trip changed; refetch it
    """
    system_instruction = None
    if messages and messages[0]['role'] == 'system':
        system_instruction = messages[0]['content']
        messages = messages[1:]

    executor = None
    if trip_service and trip_id:
        executor = TripToolExecutor(trip_service, trip_id, uid=uid, claim_token=claim_token)

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

    # response_validation=False: gemini flash occasionally emits a malformed
    # code-style function call; the SDK validator would poison the whole chat
    # session. We detect the empty/malformed turn below and nudge a retry.
    chat = model.start_chat(history=chat_history, response_validation=False)
    last_user_message = messages[-1]['content']

    response = chat.send_message(last_user_message, stream=False)

    max_tool_iterations = 15  # plan -> multiple searches -> add -> optimize chains
    iteration = 0
    malformed_retries = 0

    while iteration < max_tool_iterations:
        iteration += 1

        try:
            parts = list(response.candidates[0].content.parts)
        except (IndexError, AttributeError):
            parts = []

        if not parts:
            if malformed_retries >= 2:
                yield {"type": "text", "delta": "I had trouble completing that action. Please try rephrasing your request."}
                return
            malformed_retries += 1
            print("Agent produced a malformed/empty turn; nudging a retry.")
            # The malformed turn was appended to history with no parts, which
            # the API rejects on the next request - drop such entries.
            try:
                while chat._history and not list(chat._history[-1].parts):
                    chat._history.pop()
            except Exception as history_error:
                print(f"  Could not prune malformed history: {history_error}")
            response = chat.send_message(
                "Your previous reply was not a valid structured function call. "
                "Retry the action using the declared tools, one valid function call at a time.",
                stream=False,
            )
            continue

        function_calls = [part.function_call for part in parts if part.function_call]
        if not function_calls:
            text = "".join(part.text for part in parts if part.text)
            if text:
                yield {"type": "text", "delta": text}
            return

        # The model may issue several calls in one turn (e.g. add_stops +
        # optimize_day); Vertex requires one response part per call part.
        function_responses = []
        for fn in function_calls:
            args = dict(fn.args) if fn.args else {}
            print(f"Agent calling tool: {fn.name}({args})")

            if fn.name == "search_places":
                results = search_places(
                    args.get("query"),
                    location=args.get("location"),
                    radius=args.get("radius"),
                    gmaps_client=gmaps_client,
                )
                if results:
                    yield {"type": "places", "places": results}
                result_content = {"content": results}

            elif fn.name == "plan_trip":
                trip_plan = plan_trip(
                    args.get("origin"),
                    args.get("destination"),
                    args.get("stop_types"),
                    gmaps_client=gmaps_client,
                )
                places_found = trip_plan.get("places_found", [])
                if places_found:
                    yield {"type": "places", "places": places_found}
                result_content = {
                    "content": (
                        f"Found {len(places_found)} places across {trip_plan.get('num_waypoints', 0)} waypoints "
                        f"from {args.get('origin')} to {args.get('destination')}. "
                        f"Distance: {trip_plan.get('total_distance_miles', 0)} miles."
                        if not trip_plan.get("error") else trip_plan["error"]
                    )
                }

            elif fn.name in MUTATING_TOOLS:
                if not executor:
                    result_content = {"error": "No stored trip is available; ask the user to add a location first."}
                else:
                    try:
                        coerced = {key: _proto_to_python(value) for key, value in args.items()}
                        outcome = getattr(executor, fn.name)(**coerced)
                        yield {"type": "trip_updated"}
                        result_content = {"content": outcome}
                    except Exception as tool_error:
                        print(f"  Tool {fn.name} failed: {tool_error}")
                        result_content = {"error": str(tool_error)}

            else:
                print(f"  -> Unknown function: {fn.name}")
                result_content = {"error": "Unknown function"}

            function_responses.append(Part.from_function_response(name=fn.name, response=result_content))

        response = chat.send_message(function_responses, stream=False)

    try:
        if response.candidates[0].content.parts[0].text:
            yield {"type": "text", "delta": response.candidates[0].content.parts[0].text}
    except (IndexError, AttributeError):
        yield {"type": "text", "delta": "I completed the requested actions."}

