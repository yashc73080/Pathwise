from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4


SCHEMA_VERSION = 2


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_day_id() -> str:
    return f"day_{uuid4().hex[:10]}"


def new_stop_id() -> str:
    return f"stop_{uuid4().hex[:10]}"


@dataclass
class Stop:
    id: str
    name: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    address: Optional[str] = None
    placeId: Optional[str] = None
    arrivalTime: Optional[str] = None
    departureTime: Optional[str] = None
    notes: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Stop":
        return cls(
            id=data.get("id") or new_stop_id(),
            name=data.get("name") or "Untitled stop",
            lat=data.get("lat"),
            lng=data.get("lng"),
            address=data.get("address"),
            placeId=data.get("placeId") or data.get("place_id"),
            arrivalTime=data.get("arrivalTime"),
            departureTime=data.get("departureTime"),
            notes=data.get("notes"),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "lat": self.lat,
            "lng": self.lng,
            "address": self.address,
            "placeId": self.placeId,
            "arrivalTime": self.arrivalTime,
            "departureTime": self.departureTime,
            "notes": self.notes,
        }


@dataclass
class Route:
    order: List[str]
    startStopId: Optional[str] = None
    endStopId: Optional[str] = None
    totalDistanceMiles: Optional[float] = None
    optimizedAt: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]]) -> Optional["Route"]:
        if not data:
            return None
        return cls(
            order=list(data.get("order") or []),
            startStopId=data.get("startStopId"),
            endStopId=data.get("endStopId"),
            totalDistanceMiles=data.get("totalDistanceMiles"),
            optimizedAt=data.get("optimizedAt"),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "order": self.order,
            "startStopId": self.startStopId,
            "endStopId": self.endStopId,
            "totalDistanceMiles": self.totalDistanceMiles,
            "optimizedAt": self.optimizedAt,
        }


@dataclass
class Day:
    id: str
    date: Optional[str] = None
    label: Optional[str] = None
    stops: List[Stop] = field(default_factory=list)
    route: Optional[Route] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Day":
        day = cls(
            id=data.get("id") or new_day_id(),
            date=data.get("date"),
            label=data.get("label"),
            stops=[Stop.from_dict(stop) for stop in data.get("stops", [])],
            route=Route.from_dict(data.get("route")),
        )
        day.normalize_route()
        return day

    def normalize_route(self) -> None:
        if not self.route:
            return
        stop_ids = {stop.id for stop in self.stops}
        self.route.order = [stop_id for stop_id in self.route.order if stop_id in stop_ids]
        if self.route.startStopId not in stop_ids:
            self.route.startStopId = None
        if self.route.endStopId not in stop_ids:
            self.route.endStopId = None
        if not self.route.order:
            self.route = None

    def to_dict(self) -> Dict[str, Any]:
        self.normalize_route()
        return {
            "id": self.id,
            "date": self.date,
            "label": self.label,
            "stops": [stop.to_dict() for stop in self.stops],
            "route": self.route.to_dict() if self.route else None,
        }


@dataclass
class Trip:
    id: Optional[str]
    title: str
    ownerId: Optional[str] = None
    claimToken: Optional[str] = None
    destination: Optional[str] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    visibility: str = "private"
    days: List[Day] = field(default_factory=list)
    chatSessionId: Optional[str] = None
    createdBy: str = "web"
    createdAt: Optional[Any] = None
    updatedAt: Optional[Any] = None
    schemaVersion: int = SCHEMA_VERSION
    legacyId: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any], trip_id: Optional[str] = None) -> "Trip":
        trip = cls(
            id=trip_id or data.get("id"),
            schemaVersion=data.get("schemaVersion", SCHEMA_VERSION),
            ownerId=data.get("ownerId"),
            claimToken=data.get("claimToken"),
            title=data.get("title") or data.get("name") or "Untitled Trip",
            destination=data.get("destination"),
            startDate=data.get("startDate"),
            endDate=data.get("endDate"),
            visibility=data.get("visibility") or "private",
            days=[Day.from_dict(day) for day in data.get("days", [])],
            chatSessionId=data.get("chatSessionId"),
            createdBy=data.get("createdBy") or "web",
            createdAt=data.get("createdAt"),
            updatedAt=data.get("updatedAt"),
            legacyId=data.get("legacyId"),
        )
        if not trip.days:
            trip.days = [Day(id=new_day_id(), label="Day 1")]
        trip.relabel_days()
        return trip

    def relabel_days(self) -> None:
        for index, day in enumerate(self.days):
            day.label = f"Day {index + 1}"

    def to_dict(self) -> Dict[str, Any]:
        self.relabel_days()
        return {
            "schemaVersion": self.schemaVersion,
            "ownerId": self.ownerId,
            "claimToken": self.claimToken,
            "title": self.title,
            "destination": self.destination,
            "startDate": self.startDate,
            "endDate": self.endDate,
            "visibility": self.visibility,
            "days": [day.to_dict() for day in self.days],
            "chatSessionId": self.chatSessionId,
            "createdBy": self.createdBy,
            "createdAt": self.createdAt,
            "updatedAt": self.updatedAt,
            **({"legacyId": self.legacyId} if self.legacyId else {}),
        }


def legacy_trip_to_v2(data: Dict[str, Any], legacy_id: Optional[str] = None) -> Trip:
    locations = data.get("locations") or []
    optimized_route = data.get("optimizedRoute") or []
    start_index = data.get("startIndex")
    end_index = data.get("endIndex")
    stops = [Stop.from_dict(location) for location in locations]
    day = Day(id=new_day_id(), label="Day 1", stops=stops)

    if optimized_route:
        order = []
        for index in optimized_route:
            if isinstance(index, int) and 0 <= index < len(stops):
                order.append(stops[index].id)
        if order:
            day.route = Route(
                order=order,
                startStopId=stops[start_index].id if isinstance(start_index, int) and 0 <= start_index < len(stops) else None,
                endStopId=stops[end_index].id if isinstance(end_index, int) and 0 <= end_index < len(stops) else None,
            )

    return Trip(
        id=None,
        title=data.get("name") or data.get("title") or "Untitled Trip",
        ownerId=data.get("userId"),
        days=[day],
        createdBy="web",
        createdAt=data.get("createdAt"),
        updatedAt=data.get("updatedAt"),
        legacyId=legacy_id,
    )
