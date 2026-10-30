
import json
import math
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="BUSMATE API",
    description="Local bus routes, timetables and ETA prediction",
    version="0.4.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = Path(__file__).with_name("routes_data.json")


def load_routes() -> dict[str, Any]:
    if not DATA_PATH.exists():
        return {}

    try:
        with DATA_PATH.open("r", encoding="utf-8") as file:
            data = json.load(file)

        return data if isinstance(data, dict) else {}

    except (OSError, json.JSONDecodeError):
        return {}


ROUTES = load_routes()


# ---------- ETA request models ----------

class StopDistance(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    distance_km: float = Field(ge=0)


class ETAPredictionRequest(BaseModel):
    bus_no: str = Field(default="301", min_length=1, max_length=30)
    route_name: str = Field(
        default="Tumkur - Nittur",
        max_length=200,
    )

    # Distance travelled from the beginning of the route.
    current_distance_km: float = Field(ge=0)

    # Estimated average speed, not a measured live GPS speed.
    speed_kmh: float = Field(default=20, gt=0, le=120)

    # Stops must be ordered along the route.
    stops: list[StopDistance] = Field(min_length=1, max_length=100)


# ---------- Existing endpoints ----------

@app.get("/")
def root():
    return {
        "name": "BUSMATE API",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "mode": "simulation",
        "gps": "not connected",
        "eta": "backend prediction enabled",
        "note": (
            "ETA predictions use supplied route progress and estimated "
            "speed. Live GPS is not connected."
        ),
        "routes_data_loaded": bool(ROUTES),
    }


@app.get("/api/cities")
def cities():
    return {"cities": list(ROUTES.keys())}


@app.get("/api/routes/{city}")
def routes_for_city(city: str):
    key = next(
        (name for name in ROUTES if name.lower() == city.lower()),
        None,
    )

    if key is None:
        return {
            "city": city,
            "routes": [],
            "message": "City not found in routes_data.json",
        }

    return {
        "city": key,
        "routes": ROUTES[key],
        "notice": (
            "Only supplied route/timetable data is returned. "
            "Missing fields are not invented."
        ),
    }


# ---------- Backend ETA prediction ----------

@app.post("/api/eta")
def predict_eta(request: ETAPredictionRequest):
    stops = request.stops

    # Stop distances must be ordered along the route.
    distances = [stop.distance_km for stop in stops]

    if any(
        distances[index] > distances[index + 1]
        for index in range(len(distances) - 1)
    ):
        raise HTTPException(
            status_code=422,
            detail="Stops must be ordered by increasing route distance.",
        )

    if request.current_distance_km > distances[-1]:
        raise HTTPException(
            status_code=422,
            detail=(
                "Current bus distance exceeds the final stop's "
                "distance along the route."
            ),
        )

    predictions = []

    for stop in stops:
        remaining_km = stop.distance_km - request.current_distance_km

        if remaining_km < -0.001:
            status = "passed"
            eta_minutes = None

        elif abs(remaining_km) <= 0.001:
            status = "arriving"
            eta_minutes = 0

        else:
            status = "upcoming"
            eta_minutes = math.ceil(
                (remaining_km / request.speed_kmh) * 60
            )

        predictions.append(
            {
                "stop": stop.name,
                "distance_from_bus_km": round(
                    max(0, remaining_km), 2
                ),
                "eta_minutes": eta_minutes,
                "status": status,
            }
        )

    return {
        "bus_no": request.bus_no,
        "route": request.route_name,
        "current_distance_km": request.current_distance_km,
        "estimated_speed_kmh": request.speed_kmh,
        "prediction_method": "distance_and_estimated_average_speed",
        "live_gps_connected": False,
        "predictions": predictions,
    }

### ETA prediction endpoint


from math import atan2, cos, radians, sin, sqrt
from datetime import datetime, timedelta
from typing import Optional

from pydantic import BaseModel, Field


class StopLocation(BaseModel):
    name: str
    latitude: float
    longitude: float


class ETAPredictionRequest(BaseModel):
    bus_no: str = "301"

    current_latitude: float = Field(ge=-90, le=90)
    current_longitude: float = Field(ge=-180, le=180)

    # Average estimated speed in km/h.
    average_speed_kmh: float = Field(default=20, gt=0, le=120)

    # Stops must be provided in travel order.
    stops: list[StopLocation]


def calculate_distance_km(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
) -> float:
    """Calculate straight-line distance between two coordinates."""
    earth_radius_km = 6371.0

    lat1, lon1, lat2, lon2 = map(
        radians, [lat1, lon1, lat2, lon2]
    )

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = (
        sin(dlat / 2) ** 2
        + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    )

    return 2 * earth_radius_km * atan2(
        sqrt(a), sqrt(1 - a)
    )


@app.post("/api/eta")
def predict_eta(request: ETAPredictionRequest):
    """
    Estimate arrival times at upcoming stops.

    This initial version uses straight-line distances and
    an assumed average speed. It is not traffic-aware.
    """
    now = datetime.now().astimezone()
    predictions = []
    cumulative_minutes = 0.0

    for stop in request.stops:
        distance_km = calculate_distance_km(
            request.current_latitude,
            request.current_longitude,
            stop.latitude,
            stop.longitude,
        )

        minutes = (
            distance_km / request.average_speed_kmh
        ) * 60

        cumulative_minutes += minutes

        arrival = now + timedelta(
            minutes=cumulative_minutes
        )

        predictions.append({
            "stop": stop.name,
            "distance_from_bus_km": round(distance_km, 2),
            "estimated_minutes": round(cumulative_minutes),
            "estimated_arrival": arrival.isoformat(),
        })

    return {
        "bus_no": request.bus_no,
        "method": "straight_line_distance_estimate",
        "average_speed_kmh": request.average_speed_kmh,
        "gps_connected": False,
        "predictions": predictions,
        "notice": (
            "Approximate estimates only. Straight-line distances "
            "are not road distances, and live GPS and traffic "
            "data are not connected."
        ),
    }