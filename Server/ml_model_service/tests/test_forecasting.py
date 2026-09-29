from datetime import datetime, timedelta
from unittest.mock import patch

import pandas as pd
import pytest

from ml_model_service.models.forecasting import forecast
from ml_model_service.models.coldstart import ColdStartError


def _hist(days: int) -> pd.DataFrame:
    today = datetime(2026, 4, 26)
    rows = []
    for offset in range(days, 0, -1):
        d = today - timedelta(days=offset)
        rows.append({"ds": d, "y": 10 + (d.weekday() % 4)})
    return pd.DataFrame(rows)


def test_returns_seven_points_when_history_sufficient():
    df = _hist(60)
    out = forecast("dummy_dish_id", 7, history_df=df, category_id="Pizza")
    assert out["coldStart"] is False
    assert len(out["points"]) == 7
    for p in out["points"]:
        assert {"date", "predicted", "lower", "upper"}.issubset(p.keys())


def test_falls_back_to_cold_start_when_lt_14_days():
    df = _hist(5)

    fake_cs_history = _hist(30)

    with patch("ml_model_service.models.forecasting.repository.get_dish_category", return_value="Pizza"), \
         patch("ml_model_service.models.coldstart.repository.get_category_orders_30d", return_value=fake_cs_history):
        out = forecast("dummy_dish_id", 7, history_df=df)
    assert out["coldStart"] is True
    assert len(out["points"]) == 7


def test_cold_start_error_when_no_baseline():
    df = _hist(5)
    empty = pd.DataFrame(columns=["ds", "y"])
    with patch("ml_model_service.models.forecasting.repository.get_dish_category", return_value="Pizza"), \
         patch("ml_model_service.models.coldstart.repository.get_category_orders_30d", return_value=empty):
        with pytest.raises(ColdStartError):
            forecast("dummy_dish_id", 7, history_df=df)
