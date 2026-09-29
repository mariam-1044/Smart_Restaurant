"""Cold-start forecast helper (spec FR-009 + Q4 clarification, research §11).

Recency-weighted day-of-week share over the trailing 30 days of the
dish's category, applied per forecast horizon day. Returns wide
confidence bands (lower = predicted * 0.4, upper = predicted * 1.8) so
the cold-start status is visually obvious in the chart.
"""

from datetime import datetime, timedelta
from typing import List, Optional

import numpy as np
import pandas as pd

from ..data import repository


class ColdStartError(Exception):
    """Raised when the cold-start helper has no baseline to fall back on."""

    def __init__(self, reason: str = "no_baseline"):
        super().__init__(reason)
        self.reason = reason


HALF_LIFE_DAYS = 14.0


def _weights_for(dates: pd.Series, today: datetime) -> np.ndarray:
    age_days = np.array([(today - d.to_pydatetime()).days for d in dates], dtype=float)
    return np.power(0.5, age_days / HALF_LIFE_DAYS)


def compute_cold_start_forecast(
    category_id: str,
    horizon_days: int,
    *,
    today: Optional[datetime] = None,
    history_df: Optional[pd.DataFrame] = None,
) -> List[dict]:
    """Return one dict per horizon day: {date, predicted, lower, upper}.

    `category_id` is the dish category (matches `Dish.category` enum).
    `history_df` is injectable for tests; when None, falls through to
    `repository.get_category_orders_30d(category_id)`.
    """
    if today is None:
        today = datetime.utcnow()
    if history_df is None:
        history_df = repository.get_category_orders_30d(category_id)

    if history_df is None or history_df.empty:
        raise ColdStartError("no_baseline")

    df = history_df.copy()
    df["ds"] = pd.to_datetime(df["ds"])

    weights = _weights_for(df["ds"], today)
    if weights.sum() <= 0:
        raise ColdStartError("no_baseline")

    weighted_total = float((df["y"] * weights).sum())
    weight_sum = float(weights.sum())
    weighted_mean_daily = weighted_total / weight_sum

    # DOW shares: how much each day-of-week contributes vs the average day.
    dow_weighted = {i: 0.0 for i in range(7)}
    dow_weight_total = {i: 0.0 for i in range(7)}
    for d, y, w in zip(df["ds"], df["y"], weights):
        dow = d.weekday()
        dow_weighted[dow] += float(y) * float(w)
        dow_weight_total[dow] += float(w)

    dow_avg = {}
    for i in range(7):
        if dow_weight_total[i] > 0:
            dow_avg[i] = dow_weighted[i] / dow_weight_total[i]
        else:
            dow_avg[i] = weighted_mean_daily

    overall_dow_avg = sum(dow_avg.values()) / 7.0
    if overall_dow_avg <= 0:
        raise ColdStartError("no_baseline")

    dow_share = {i: dow_avg[i] / overall_dow_avg for i in range(7)}

    out: List[dict] = []
    for offset in range(1, horizon_days + 1):
        target_day = today + timedelta(days=offset)
        share = dow_share[target_day.weekday()]
        predicted = float(weighted_mean_daily * share)
        out.append({
            "date": target_day.strftime("%Y-%m-%d"),
            "predicted": round(predicted, 4),
            "lower": round(predicted * 0.4, 4),
            "upper": round(predicted * 1.8, 4),
        })
    return out
