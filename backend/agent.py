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

def search_places(query: str, location: str = None, gmaps_client: googlemaps.Client = None) -> List[Dict[str, Any]]:
    """
    Search for places using Google Maps API.
    """
    if not gmaps_client:
        return []

    try:
        response = gmaps_client.places(query=query)
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

search_places_func = FunctionDeclaration(
    name="search_places",
    description="Search for places using Google Maps to find specific locations, restaurants, or attractions.",
    parameters={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The search query for places, e.g., 'Italian restaurants in SOHO'"
            }
        },
        "required": ["query"]
    },
)

places_tool = Tool(
    function_declarations=[search_places_func],
)

def get_chat_response(messages: List[Dict[str, str]], gmaps_client: googlemaps.Client) -> Generator[str, None, None]:
    """
    Generate a chat response using Vertex AI with tool calling.
    """
    system_instruction = None
    if messages and messages[0]['role'] == 'system':
        system_instruction = messages[0]['content']
        messages = messages[1:]
    
    model = GenerativeModel(
        "gemini-2.5-flash-lite",
        tools=[places_tool],
        system_instruction=system_instruction
    )
    
    # Rebuild history
    chat_history = []
    for msg in messages[:-1]:
        role = "user" if msg['role'] == 'user' else "model"
        chat_history.append(Content(role=role, parts=[Part.from_text(msg['content'])]))
    
    chat = model.start_chat(history=chat_history)
    last_user_message = messages[-1]['content']
    
    # 1. Send message (non-streaming) to check for tool calls
    response = chat.send_message(last_user_message, stream=False)
    
    try:
        part = response.candidates[0].content.parts[0]
    except IndexError:
        yield "I encountered an error processing your request."
        return 

    # 2. Check for function call
    if part.function_call:
        fn = part.function_call
        if fn.name == "search_places":
            query = fn.args.get("query")
            print(f"Agent calling tool: search_places('{query}')")
            
            # Execute tool
            results = search_places(query, gmaps_client=gmaps_client)
            
            # Yield structured place data for frontend to parse
            if results:
                yield f"<!--PLACES_DATA:{json.dumps(results)}:PLACES_DATA-->"
            
            # Send result back to model
            function_response = Part.from_function_response(
                name="search_places",
                response={
                    "content": results,
                },
            )
            
            # 3. Stream the final response
            final_response = chat.send_message(
                [function_response],
                stream=True
            )
            
            for chunk in final_response:
                if chunk.text:
                    yield chunk.text
    else:
        # No tool call, yield the text directly
        if part.text:
            yield part.text
