"""Battery health prediction helper for saved offline models."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import joblib
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "models" / "battery_health_model.joblib"


def load_model(model_path: Path = MODEL_PATH) -> dict[str, Any]:
    if not model_path.exists():
        raise FileNotFoundError(f"Battery health model not found: {model_path}")
    return joblib.load(model_path)


def predict_health(features: dict[str, Any], model_path: Path = MODEL_PATH) -> dict[str, Any]:
    bundle = load_model(model_path)
    required = bundle["features"]
    missing = [field for field in required if field not in features]
    if missing:
        raise ValueError(f"Missing required feature(s): {', '.join(missing)}")

    row = pd.DataFrame([{field: features[field] for field in required}])
    model = bundle["model"]
    label = model.predict(row)[0]
    probabilities = {}
    if hasattr(model, "predict_proba"):
        classes = list(model.classes_)
        probabilities = {
            str(cls): round(float(prob), 4)
            for cls, prob in zip(classes, model.predict_proba(row)[0])
        }

    return {
        "status": "ok",
        "prediction": str(label),
        "model": bundle["model_name"],
        "probabilities": probabilities,
        "dataset_type": bundle.get("dataset_type"),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", help="JSON feature payload")
    parser.add_argument("--input-file", help="Path to JSON feature payload")
    args = parser.parse_args()
    try:
        if args.input_file:
            with open(args.input_file, "r", encoding="utf-8") as handle:
                payload = json.load(handle)
        elif args.input:
            payload = json.loads(args.input)
        else:
            raise ValueError("--input or --input-file is required")
        result = predict_health(payload)
    except Exception as exc:
        result = {"status": "error", "message": str(exc)}
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
