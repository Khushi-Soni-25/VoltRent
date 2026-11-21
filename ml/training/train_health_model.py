"""Train the battery health classifier from a development CSV.

The bundled CSV is synthetic sample data for development only. This script does
not read or write the production MySQL database.
"""

from __future__ import annotations

import json
from pathlib import Path
from datetime import datetime, timezone

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier


ROOT = Path(__file__).resolve().parents[1]
DATASET = ROOT / "datasets" / "battery_health_sample.csv"
MODEL_PATH = ROOT / "models" / "battery_health_model.joblib"
METRICS_PATH = ROOT / "models" / "battery_health_metrics.json"
TARGET = "health_status"


def build_models() -> dict[str, Pipeline]:
    numeric_features = [
        "battery_age_months",
        "charging_cycles",
        "average_temperature",
        "voltage",
        "current_capacity",
        "usage_hours",
        "maintenance_count",
    ]
    scaled = ColumnTransformer([("num", StandardScaler(), numeric_features)])
    passthrough = ColumnTransformer([("num", "passthrough", numeric_features)])

    return {
        "logistic_regression": Pipeline(
            [
                ("preprocess", scaled),
                ("model", LogisticRegression(max_iter=1000, random_state=42)),
            ]
        ),
        "decision_tree": Pipeline(
            [
                ("preprocess", passthrough),
                ("model", DecisionTreeClassifier(max_depth=5, random_state=42)),
            ]
        ),
        "random_forest": Pipeline(
            [
                ("preprocess", passthrough),
                ("model", RandomForestClassifier(n_estimators=100, random_state=42)),
            ]
        ),
    }


def evaluate(y_true, y_pred) -> dict:
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_true, y_pred, average="weighted", zero_division=0
    )
    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "precision": round(float(precision), 4),
        "recall": round(float(recall), 4),
        "f1_score": round(float(f1), 4),
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=["Good", "Medium", "Poor"]).tolist(),
        "labels": ["Good", "Medium", "Poor"],
    }


def train() -> dict:
    df = pd.read_csv(DATASET)
    if TARGET not in df.columns:
        raise ValueError(f"Missing target column: {TARGET}")

    x = df.drop(columns=[TARGET])
    y = df[TARGET]
    x_train, x_test, y_train, y_test = train_test_split(
        x, y, test_size=0.3, random_state=42, stratify=y
    )

    results = {}
    best_name = None
    best_score = -1.0
    best_model = None

    for name, pipeline in build_models().items():
        pipeline.fit(x_train, y_train)
        metrics = evaluate(y_test, pipeline.predict(x_test))
        results[name] = metrics
        if metrics["f1_score"] > best_score:
            best_name = name
            best_score = metrics["f1_score"]
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
