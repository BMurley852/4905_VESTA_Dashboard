"""
Test Results Dashboard
Flask application with Cloud Firestore integration
"""

from flask import Flask, render_template, jsonify, request
from firestore.client import FirestoreClient
from firestore.queries import ResultsQuery
from firestore.sessions import SessionsQuery
from config import DISPLAYED_FIELDS
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Initialize Firestore client (lazy — connects on first use)
db = FirestoreClient()


# ---------------------------------------------------------------------------
# Page routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    """Dashboard home — overview of all subjects."""
    return render_template("index.html")


@app.route("/subject/<subject_id>")
def subject_detail(subject_id):
    """Detailed results page for a single subject."""
    return render_template("subject.html", subject_id=subject_id)


@app.route("/compare")
def compare():
    """Side-by-side comparison view for selected subjects."""
    subject_ids = request.args.getlist("ids")
    return render_template("compare.html", subject_ids=subject_ids)


# ---------------------------------------------------------------------------
# JSON API routes (consumed by the frontend via fetch)
# ---------------------------------------------------------------------------

@app.route("/api/subjects")
def api_subjects():
    """
    Return a list of all subjects with their summary stats.

    Query params:
        sort  — field to sort by (default: subject_id)
        order — asc | desc (default: asc)
        limit — max records (default: 100)
    """
    sort_by = request.args.get("sort", "subject_id")
    order   = request.args.get("order", "asc")
    limit   = int(request.args.get("limit", 100))

    try:
        query   = ResultsQuery(db)
        subjects = query.get_all_subjects(sort_by=sort_by, order=order, limit=limit)
        return jsonify({"status": "ok", "data": subjects})
    except Exception as e:
        logger.error("api_subjects error: %s", e)
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/subjects/<subject_id>")
def api_subject_detail(subject_id):
    """
    Return full test results for a single subject.
    Only the fields defined in DISPLAYED_FIELDS (config.py) are returned.
    """
    try:
        query  = ResultsQuery(db)
        result = query.get_subject(subject_id)
        if result is None:
            return jsonify({"status": "error", "message": "Subject not found"}), 404
        return jsonify({"status": "ok", "data": result})
    except Exception as e:
        logger.error("api_subject_detail error: %s", e)
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/compare")
def api_compare():
    """
    Return side-by-side data for multiple subjects.

    Query params:
        ids — repeated param, e.g. ?ids=SUB001&ids=SUB002
    """
    subject_ids = request.args.getlist("ids")
    if not subject_ids:
        return jsonify({"status": "error", "message": "No subject IDs provided"}), 400

    try:
        query   = ResultsQuery(db)
        results = query.get_subjects_batch(subject_ids)
        return jsonify({"status": "ok", "data": results})
    except Exception as e:
        logger.error("api_compare error: %s", e)
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/stats")
def api_stats():
    """Return aggregate statistics across all subjects (mean, min, max, std)."""
    try:
        query = ResultsQuery(db)
        stats = query.get_aggregate_stats()
        return jsonify({"status": "ok", "data": stats})
    except Exception as e:
        logger.error("api_stats error: %s", e)
        return jsonify({"status": "error", "message": str(e)}), 500


# ---------------------------------------------------------------------------
# Sessions (newData collection)
# ---------------------------------------------------------------------------

@app.route("/sessions")
def sessions():
    """Session explorer — search by email or user ID."""
    return render_template("sessions.html")


@app.route("/sessions/<doc_id>")
def session_detail(doc_id):
    """Decision-flow detail for a single session document."""
    return render_template("session_detail.html", doc_id=doc_id)


@app.route("/api/sessions")
def api_sessions_search():
    """
    Search newData by email prefix or exact user_id.
    Query params:
        q — search string (required)
    """
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify({"status": "error", "message": "q parameter required"}), 400
    try:
        query   = SessionsQuery(db)
        results = query.search(q)
        return jsonify({"status": "ok", "data": results})
    except Exception as e:
        logger.error("api_sessions_search error: %s", e)
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/sessions/<doc_id>")
def api_session_detail(doc_id):
    """Return a fully parsed session document."""
    try:
        query  = SessionsQuery(db)
        result = query.get_session(doc_id)
        if result is None:
            return jsonify({"status": "error", "message": "Session not found"}), 404
        return jsonify({"status": "ok", "data": result})
    except Exception as e:
        logger.error("api_session_detail error: %s", e)
        return jsonify({"status": "error", "message": str(e)}), 500


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

@app.route("/api/config")
def api_config():
    """Expose field metadata so the frontend can drive charts and labels."""
    return jsonify({"status": "ok", "data": DISPLAYED_FIELDS})


# ---------------------------------------------------------------------------
# Cache management
# ---------------------------------------------------------------------------

@app.route("/api/cache/clear", methods=["POST"])
def api_cache_clear():
    """Flush all cached query results (useful after data updates)."""
    ResultsQuery.clear_cache()
    SessionsQuery.clear_cache()
    return jsonify({"status": "ok", "message": "Cache cleared."})


@app.route("/api/cache/stats")
def api_cache_stats():
    """Return cache hit/miss/size statistics for all caches."""
    return jsonify({"status": "ok", "data": {
        "subjects": ResultsQuery.cache_stats(),
        "sessions": SessionsQuery.cache_stats(),
    }})


# ---------------------------------------------------------------------------
# Dev entry-point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app.run(debug=True, port=5000)
