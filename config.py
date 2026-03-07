"""
config.py — Central configuration for the Test Results Dashboard.

Edit this file to:
  - Point to the correct Firestore collection
  - Choose which fields to display (from the many stored in Firestore)
  - Set display labels, units, and formatting hints
  - Configure colour thresholds for pass/fail colouring
"""

# ---------------------------------------------------------------------------
# Firestore
# ---------------------------------------------------------------------------

# Path to your Firebase service account key JSON file.
# Set the GOOGLE_APPLICATION_CREDENTIALS env variable instead for production.
SERVICE_ACCOUNT_KEY_PATH = "serviceAccountKey.json"

# Top-level Firestore collection that holds subject documents.
SUBJECTS_COLLECTION = "users"

# ---------------------------------------------------------------------------
# Fields
# ---------------------------------------------------------------------------
# Each entry maps a Firestore field name → display config.
# Only fields listed here will be fetched and shown; all others are ignored.
#
# Keys:
#   label      — human-readable column header
#   unit       — appended after the value (set "" if not applicable)
#   fmt        — "number" | "percent" | "text" | "date"
#   show_in_table  — include in the subjects overview table
#   show_in_detail — include in the subject detail card
#   compare    — include in the comparison chart
#   thresholds — optional dict with "warn" and "fail" numeric values
#                (values BELOW warn are yellow, BELOW fail are red)

DISPLAYED_FIELDS = {
    # ---- Identifiers ----
    "EVNT_CNT": {
        "label": "Events Completed",
        "unit": "",
        "fmt": "number",
        "show_in_table": True,
        "show_in_detail": True,
        "compare": False,
    },
    "TXN_CNT": {
        "label": "Transactions Completed",
        "unit": "",
        "fmt": "number",
        "show_in_table": True,
        "show_in_detail": True,
        "compare": False,
    },

    # ---- Core scores ----
    "score": {
        "label": "Overall Score",
        "unit": "",
        "fmt": "number",
        "show_in_table": True,
        "show_in_detail": True,
        "compare": True,
    },

    "email": {
        "label": "Tester Email",
        "unit": "",
        "fmt": "text",
        "show_in_table": True,
        "show_in_detail": True,
        "compare": True,
    }

}

# Convenience lists derived from DISPLAYED_FIELDS
TABLE_FIELDS  = [k for k, v in DISPLAYED_FIELDS.items() if v["show_in_table"]]
DETAIL_FIELDS = [k for k, v in DISPLAYED_FIELDS.items() if v["show_in_detail"]]
COMPARE_FIELDS = [k for k, v in DISPLAYED_FIELDS.items() if v["compare"]]
ALL_FIELDS    = list(DISPLAYED_FIELDS.keys())

# ---------------------------------------------------------------------------
# Chart defaults
# ---------------------------------------------------------------------------

CHART_COLORS = [
    "#4f86c6", "#e07b39", "#4caf7d", "#b05ccc",
    "#d94f4f", "#f0c040", "#4dc9c9", "#a0a0a0",
]
