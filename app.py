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


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/subject/<subject_id>")
def subject_detail(subject_id):
    return render_template("subject.html", subject_id=subject_id)


@app.route("/compare")
def compare():
    subject_ids = request.args.getlist("ids")
    return render_template("compare.html", subject_ids=subject_ids)


@app.route("/api/subjects")
def api_subjects():
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
    try:
        query = ResultsQuery(db)
        stats = query.get_aggregate_stats()
        return jsonify({"status": "ok", "data": stats})
    except Exception as e:
        logger.error("api_stats error: %s", e)
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/sessions")
def sessions():
    return render_template("sessions.html")


@app.route("/sessions/<doc_id>")
def session_detail(doc_id):
    return render_template("session_detail.html", doc_id=doc_id)


@app.route("/api/sessions")
def api_sessions_search():
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
    try:
        query  = SessionsQuery(db)
        result = query.get_session(doc_id)
        if result is None:
            return jsonify({"status": "error", "message": "Session not found"}), 404
        return jsonify({"status": "ok", "data": result})
    except Exception as e:
        logger.error("api_session_detail error: %s", e)
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/config")
def api_config():
    return jsonify({"status": "ok", "data": DISPLAYED_FIELDS})


@app.route("/api/cache/clear", methods=["POST"])
def api_cache_clear():
    ResultsQuery.clear_cache()
    SessionsQuery.clear_cache()
    return jsonify({"status": "ok", "message": "Cache cleared."})


@app.route("/api/cache/stats")
def api_cache_stats():
    return jsonify({"status": "ok", "data": {
        "subjects": ResultsQuery.cache_stats(),
        "sessions": SessionsQuery.cache_stats(),
    }})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
