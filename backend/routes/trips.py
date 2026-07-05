from __future__ import annotations

import os

from flask import Blueprint, g, jsonify, request

from auth import claim_token_from_request, current_uid, require_user
from services.trip_service import AuthorizationError, NotFoundError, TripService, ValidationError

FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "https://pathwise.web.app")


def build_share_url(trip) -> str:
    url = f"{FRONTEND_BASE_URL}/trip/?id={trip.id}"
    if trip.claimToken:
        url += f"#claim={trip.claimToken}"
    return url


def create_trips_blueprint(trip_service: TripService) -> Blueprint:
    bp = Blueprint("trips", __name__, url_prefix="/api/trips")

    @bp.errorhandler(AuthorizationError)
    def handle_auth_error(error):
        return jsonify({"error": str(error)}), 403

    @bp.errorhandler(NotFoundError)
    def handle_not_found(error):
        return jsonify({"error": str(error)}), 404

    @bp.errorhandler(ValidationError)
    def handle_validation(error):
        return jsonify({"error": str(error)}), 400

    @bp.route("", methods=["POST"])
    def create_trip():
        data = request.get_json(silent=True) or {}
        uid = current_uid(optional=True)
        trip = trip_service.create_trip(
            owner_id=uid,
            title=data.get("title") or data.get("name") or "Untitled Trip",
            destination=data.get("destination"),
            start_date=data.get("startDate"),
            end_date=data.get("endDate"),
            days=data.get("days"),
            chat_session_id=data.get("chatSessionId"),
            created_by=data.get("createdBy") or "web",
        )
        payload = {"trip": serialize_trip(trip), "shareUrl": build_share_url(trip)}
        if trip.claimToken:
            payload["claimToken"] = trip.claimToken
        return jsonify(payload), 201

    @bp.route("", methods=["GET"])
    @require_user
    def list_trips():
        return jsonify({"trips": [serialize_trip(trip) for trip in trip_service.list_trips(g.uid)]})

    @bp.route("/<trip_id>", methods=["GET"])
    def get_trip(trip_id):
        trip = trip_service.get_trip(trip_id, uid=current_uid(optional=True), claim_token=claim_token_from_request())
        return jsonify({"trip": serialize_trip(trip)})

    @bp.route("/<trip_id>", methods=["PATCH"])
    def update_trip(trip_id):
        trip = trip_service.update_trip(
            trip_id,
            request.get_json(silent=True) or {},
            uid=current_uid(optional=True),
            claim_token=claim_token_from_request(),
        )
        return jsonify({"trip": serialize_trip(trip)})

    @bp.route("/<trip_id>", methods=["DELETE"])
    def delete_trip(trip_id):
        trip_service.delete_trip(trip_id, uid=current_uid(optional=True), claim_token=claim_token_from_request())
        return jsonify({"status": "success"})

    @bp.route("/<trip_id>/claim", methods=["POST"])
    @require_user
    def claim_trip(trip_id):
        data = request.get_json(silent=True) or {}
        trip = trip_service.claim_trip(trip_id, data.get("claimToken") or claim_token_from_request(), g.uid)
        return jsonify({"trip": serialize_trip(trip)})

    @bp.route("/<trip_id>/days", methods=["POST"])
    def add_day(trip_id):
        data = request.get_json(silent=True) or {}
        day = trip_service.add_day(
            trip_id,
            date=data.get("date"),
            label=data.get("label"),
            uid=current_uid(optional=True),
            claim_token=claim_token_from_request(),
        )
        return jsonify({"day": day.to_dict()}), 201

    @bp.route("/<trip_id>/days/<day_id>", methods=["DELETE"])
    def remove_day(trip_id, day_id):
        trip = trip_service.remove_day(
            trip_id,
            day_id,
            uid=current_uid(optional=True),
            claim_token=claim_token_from_request(),
        )
        return jsonify({"trip": serialize_trip(trip)})

    @bp.route("/<trip_id>/days/<day_id>/stops", methods=["POST"])
    def add_stop(trip_id, day_id):
        stop = trip_service.add_stop(
            trip_id,
            day_id,
            request.get_json(silent=True) or {},
            uid=current_uid(optional=True),
            claim_token=claim_token_from_request(),
        )
        return jsonify({"stop": stop.to_dict()}), 201

    @bp.route("/<trip_id>/days/<day_id>/stops/<stop_id>", methods=["PATCH"])
    def update_stop(trip_id, day_id, stop_id):
        stop = trip_service.update_stop(
            trip_id,
            day_id,
            stop_id,
            request.get_json(silent=True) or {},
            uid=current_uid(optional=True),
            claim_token=claim_token_from_request(),
        )
        return jsonify({"stop": stop.to_dict()})

    @bp.route("/<trip_id>/days/<day_id>/stops/<stop_id>", methods=["DELETE"])
    def remove_stop(trip_id, day_id, stop_id):
        trip = trip_service.remove_stop(
            trip_id,
            day_id,
            stop_id,
            uid=current_uid(optional=True),
            claim_token=claim_token_from_request(),
        )
        return jsonify({"trip": serialize_trip(trip)})

    @bp.route("/<trip_id>/days/<day_id>/reorder", methods=["POST"])
    def reorder_stops(trip_id, day_id):
        data = request.get_json(silent=True) or {}
        day = trip_service.reorder_stops(
            trip_id,
            day_id,
            data.get("orderedStopIds") or [],
            uid=current_uid(optional=True),
            claim_token=claim_token_from_request(),
        )
        return jsonify({"day": day.to_dict()})

    @bp.route("/<trip_id>/stops/<stop_id>/move", methods=["POST"])
    def move_stop(trip_id, stop_id):
        data = request.get_json(silent=True) or {}
        trip = trip_service.move_stop(
            trip_id,
            stop_id,
            data.get("toDayId"),
            data.get("position"),
            uid=current_uid(optional=True),
            claim_token=claim_token_from_request(),
        )
        return jsonify({"trip": serialize_trip(trip)})

    @bp.route("/<trip_id>/days/<day_id>/optimize", methods=["POST"])
    def optimize_day(trip_id, day_id):
        data = request.get_json(silent=True) or {}
        day = trip_service.optimize_day(
            trip_id,
            day_id,
            start_stop_id=data.get("startStopId"),
            end_stop_id=data.get("endStopId"),
            uid=current_uid(optional=True),
            claim_token=claim_token_from_request(),
        )
        return jsonify({"day": day.to_dict()})

    @bp.route("/<trip_id>/export/google-maps", methods=["GET"])
    def export_google_maps(trip_id):
        return jsonify(
            trip_service.export_google_maps(
                trip_id,
                day_id=request.args.get("dayId"),
                uid=current_uid(optional=True),
                claim_token=claim_token_from_request(),
            )
        )

    return bp


def serialize_trip(trip):
    data = trip.to_dict()
    data["id"] = trip.id
    # The claim token is a write capability. It is returned once from the
    # create endpoint; every other response must not expose it to readers
    # who only have link visibility.
    data.pop("claimToken", None)
    return serialize_value(data)


def serialize_value(value):
    if isinstance(value, dict):
        return {key: serialize_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [serialize_value(item) for item in value]
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value
