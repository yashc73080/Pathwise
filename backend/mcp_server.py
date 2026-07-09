"""
Pathwise MCP server: a thin layer over TripService so external LLMs
(ChatGPT, Claude, etc.) can create and edit trips. Each tool validates
arguments, calls the shared service, and serializes the result - all
business logic lives in services/trip_service.py.

Auth model: anonymous create + claim-on-open. create_trip needs no identity
and returns a claim_token (the per-trip write capability for subsequent
calls) plus a share_url the user opens to claim the trip into their account.
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

from routes.trips import build_share_url, serialize_trip
from services.trip_service import AuthorizationError, NotFoundError, ValidationError


def _transport_security() -> TransportSecuritySettings:
    """
    FastMCP's DNS-rebinding protection defaults to allowing only
    localhost/127.0.0.1/[::1] Host headers, which rejects every real
    deployment (Cloud Run, a custom domain, ...) with a 421. Extend the
    allowlist with MCP_ALLOWED_HOSTS/MCP_ALLOWED_ORIGINS (comma-separated)
    so the deployed host can be added without touching this file again.
    """
    # Known Cloud Run host baked in as a default; override/extend via env
    # vars (comma-separated) if you add a custom domain later.
    default_host = "pathwise-backend-778971177326.us-central1.run.app"
    extra_hosts = [h.strip() for h in os.getenv("MCP_ALLOWED_HOSTS", "").split(",") if h.strip()]
    extra_origins = [o.strip() for o in os.getenv("MCP_ALLOWED_ORIGINS", "").split(",") if o.strip()]
    return TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=["127.0.0.1:*", "localhost:*", "[::1]:*", default_host, *extra_hosts],
        allowed_origins=[
            "http://127.0.0.1:*", "http://localhost:*", "http://[::1]:*",
            f"https://{default_host}", *extra_origins,
        ],
    )


def create_mcp_server(trip_service, gmaps_client) -> FastMCP:
    mcp = FastMCP(
        "pathwise",
        instructions=(
            "Pathwise turns a trip plan into an interactive, editable itinerary with a "
            "map, optimized routes, and drag-and-drop editing.\n\n"
            "USE create_trip WHENEVER THE CONVERSATION IS ABOUT A REAL TRIP WITH KNOWN "
            "DATES AND A PLACE - not just when the user explicitly asks you to 'plan an "
            "itinerary'. This includes messages that look like:\n"
            "- 'What can I do/see for fun while I'm in [city] on [dates]?'\n"
            "- 'I'll be in [city] from [date] to [date], any recommendations?'\n"
            "- 'I'm going to [event] on [date], help me fill the rest of the trip'\n"
            "- explicit itinerary/vacation/road-trip planning requests\n"
            "In other words: if the user gives you a destination plus concrete dates (or "
            "a flight/event that implies dates) and wants suggestions, activities, or "
            "things to do - that IS a trip to save, even if they phrased it as a question "
            "rather than a command to 'plan a trip'. Don't wait for the word 'itinerary'.\n\n"
            "Do this proactively; the user does not need to say 'Pathwise' or ask for a "
            "map explicitly for this to be the right tool.\n\n"
            "Typical flow: call create_trip early - as soon as you know the destination "
            "and dates - even before you've filled in every activity. Use start_date/"
            "end_date from any flight or event info given (convert arrival/departure "
            "times to the stop's arrivalTime/departureTime or a note). Then, as you "
            "brainstorm activities with the user, use search_places to find real places "
            "and add_stop to add the ones they like, and optimize_day once a day has "
            "several stops. Give the user the returned share_url - opening it shows the "
            "trip on an interactive map where they can keep editing, drag stops between "
            "days, or chat with Pathwise's own assistant. Keep the trip_id and claim_token "
            "yourself so later turns edit the same trip (add_stop, move_stop, "
            "optimize_day, etc.) instead of creating a duplicate."
        ),
        transport_security=_transport_security(),
        stateless_http=True,
        streamable_http_path="/",
    )

    def _run(fn):
        """Map service errors to MCP tool errors with readable messages."""
        try:
            return fn()
        except (AuthorizationError, NotFoundError, ValidationError, ValueError) as error:
            raise ValueError(str(error))

    @mcp.tool()
    def create_trip(
        title: str,
        destination: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        days: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Save a real trip (destination + dates) into Pathwise as an interactive
        itinerary with a map - use this as soon as you know where and when,
        not only once every activity is decided.

        Trigger this for ANY message where the user names a destination and
        dates (directly or via a flight/event) and wants suggestions, things
        to do, or an itinerary - e.g. "what can I do for fun while I'm in SF
        July 24-26?" counts, not just "plan me a trip to SF". Call it early
        with just title/destination/start_date/end_date (days can be added
        later via add_stop) rather than waiting until the whole plan is final.

        days is a list like [{"date": "2026-08-01", "stops": [{"name": "Golden
        Gate Bridge", "address": "...", "lat": 37.8, "lng": -122.5}]}]. lat/lng
        are optional - stops are geocoded from name/address when missing.
        Returns trip_id and claim_token (keep both to edit the trip later) and
        share_url (give this to the user to open, view, and claim the trip).
        """
        def action():
            trip = trip_service.create_trip(
                owner_id=None,
                title=title,
                destination=destination,
                start_date=start_date,
                end_date=end_date,
                days=days,
                created_by="mcp",
            )
            return {
                "trip_id": trip.id,
                "claim_token": trip.claimToken,
                "share_url": build_share_url(trip),
                "trip": serialize_trip(trip),
            }
        return _run(action)

    @mcp.tool()
    def get_trip(trip_id: str, claim_token: Optional[str] = None) -> Dict[str, Any]:
        """Fetch a trip's full state (days, stops with ids, optimized routes)."""
        return _run(lambda: {"trip": serialize_trip(
            trip_service.get_trip(trip_id, claim_token=claim_token)
        )})

    @mcp.tool()
    def update_trip(
        trip_id: str,
        claim_token: str,
        title: Optional[str] = None,
        destination: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        days: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Update trip metadata, or replace the full day/stop structure by
        passing days (same shape as create_trip)."""
        patch: Dict[str, Any] = {}
        if title is not None:
            patch["title"] = title
        if destination is not None:
            patch["destination"] = destination
        if start_date is not None:
            patch["startDate"] = start_date
        if end_date is not None:
            patch["endDate"] = end_date
        if days is not None:
            patch["days"] = days
        return _run(lambda: {"trip": serialize_trip(
            trip_service.update_trip(trip_id, patch, claim_token=claim_token)
        )})

    @mcp.tool()
    def add_stop(
        trip_id: str,
        claim_token: str,
        day_id: str,
        name: str,
        address: Optional[str] = None,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Add a single stop to a day (day_id from get_trip). Geocodes from
        name/address when lat/lng are missing."""
        stop_data = {"name": name, "address": address, "lat": lat, "lng": lng, "notes": notes}
        return _run(lambda: {"stop": trip_service.add_stop(
            trip_id, day_id, stop_data, claim_token=claim_token
        ).to_dict()})

    @mcp.tool()
    def remove_stop(trip_id: str, claim_token: str, day_id: str, stop_id: str) -> Dict[str, Any]:
        """Remove a stop from a day (ids from get_trip)."""
        return _run(lambda: {"trip": serialize_trip(
            trip_service.remove_stop(trip_id, day_id, stop_id, claim_token=claim_token)
        )})

    @mcp.tool()
    def move_stop(
        trip_id: str,
        claim_token: str,
        stop_id: str,
        to_day_id: str,
        position: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Move a stop to another day (ids from get_trip)."""
        return _run(lambda: {"trip": serialize_trip(
            trip_service.move_stop(trip_id, stop_id, to_day_id, position, claim_token=claim_token)
        )})

    @mcp.tool()
    def optimize_day(
        trip_id: str,
        claim_token: str,
        day_id: str,
        start_stop_id: Optional[str] = None,
        end_stop_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Optimize a day's visiting order for shortest driving distance
        (Christofides TSP). Returns the day with its new route order and
        total distance in miles."""
        return _run(lambda: {"day": trip_service.optimize_day(
            trip_id, day_id,
            start_stop_id=start_stop_id,
            end_stop_id=end_stop_id,
            claim_token=claim_token,
        ).to_dict()})

    @mcp.tool()
    def search_places(query: str, near: Optional[str] = None, radius: Optional[int] = None) -> Dict[str, Any]:
        """Search Google Maps for places. near is an optional 'lat,lng' bias
        point; radius is in meters. Returns up to 5 results with coordinates
        and place ids, ready to pass to add_stop."""
        from agent import search_places as do_search
        results = do_search(query, location=near, radius=radius, gmaps_client=gmaps_client)
        return {"places": results}

    @mcp.tool()
    def export_google_maps(trip_id: str, claim_token: Optional[str] = None, day_id: Optional[str] = None) -> Dict[str, Any]:
        """Get Google Maps navigation URLs for the trip (one per day with 2+
        stops), following each day's optimized order when available."""
        return _run(lambda: trip_service.export_google_maps(
            trip_id, day_id=day_id, claim_token=claim_token
        ))

    return mcp
