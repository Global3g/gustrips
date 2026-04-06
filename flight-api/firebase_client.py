"""
Firebase Admin SDK client for accessing Firestore
"""
import os
from typing import Optional
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

load_dotenv()

_db: Optional[firestore.Client] = None
_initialized = False


def initialize_firebase():
    """Initialize Firebase Admin SDK"""
    global _db, _initialized

    if _initialized:
        return _db

    # Try to load from JSON string first (for production/Render)
    service_account_json = os.getenv('FIREBASE_SERVICE_ACCOUNT_JSON')

    if service_account_json:
        try:
            import json
            service_account_dict = json.loads(service_account_json)
            cred = credentials.Certificate(service_account_dict)
            firebase_admin.initialize_app(cred)
            _db = firestore.client()
            _initialized = True
            print("✅ Firebase Admin SDK initialized (from JSON env)")
            return _db
        except Exception as e:
            print(f"❌ Error initializing Firebase from JSON: {e}")
            return None

    # Fall back to file path (for local development)
    service_account_path = os.getenv('FIREBASE_SERVICE_ACCOUNT_PATH')

    if not service_account_path or not os.path.exists(service_account_path):
        print("⚠️  Firebase service account not found. Alerts system will not work.")
        print(f"   Looking for: {service_account_path}")
        print("   Follow instructions in SETUP_ALERTS.md")
        return None

    try:
        cred = credentials.Certificate(service_account_path)
        firebase_admin.initialize_app(cred)
        _db = firestore.client()
        _initialized = True
        print("✅ Firebase Admin SDK initialized (from file)")
        return _db
    except Exception as e:
        print(f"❌ Error initializing Firebase: {e}")
        return None


def get_db() -> Optional[firestore.Client]:
    """Get Firestore client"""
    if not _initialized:
        initialize_firebase()
    return _db
