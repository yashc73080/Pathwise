from __future__ import annotations

from typing import Dict, List, Optional
from urllib.parse import quote_plus

from models import Day, Trip


def export_google_maps(trip: Trip, day_id: Optional[str] = None) -> Dict[str, List[Dict[str, str]]]:
    days = [day for day in trip.days if day.id == day_id] if day_id else trip.days
    return {"urls": [_day_google_maps_url(day) for day in days if len(day.stops) >= 2]}


def _day_google_maps_url(day: Day) -> Dict[str, str]:
    stops_by_id = {stop.id: stop for stop in day.stops}
    ordered_stops = [stops_by_id[stop_id] for stop_id in day.route.order if stop_id in stops_by_id] if day.route else day.stops
    origin = _stop_query(ordered_stops[0])
    destination = _stop_query(ordered_stops[-1])
    waypoints = [_stop_query(stop) for stop in ordered_stops[1:-1]]

    url = f"https://www.google.com/maps/dir/?api=1&travelmode=driving&origin={origin}&destination={destination}"
    if waypoints:
        url += f"&waypoints={quote_plus('|'.join(waypoints))}"
    return {"dayId": day.id, "url": url}


def _stop_query(stop) -> str:
    if stop.lat is not None and stop.lng is not None:
        return quote_plus(f"{stop.lat},{stop.lng}")
    return quote_plus(stop.address or stop.name)
