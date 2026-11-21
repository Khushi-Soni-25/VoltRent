"""Explainable dealer-level recommendation for Voltride.

This is a scoring engine, not a trained ML model. It works with the current
dealer-level stock architecture and does not require individual battery records.
"""

from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass
from typing import Any


SERVICE_STOCK_FIELD = {
    "replacement": "bat_stock",
    "swap": "bat_stock",
    "charger": "chg_stock",
}


@dataclass(frozen=True)
class RecommendationRequest:
    service_type: str = "replacement"
    user_lat: float | None = None
    user_lng: float | None = None
    priority: str = "normal"
    required_stock: int = 1


def _as_float(value: Any) -> float | None:
    try:
        if value in ("", None):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _as_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius_km = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return radius_km * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def parse_request(payload: dict[str, Any]) -> RecommendationRequest:
    if not isinstance(payload, dict):
        payload = {}
    return RecommendationRequest(
        service_type=str(payload.get("service_type") or payload.get("stype") or "replacement"),
        user_lat=_as_float(payload.get("user_lat") or payload.get("lat")),
        user_lng=_as_float(payload.get("user_lng") or payload.get("lng")),
        priority=str(payload.get("priority") or "normal"),
        required_stock=max(1, _as_int(payload.get("required_stock"), 1)),
    )


def score_dealer(dealer: dict[str, Any], request: RecommendationRequest) -> dict[str, Any] | None:
    stock_field = SERVICE_STOCK_FIELD.get(request.service_type, "bat_stock")
    stock = _as_int(dealer.get(stock_field) or dealer.get("bat") or dealer.get("stock"), 0)

    if stock < request.required_stock:
        return None

    score = 50.0
    reasons: list[str] = []
    explanations: list[str] = []

    stock_score = min(25.0, stock * 2.5)
    score += stock_score
    reasons.append(f"{stock} available item(s) for {request.service_type}")
    stock_label = "batteries" if request.service_type in ("replacement", "swap") else "chargers"
    explanations.append(f"{stock} {stock_label} available for this request")
    if stock >= 3:
        explanations.append("Good availability for the selected service")

    dealer_lat = _as_float(dealer.get("lat"))
    dealer_lng = _as_float(dealer.get("lng"))
    distance_km = None
    if (
        request.user_lat is not None
        and request.user_lng is not None
        and dealer_lat is not None
        and dealer_lng is not None
    ):
        distance_km = haversine_km(request.user_lat, request.user_lng, dealer_lat, dealer_lng)
        distance_score = max(0.0, 25.0 - min(distance_km, 25.0))
        score += distance_score
        reasons.append(f"approximately {distance_km:.1f} km from user")
        explanations.append(f"Approximately {distance_km:.1f} km from your location")
    else:
        score += 8.0
        reasons.append("location distance unavailable, neutral location score applied")
        explanations.append("Dealer distance is unavailable, so location was scored neutrally")

    if request.priority == "emergency":
        score += 5.0 if stock >= 3 else -5.0
        reasons.append("emergency request favors higher stock")
        explanations.append("Emergency priority favors dealers with stronger available stock")
    elif request.priority == "express":
        score += 3.0 if stock >= 2 else -2.0
        reasons.append("express request favors nearby available stock")
        explanations.append("Express priority favors nearby dealers with available stock")
    else:
        explanations.append("Suitable for the selected priority")

    normalized = max(0, min(100, round(score)))
    return {
        "dealer_id": dealer.get("id"),
        "dealer_name": dealer.get("name"),
        "score": normalized,
        "stock": stock,
        "distance_km": round(distance_km, 2) if distance_km is not None else None,
        "reasons": reasons,
        "explanations": explanations,
    }


def recommend(payload: dict[str, Any], dealers: list[dict[str, Any]]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        payload = {}
    if not isinstance(dealers, list):
        dealers = []
    request = parse_request(payload)
    scored = [
        result
        for dealer in dealers
        if (result := score_dealer(dealer, request)) is not None
    ]
    scored.sort(key=lambda item: item["score"], reverse=True)

    if not scored:
        return {
            "status": "no_recommendation",
            "message": "No dealer has enough available stock for this request.",
            "recommendation": None,
            "alternatives": [],
        }

    best = scored[0]
    return {
        "status": "ok",
        "recommended_dealer_id": best["dealer_id"],
        "score": best["score"],
        "reason": "; ".join(best["reasons"]),
        "recommendation": best,
        "alternatives": scored[1:4],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", help="JSON payload with request and dealers")
    parser.add_argument("--input-file", help="Path to JSON payload with request and dealers")
    args = parser.parse_args()
    if args.input_file:
        with open(args.input_file, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
    elif args.input:
        payload = json.loads(args.input)
    else:
        raise ValueError("--input or --input-file is required")
    result = recommend(payload.get("request", payload), payload.get("dealers", []))
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
