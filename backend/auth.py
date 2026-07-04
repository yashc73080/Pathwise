from __future__ import annotations

from functools import wraps
from typing import Optional

from firebase_admin import auth as firebase_auth
from flask import g, jsonify, request


def get_bearer_token() -> Optional[str]:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    return auth_header.split("Bearer ", 1)[1].strip()


def verify_firebase_token(token: str) -> Optional[dict]:
    if not token:
        return None
    return firebase_auth.verify_id_token(token)


def current_uid(optional: bool = True) -> Optional[str]:
    token = get_bearer_token()
    if not token:
        if optional:
            return None
        raise PermissionError("Missing authorization token")
    try:
        decoded = verify_firebase_token(token)
        return decoded.get("uid") if decoded else None
    except Exception:
        if optional:
            return None
        raise


def claim_token_from_request() -> Optional[str]:
    return request.headers.get("X-Claim-Token") or request.args.get("claimToken")


def require_user(handler):
    @wraps(handler)
    def wrapped(*args, **kwargs):
        try:
            g.uid = current_uid(optional=False)
        except Exception as exc:
            return jsonify({"error": str(exc)}), 401
        return handler(*args, **kwargs)

    return wrapped
