# Test Results Dashboard

A Flask + Cloud Firestore dashboard for viewing and comparing test results across subjects.

## Project Structure

```
test-dashboard/
├── app.py                  # Flask routes (pages + JSON API)
├── config.py               # ⭐ Edit this to configure fields & Firestore
├── requirements.txt
├── serviceAccountKey.json  # Your Firebase credentials (not committed)
├── firestore/
│   ├── client.py           # Firebase Admin SDK wrapper
│   └── queries.py          # All Firestore read logic
├── templates/
│   ├── base.html           # Shared nav & layout
│   ├── index.html          # Subject overview table
│   ├── subject.html        # Single-subject detail
│   └── compare.html        # Side-by-side comparison
└── static/
    ├── css/dashboard.css
    └── js/
        ├── dashboard.js    # Shared utilities (formatting, chart defaults)
        ├── index.js        # Overview page
        ├── subject.js      # Detail page
        └── compare.js      # Comparison page
```

## Quick Start

### 1. Install dependencies
```bash
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Add Firebase credentials

**Option A — Service account key (local dev)**
- Download your key from Firebase Console → Project Settings → Service Accounts
- Save it as `serviceAccountKey.json` in the project root

**Option B — Environment variable (recommended for production)**
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"
```

### 3. Configure your fields

Open `config.py` and:
- Set `SUBJECTS_COLLECTION` to your Firestore collection name
- Add/edit entries in `DISPLAYED_FIELDS` for every field you want shown
- Set `show_in_table`, `show_in_detail`, `compare` flags per field
- Add `thresholds` with `warn` and `fail` values for numeric fields

### 4. Run

```bash
python app.py
```

Visit http://localhost:5000

## Firestore Document Structure

Each document in your collection should contain your test-result fields.
Only fields listed in `DISPLAYED_FIELDS` (config.py) are ever read or
returned to the browser — all other fields stay private.

Example document:
```json
{
  "subject_id": "SUB001",
  "test_date": "2024-03-15",
  "overall_score": 87.5,
  "category_a_score": 91.0,
  "category_b_score": 84.0,
  "category_c_score": 78.5,
  "status": "pass",
  "attempts": 1,
  "notes": "Strong performance in Category A",

  // These fields exist in Firestore but are never sent to the browser:
  "internal_ref": "...",
  "raw_responses": [...],
  "examiner_id": "..."
}
```

## API Reference

| Endpoint | Description |
|----------|-------------|
| `GET /api/subjects` | All subjects (supports `?sort=`, `?order=`, `?limit=`) |
| `GET /api/subjects/<id>` | Single subject detail |
| `GET /api/compare?ids=A&ids=B` | Batch fetch for comparison |
| `GET /api/stats` | Aggregate mean/min/max/std per numeric field |

## Deployment

For Cloud Run / App Engine, set `GOOGLE_APPLICATION_CREDENTIALS` and
remove the `debug=True` flag in `app.py`. Consider adding a caching layer
(Redis or Firestore cache documents) for the `/api/stats` endpoint if your
collection is large.
