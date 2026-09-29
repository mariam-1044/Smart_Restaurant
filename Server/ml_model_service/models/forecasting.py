"""Per-dish demand forecaster (research §1: Prophet + cold-start fallback)."""

from datetime import datetime, timedelta
from typing import Dict, Optional

import pandas as pd

from .. import main as _main
from ..data import repository
from .coldstart import ColdStartError, compute_cold_start_forecast


# In-memory cache of (model, training_calendar_date) per dish.
_model_cache: Dict[str, dict] = {}


def _today() -> datetime:
    return datetime.utcnow()


def _cached_for(dish_id: str):
    entry = _model_cache.get(dish_id)
    if not entry:
        return None
    if entry["trainingDate"] != _today().date():
        return None
    return entry["model"]


def _store_model(dish_id: str, model) -> None:
    _model_cache[dish_id] = {"model": model, "trainingDate": _today().date()}
    state = _main.get_state()
    state["modelsLoaded"]["forecasting"] = len(_model_cache)


def forecast(
    dish_id: str,
    days: int,
    *,
    history_df: Optional[pd.DataFrame] = None,
    category_id: Optional[str] = None,
) -> dict:
    """Return {coldStart: bool, points: [{date, predicted, lower, upper}, ...]}.

    `history_df` and `category_id` are injectable for tests; when None,
    they fall through to repository.* calls.
    """
    if days not in (7, 30):
        raise ValueError("days must be 7 or 30")

    if history_df is None:
        history_df = repository.get_dish_order_history(dish_id, days=365)

    if history_df is None or len(history_df) < 14:
        cat = category_id or repository.get_dish_category(dish_id)
        if cat is None:
            raise ColdStartError("no_baseline")
        cs_points = compute_cold_start_forecast(cat, days)
        _main.mark_success()
        return {"coldStart": True, "points": cs_points}

    df = history_df.copy()
    df["ds"] = pd.to_datetime(df["ds"])
    df["y"] = df["y"].astype(float)

    model = _cached_for(dish_id)
    if model is None:
        from prophet import Prophet  # imported lazily — heavy dep
        model = Prophet(weekly_seasonality=True, daily_seasonality=False)
        model.fit(df)
        _store_model(dish_id, model)

    future = model.make_future_dataframe(periods=days)
    forecast_df = model.predict(future).tail(days)

    points = []
    for _, row in forecast_df.iterrows():
        points.append({
            "date": row["ds"].strftime("%Y-%m-%d"),
            "predicted": round(float(row["yhat"]), 4),
            "lower": round(float(row["yhat_lower"]), 4),
            "upper": round(float(row["yhat_upper"]), 4),
        })

    _main.mark_success()
    return {"coldStart": False, "points": points}
