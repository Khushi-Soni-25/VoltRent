"""Train the demand prediction regressor from a development CSV.

The bundled CSV is synthetic sample data for development only. This script does
not read or write the production MySQL database.
"""

from __future__ import annotations

import json
from pathlib import Path
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


ROOT = Path(__file__).resolve().parents[1]
DATASET = ROOT / "datasets" / "demand_sample.csv"
MODEL_PATH = ROOT / "models" / "demand_model.joblib"
METRICS_PATH = ROOT / "models" / "demand_metrics.json"
TARGET = "demand"


def build_preprocessor() -> ColumnTransformer:
    numeric = ["hour", "day_of_week", "is_weekend", "month", "historical_request_count"]
    categorical = ["location", "request_type"]
    return ColumnTransformer(
        [
            ("num", StandardScaler(), numeric),
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical),
        ]
    )


def build_models() -> dict[str, Pipeline]:
    return {
        "linear_regression": Pipeline(
            [("preprocess", build_preprocessor()), ("model", LinearRegression())]
        ),
        "random_forest_regressor": Pipeline(
            [
                ("preprocess", build_preprocessor()),
                ("model", RandomForestRegressor(n_estimators=100, random_state=42)),
            ]
        ),
    }


def evaluate(y_true, y_pred) -> dict:
    mse = mean_squared_error(y_true, y_pred)
    return {
        "mae": round(float(mean_absolute_error(y_true, y_pred)), 4),
        "rmse": round(float(np.sqrt(mse)), 4),
        "r2": round(float(r2_score(y_true, y_pred)), 4),
    }


def train() -> dict:
    df = pd.read_csv(DATASET)
    if TARGET not in df.columns:
        raise ValueError(f"Missing target column: {TARGET}")

    x = df.drop(columns=[TARGET, "date"])
    y = df[TARGET]
    x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.25, random_state=42)

    results = {}
    best_name = None
    best_mae = float("inf")
    best_model = None

    for name, pipeline in build_models().items():
        pipeline.fit(x_train, y_train)
        metrics = evaluate(y_test, pipeline.predict(x_test))
        results[name] = metrics
        if metrics["mae"] < best_mae:
            best_name = name
            best_mae = metrics["mae"]
            best_model = pipeline

    assert best_name is not None and best_model is not None
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {
            "model": best_model,
            "model_name": best_name,
            "features": list(x.columns),
            "target": TARGET,
            "dataset": str(DATASET),
            "dataset_type": "SYNTHETIC",
            "production_validated": False,
            "note": "These models were trained using synthetic development data and are NOT production-validated.",
        },
        MODEL_PATH,
    )

    summary = {
        "selected_model": best_name,
        "dataset": str(DATASET),
        "dataset_type": "SYNTHETIC",
        "training_date": datetime.now(timezone.utc).isoformat(),
        "production_validated": False,
        "note": "These models were trained using synthetic development data and are NOT production-validated.",
        "features": list(x.columns),
        "target": TARGET,
        "rows": int(len(df)),
        "results": results,
    }
    METRICS_PATH.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


if __name__ == "__main__":
    print(json.dumps(train(), indent=2))
