SERVICE_ACCOUNT_KEY_PATH = "serviceAccountKey.json"

SUBJECTS_COLLECTION = "users"

# Firestore field name → display config.
# Only fields listed here are fetched/shown.

DISPLAYED_FIELDS = {
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

TABLE_FIELDS  = [k for k, v in DISPLAYED_FIELDS.items() if v["show_in_table"]]
DETAIL_FIELDS = [k for k, v in DISPLAYED_FIELDS.items() if v["show_in_detail"]]
COMPARE_FIELDS = [k for k, v in DISPLAYED_FIELDS.items() if v["compare"]]
ALL_FIELDS    = list(DISPLAYED_FIELDS.keys())

CHART_COLORS = [
    "#4f86c6", "#e07b39", "#4caf7d", "#b05ccc",
    "#d94f4f", "#f0c040", "#4dc9c9", "#a0a0a0",
]
