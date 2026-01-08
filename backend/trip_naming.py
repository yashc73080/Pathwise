"""
Trip naming module using Vertex AI Gemini.
Generates short, catchy names for trips based on location names.
"""

import vertexai
from vertexai.generative_models import GenerativeModel
from typing import List, Dict, Any


def generate_trip_name(locations: List[Dict[str, Any]]) -> str:
    """
    Generate a short trip name based on the locations visited.
    
    Args:
        locations: List of location dicts with 'name' and optionally 'address' fields
        
    Returns:
        A short trip name (2-5 words) like "Manhattan Art Walk" or "Brooklyn Foodie Tour"
    """
    if not locations:
        return "My Trip"
    
    # Extract location names and addresses for context
    location_info = []
    for loc in locations:
        name = loc.get('name', '')
        address = loc.get('address', '')
        if name:
            location_info.append(f"{name}" + (f" ({address})" if address else ""))
    
    if not location_info:
        return "My Trip"
    
    locations_text = ", ".join(location_info)
    
    # Use the same cheap model as the agent
    model = GenerativeModel("gemini-2.5-flash-lite")
    
    prompt = f"""Generate a short trip name (2-5 words max) for a trip visiting these locations:
        {locations_text}

        The name should:
        - Be memorable and fun
        - Capture the theme or area of the trip
        - NOT include generic words like "trip" or "tour" unless it fits naturally
        - Be title case

        Examples of good names:
        - "Manhattan Art Walk"
        - "Brooklyn Eats"
        - "Central Park Day"
        - "NYC Museum Crawl"
        - "Downtown Discovery"

        Respond with ONLY the trip name, nothing else."""

    try:
        response = model.generate_content(prompt)
        name = response.text.strip().strip('"\'')
        
        # Ensure reasonable length
        if len(name) > 50:
            name = name[:50]
        
        return name if name else "My Trip"
    except Exception as e:
        print(f"Error generating trip name: {e}")
        return "My Trip"
