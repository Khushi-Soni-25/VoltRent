# Voltride AI Modules

This folder contains isolated AI/ML code for additive Voltride features.

The existing PHP/XAMPP/MySQL application remains the source of truth. These
modules do not modify production data and do not require database migrations.

## Modules

- `recommendation/battery_recommender.py` provides an explainable dealer-level
  battery/service recommendation engine.
- `training/train_health_model.py` trains a battery health classifier from a
  clearly labelled development dataset.
- `training/train_demand_model.py` trains a demand prediction regressor from a
  clearly labelled development dataset.
- `prediction/health_predictor.py` loads a saved health model for inference.
- `prediction/demand_predictor.py` loads a saved demand model for inference.

## Data Safety

The CSV files in `datasets/` are synthetic development samples. They must not
be inserted into the production MySQL/MariaDB database.

Train models offline with:

```bash
python ml/training/train_health_model.py
python ml/training/train_demand_model.py
```

## Render deployment

The PHP endpoints in this repository start Python with `exec()`. That works
only on a server configured with PHP and Python; it cannot run from a Vercel
static deployment. Deploy this `ml` directory as a separate Render Web
Service instead.

- **Root directory:** `ml`
- **Build command:** `pip install -r requirements.txt`
- **Start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`

Set these Render environment variables:

- `ALLOWED_ORIGINS` — the exact Vercel site origin, for example
  `https://your-project.vercel.app`. Use a comma-separated list only when
  more than one known frontend origin needs access.
- `ML_DATABASE_URL` — optional but required for browser-triggered battery
  recommendations. It must point to the hosted MySQL/MariaDB database that
  contains the existing `dealers` table, in the form
  `mysql://USER:PASSWORD@HOST:3306/DATABASE`. Do not use a local XAMPP URL:
  Render cannot access it.

If you also host the existing PHP API outside Vercel, set `ML_API_URL` there
to the same Render URL. The retained PHP AI endpoints then proxy to Render
with a 5-second connection timeout and a 15-second total timeout; they no
longer execute local Python.

After Render supplies the public service URL, set `mlApiBaseUrl` in
`js/ml-config.js` to that URL and redeploy the Vercel frontend. The URL is
public and contains no credential. Keep database credentials in Render only.

The service exposes:

- `GET /health`
- `POST /predict/health`
- `POST /predict/demand`
- `POST /recommendations/battery`
