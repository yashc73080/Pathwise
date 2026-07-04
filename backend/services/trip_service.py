from __future__ import annotations

import secrets
from typing import Any, Dict, List, Optional

from christofides import route_total_distance, tsp
from models import Day, Route, Stop, Trip, new_day_id, now_iso
from services.export_service import export_google_maps
from services.trip_repository import TripRepository


class AuthorizationError(Exception):
    pass


class NotFoundError(Exception):
    pass


class ValidationError(Exception):
    pass


class TripService:
    def __init__(self, repository: TripRepository, gmaps_client=None):
        self.repository = repository
        self.gmaps = gmaps_client

    def create_trip(
        self,
        owner_id: Optional[str],
        title: str,
        destination: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        days: Optional[List[Dict[str, Any]]] = None,
        chat_session_id: Optional[str] = None,
        created_by: str = "web",
    ) -> Trip:
        trip_days = [Day.from_dict(day) for day in days] if days else [Day(id=new_day_id(), label="Day 1")]
        trip = Trip(
            id=None,
            ownerId=owner_id,
            claimToken=None if owner_id else secrets.token_urlsafe(24),
            title=title or "Untitled Trip",
            destination=destination,
            startDate=start_date,
            endDate=end_date,
            visibility="private" if owner_id else "link",
            days=trip_days,
            chatSessionId=chat_session_id,
            createdBy=created_by,
        )
        for day in trip.days:
            for index, stop in enumerate(day.stops):
                day.stops[index] = self._geocode_stop_if_needed(stop)
        return self.repository.create(trip)

    def get_trip(self, trip_id: str, uid: Optional[str] = None, claim_token: Optional[str] = None, write: bool = False) -> Trip:
        trip = self._require_trip(trip_id)
        self.authorize(trip, uid=uid, claim_token=claim_token, write=write)
        return trip

    def list_trips(self, owner_id: str) -> List[Trip]:
        return self.repository.list_for_owner(owner_id)

    def update_trip(self, trip_id: str, patch: Dict[str, Any], uid: Optional[str] = None, claim_token: Optional[str] = None) -> Trip:
        trip = self.get_trip(trip_id, uid=uid, claim_token=claim_token, write=True)
        for field_name in ("title", "destination", "startDate", "endDate", "visibility", "chatSessionId"):
            if field_name in patch:
                setattr(trip, field_name, patch[field_name])
        return self.repository.update(trip)

    def delete_trip(self, trip_id: str, uid: Optional[str] = None, claim_token: Optional[str] = None) -> None:
        trip = self.get_trip(trip_id, uid=uid, claim_token=claim_token, write=True)
        self.repository.delete(trip.id)

    def claim_trip(self, trip_id: str, claim_token: str, uid: str) -> Trip:
        trip = self._require_trip(trip_id)
        if not claim_token or claim_token != trip.claimToken:
            raise AuthorizationError("Invalid claim token")
        trip.ownerId = uid
        trip.visibility = "private"
        return self.repository.update(trip)

    def add_day(
        self,
        trip_id: str,
        date: Optional[str] = None,
        label: Optional[str] = None,
        uid: Optional[str] = None,
        claim_token: Optional[str] = None,
    ) -> Day:
        trip = self.get_trip(trip_id, uid=uid, claim_token=claim_token, write=True)
        day = Day(id=new_day_id(), date=date, label=label or f"Day {len(trip.days) + 1}")
        trip.days.append(day)
        self.repository.update(trip)
        return day

    def remove_day(self, trip_id: str, day_id: str, uid: Optional[str] = None, claim_token: Optional[str] = None) -> Trip:
        trip = self.get_trip(trip_id, uid=uid, claim_token=claim_token, write=True)
        trip.days = [day for day in trip.days if day.id != day_id]
        if not trip.days:
            trip.days.append(Day(id=new_day_id(), label="Day 1"))
        return self.repository.update(trip)

    def add_stop(
        self,
        trip_id: str,
        day_id: str,
        stop_data: Dict[str, Any],
        uid: Optional[str] = None,
        claim_token: Optional[str] = None,
    ) -> Stop:
        trip = self.get_trip(trip_id, uid=uid, claim_token=claim_token, write=True)
        day = self._require_day(trip, day_id)
        stop = self._geocode_stop_if_needed(Stop.from_dict(stop_data))
        day.stops.append(stop)
        day.route = None
        self.repository.update(trip)
        return stop

    def update_stop(
        self,
        trip_id: str,
        day_id: str,
        stop_id: str,
        patch: Dict[str, Any],
        uid: Optional[str] = None,
        claim_token: Optional[str] = None,
    ) -> Stop:
        trip = self.get_trip(trip_id, uid=uid, claim_token=claim_token, write=True)
        day = self._require_day(trip, day_id)
        stop = self._require_stop(day, stop_id)
        for field_name in ("name", "lat", "lng", "address", "placeId", "arrivalTime", "departureTime", "notes"):
            if field_name in patch:
                setattr(stop, field_name, patch[field_name])
        day.normalize_route()
        self.repository.update(trip)
        return stop

    def remove_stop(
        self,
        trip_id: str,
        day_id: str,
        stop_id: str,
        uid: Optional[str] = None,
        claim_token: Optional[str] = None,
    ) -> Trip:
        trip = self.get_trip(trip_id, uid=uid, claim_token=claim_token, write=True)
        day = self._require_day(trip, day_id)
        day.stops = [stop for stop in day.stops if stop.id != stop_id]
        day.normalize_route()
        return self.repository.update(trip)

    def reorder_stops(
        self,
        trip_id: str,
        day_id: str,
        ordered_stop_ids: List[str],
        uid: Optional[str] = None,
        claim_token: Optional[str] = None,
    ) -> Day:
        trip = self.get_trip(trip_id, uid=uid, claim_token=claim_token, write=True)
        day = self._require_day(trip, day_id)
        by_id = {stop.id: stop for stop in day.stops}
        if set(ordered_stop_ids) != set(by_id):
            raise ValidationError("ordered_stop_ids must include each stop exactly once")
        day.stops = [by_id[stop_id] for stop_id in ordered_stop_ids]
        day.route = Route(order=ordered_stop_ids, optimizedAt=now_iso())
        self.repository.update(trip)
        return day

    def move_stop(
        self,
        trip_id: str,
        stop_id: str,
        to_day_id: str,
        position: Optional[int] = None,
        uid: Optional[str] = None,
        claim_token: Optional[str] = None,
    ) -> Trip:
        trip = self.get_trip(trip_id, uid=uid, claim_token=claim_token, write=True)
        stop = None
        for day in trip.days:
            for existing in list(day.stops):
                if existing.id == stop_id:
                    stop = existing
                    day.stops.remove(existing)
                    day.normalize_route()
                    break
            if stop:
                break
        if not stop:
            raise NotFoundError("Stop not found")
        target_day = self._require_day(trip, to_day_id)
        insert_at = len(target_day.stops) if position is None else max(0, min(position, len(target_day.stops)))
        target_day.stops.insert(insert_at, stop)
        target_day.route = None
        return self.repository.update(trip)

    def optimize_day(
        self,
        trip_id: str,
        day_id: str,
        start_stop_id: Optional[str] = None,
        end_stop_id: Optional[str] = None,
        uid: Optional[str] = None,
        claim_token: Optional[str] = None,
    ) -> Day:
        trip = self.get_trip(trip_id, uid=uid, claim_token=claim_token, write=True)
        day = self._require_day(trip, day_id)
        if len(day.stops) < 2:
            raise ValidationError("At least two stops are required to optimize a day")
        stop_ids = [stop.id for stop in day.stops]
        start_index = stop_ids.index(start_stop_id) if start_stop_id in stop_ids else 0
        end_index = stop_ids.index(end_stop_id) if end_stop_id in stop_ids else None
        stop_dicts = [stop.to_dict() for stop in day.stops]
        optimized = tsp(stop_dicts, start_index=start_index, end_index=end_index, gmaps_client=self.gmaps)
        order = [stop["id"] for stop in optimized]
        if len(order) > 1 and order[0] == order[-1]:
            order = order[:-1]
        total_distance = route_total_distance(optimized, gmaps_client=self.gmaps)
        day.route = Route(
            order=order,
            startStopId=order[0] if order else None,
            endStopId=order[-1] if order else None,
            totalDistanceMiles=round(total_distance, 1),
            optimizedAt=now_iso(),
        )
        self.repository.update(trip)
        return day

    def export_google_maps(
        self,
        trip_id: str,
        day_id: Optional[str] = None,
        uid: Optional[str] = None,
        claim_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        trip = self.get_trip(trip_id, uid=uid, claim_token=claim_token, write=False)
        if day_id:
            self._require_day(trip, day_id)
        return export_google_maps(trip, day_id=day_id)

    def authorize(self, trip: Trip, uid: Optional[str], claim_token: Optional[str], write: bool) -> None:
        if uid and trip.ownerId == uid:
            return
        if claim_token and trip.claimToken and claim_token == trip.claimToken:
            return
        if not write and trip.visibility == "link":
            return
        raise AuthorizationError("Unauthorized")

    def _require_trip(self, trip_id: str) -> Trip:
        trip = self.repository.get(trip_id)
        if not trip:
            raise NotFoundError("Trip not found")
        return trip

    def _require_day(self, trip: Trip, day_id: str) -> Day:
        for day in trip.days:
            if day.id == day_id:
                return day
        raise NotFoundError("Day not found")

    def _require_stop(self, day: Day, stop_id: str) -> Stop:
        for stop in day.stops:
            if stop.id == stop_id:
                return stop
        raise NotFoundError("Stop not found")

    def _geocode_stop_if_needed(self, stop: Stop) -> Stop:
        if (stop.lat is not None and stop.lng is not None) or not self.gmaps:
            return stop
        query = stop.address or stop.name
        if not query:
            return stop
        result = self.gmaps.geocode(query)
        if result:
            location = result[0].get("geometry", {}).get("location", {})
            stop.lat = location.get("lat")
            stop.lng = location.get("lng")
            stop.address = stop.address or result[0].get("formatted_address")
            stop.placeId = stop.placeId or result[0].get("place_id")
        return stop
