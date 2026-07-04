"""
One-time migration from legacy itineraries/* docs to v2 trips/* docs.

Run from backend/ with the same Firebase Admin credentials used by app.py:
    python scripts/migrate_itineraries.py --dry-run
    python scripts/migrate_itineraries.py
"""
from __future__ import annotations

import argparse
import os
import sys

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import credentials, firestore

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from models import legacy_trip_to_v2  # noqa: E402


def initialize_firestore():
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env.local")
    load_dotenv(env_path)

    if not firebase_admin._apps:
        creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if creds_path:
            cred = credentials.Certificate(creds_path.strip())
        else:
            cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)
    return firestore.client()


def existing_legacy_ids(db):
    migrated = set()
    for doc in db.collection("trips").where("schemaVersion", "==", 2).stream():
        legacy_id = doc.to_dict().get("legacyId")
        if legacy_id:
            migrated.add(legacy_id)
    return migrated


def migrate(dry_run: bool):
    db = initialize_firestore()
    already_migrated = existing_legacy_ids(db)
    created = 0
    skipped = 0

    for legacy_doc in db.collection("itineraries").stream():
        if legacy_doc.id in already_migrated:
            skipped += 1
            continue

        trip = legacy_trip_to_v2(legacy_doc.to_dict(), legacy_id=legacy_doc.id)
        data = trip.to_dict()
        data["createdAt"] = data.get("createdAt") or firestore.SERVER_TIMESTAMP
        data["updatedAt"] = firestore.SERVER_TIMESTAMP

        if dry_run:
            print(f"DRY RUN: would migrate itineraries/{legacy_doc.id} -> trips/<auto> ({trip.title})")
        else:
            db.collection("trips").document().set(data)
            print(f"Migrated itineraries/{legacy_doc.id}")
        created += 1

    print(f"Done. created={created} skipped={skipped} dry_run={dry_run}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    migrate(dry_run=args.dry_run)
