from __future__ import annotations

from typing import Any, Dict, List, Optional


class PlaceService:
    def __init__(self, gmaps_client):
        self.gmaps = gmaps_client

    def geocode(self, query: str) -> Optional[Dict[str, Any]]:
        if not query:
            return None
        results = self.gmaps.geocode(query)
        if not results:
            return None
        first = results[0]
        location = first.get("geometry", {}).get("location", {})
        return {
            "name": query,
            "lat": location.get("lat"),
            "lng": location.get("lng"),
            "address": first.get("formatted_address"),
            "placeId": first.get("place_id"),
        }

    def search_places(self, query: str, near: Optional[str] = None, radius: Optional[int] = None) -> List[Dict[str, Any]]:
        kwargs = {"query": query}
        if near:
            kwargs["location"] = near
        if radius:
            kwargs["radius"] = radius
        response = self.gmaps.places(**kwargs)
        places = []
        for result in response.get("results", [])[:5]:
            places.append(
                {
                    "name": result.get("name"),
                    "address": result.get("formatted_address"),
                    "placeId": result.get("place_id"),
                    "rating": result.get("rating"),
                    "location": result.get("geometry", {}).get("location"),
                    "types": result.get("types"),
                }
            )
        return places
