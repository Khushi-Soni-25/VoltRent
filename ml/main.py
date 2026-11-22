"""Render-ready API for Voltrent's existing ML models."""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import Any
from urllib.parse import unquote, urlparse

import pymysql
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

from prediction.demand_predictor import load_model as load_demand_model
from prediction.demand_predictor import predict_demand
from prediction.health_predictor import load_model as load_health_model
from prediction.health_predictor import predict_health
from recommendation.battery_recommender import recommend


logger = logging.getLogger(__name__)
DATABASE_URL = os.getenv("ML_DATABASE_URL", "").strip()


def allowed_origins() -> list[str]:
    """Use only explicitly configured browser origins; never default to '*'."""
    return [
        origin.strip().rstrip("/")
        for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
        if origin.strip()
    ]


@asynccontextmanager
async def lifespan(_: FastAPI):
    load_health_model()
    load_demand_model()
    yield


app = FastAPI(title="Voltrent ML API", version="1.0.0", lifespan=lifespan)
origins = allowed_origins()
if origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )


class HealthFeatures(BaseModel):
    battery_age_months: float = Field(ge=0, le=1_200)
    charging_cycles: float = Field(ge=0, le=100_000)
    average_temperature: float = Field(ge=-80, le=150)
    voltage: float = Field(gt=0, le=2_000)
    current_capacity: float = Field(ge=0, le=100)
    usage_hours: float = Field(ge=0, le=1_000_000)
    maintenance_count: int = Field(ge=0, le=100_000)


class DemandFeatures(BaseModel):
    hour: int = Field(ge=0, le=23)
    day_of_week: int = Field(ge=0, le=6)
    is_weekend: int = Field(ge=0, le=1)
    month: int = Field(ge=1, le=12)
    location: str = Field(min_length=1, max_length=120)
    request_type: str = Field(min_length=1, max_length=60)
    historical_request_count: int = Field(ge=0, le=1_000_000)


class RecommendationRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    service_type: str = Field(default="replacement", min_length=1, max_length=60)
    user_lat: float | None = Field(default=None, ge=-90, le=90)
    user_lng: float | None = Field(default=None, ge=-180, le=180)
    priority: str = Field(default="normal", min_length=1, max_length=30)
    required_stock: int = Field(default=1, ge=1, le=10_000)


class Dealer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str | int
    name: str | None = Field(default=None, max_length=180)
    address: str | None = Field(default=None, max_length=500)
    bat_stock: int = Field(default=0, ge=0, le=1_000_000)
    chg_stock: int = Field(default=0, ge=0, le=1_000_000)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)


class RecommendationPayload(BaseModel):
    request: RecommendationRequest
    dealers: list[Dealer] = Field(default_factory=list, max_length=5_000)


def database_dealers() -> list[dict[str, Any]]:
    """Read existing dealer inventory only if a hosted DB is configured."""
    if not DATABASE_URL:
        raise RuntimeError("No dealer data source is configured")
    parsed = urlparse(DATABASE_URL)
    if parsed.scheme not in {"mysql", "mysql+pymysql"} or not parsed.hostname or not parsed.path:
        raise RuntimeError("ML_DATABASE_URL is invalid")
    connection = pymysql.connect(
        host=parsed.hostname, port=parsed.port or 3306,
        user=unquote(parsed.username or ""), password=unquote(parsed.password or ""),
        database=parsed.path.lstrip("/"), charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor, connect_timeout=5,
        read_timeout=5, write_timeout=5,
    )
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id, name, address, bat_stock, chg_stock, lat, lng FROM dealers ORDER BY name ASC")
            return list(cursor.fetchall())
    finally:
        connection.close()


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/predict/health")
def health_prediction(features: HealthFeatures) -> dict[str, Any]:
    try:
        return predict_health(features.model_dump())
    except Exception:
        logger.exception("Battery health prediction failed")
        raise HTTPException(status_code=503, detail="Battery health prediction is temporarily unavailable.")


@app.post("/predict/demand")
def demand_prediction(features: DemandFeatures) -> dict[str, Any]:
    try:
        return predict_demand(features.model_dump())
    except Exception:
        logger.exception("Demand prediction failed")
        raise HTTPException(status_code=503, detail="Demand prediction is temporarily unavailable.")


@app.post("/recommendations/battery")
def battery_recommendation(payload: RecommendationPayload) -> dict[str, Any]:
    dealers = [dealer.model_dump() for dealer in payload.dealers]
    if not dealers:
        try:
            dealers = database_dealers()
        except Exception:
            logger.exception("Dealer inventory lookup failed")
            raise HTTPException(status_code=503, detail="Dealer inventory is temporarily unavailable.")
    if not dealers:
        raise HTTPException(status_code=503, detail="No dealer inventory is available for recommendation.")
    try:
        return recommend(payload.request.model_dump(), dealers)
    except Exception:
        logger.exception("Battery recommendation failed")
        raise HTTPException(status_code=503, detail="Battery recommendation is temporarily unavailable.")
