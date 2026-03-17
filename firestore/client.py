import os
import logging
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore as firebase_firestore

logger = logging.getLogger(__name__)

_APP_NAME = "test_dashboard"
_db_instance = None   # module-level cache — survives Flask reloader re-imports


class FirestoreClient:
    def __init__(self):
        pass

    def _init(self):
        global _db_instance
        if _db_instance is not None:
            return

        # Re-use the Firebase app if already initialised in this process
        try:
            app = firebase_admin.get_app(_APP_NAME)
        except Exception:
            app = self._create_app()

        _db_instance = firebase_firestore.client(app=app)
        logger.info("Firestore client initialised.")

    def _create_app(self):
        if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
            cred = credentials.ApplicationDefault()
            logger.info("Using GOOGLE_APPLICATION_CREDENTIALS env var.")
        else:
            from config import SERVICE_ACCOUNT_KEY_PATH
            if os.path.exists(SERVICE_ACCOUNT_KEY_PATH):
                cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
                logger.info("Using service account key: %s", SERVICE_ACCOUNT_KEY_PATH)
            else:
                cred = credentials.ApplicationDefault()
                logger.info("Using Application Default Credentials.")

        try:
            return firebase_admin.initialize_app(cred, name=_APP_NAME)
        except Exception:
            return firebase_admin.get_app(_APP_NAME)

    def collection(self, path: str):
        self._init()
        return _db_instance.collection(path)

    def document(self, collection: str, doc_id: str):
        self._init()
        return _db_instance.collection(collection).document(doc_id)
