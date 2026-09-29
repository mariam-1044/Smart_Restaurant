"""Dynamic pricing model (research §4): GradientBoostingRegressor.

The model learns a sales-volume-to-multiplier mapping per dish based on
ingredient cost, day-of-week, weekend flag, and recent sales. At pilot
scale we keep the model lightweight and skip dishes that lack the
features required for a defensible suggestion (per FR-024 / FR-025).
"""

from typing import Dict, Optional

import numpy as np

from ..data import repository


_model_cache = None


def _train_default_model():
    """Synthesize a training set from price-feature space.

    At graduation-project scale we don't have enough labelled "optimal price"
    history to train a true revenue-maximizing model, so we ship a defensible
    GBR that learns a smooth, bounded multiplier from the structured features.

    The target is a *continuous* function of every feature the model sees so
    that two dishes that differ on ANY axis (profit margin, demand, weekend)
    get different multipliers. The previous version used coarse step
    thresholds that only fired on extreme sales volume, which collapsed every
    low/zero-sales dish onto the same multiplier — hence the "same % for all
    dishes" bug. Profit margin is now the dominant, dish-specific signal:
    thin-margin dishes are pushed up, fat-margin dishes can be eased down to
    win volume. Real production training is out of scope (P1 work).
    """
    from sklearn.ensemble import GradientBoostingRegressor

    rng = np.random.default_rng(seed=2026)
    n = 900
    X = []
    y = []
    for _ in range(n):
        current_price = rng.uniform(5, 60)
        ingredient_cost = rng.uniform(1, current_price * 1.1)  # allow loss-makers
        margin_ratio = (current_price - ingredient_cost) / current_price
        sales_30d = rng.uniform(0, 200)
        sales_norm = sales_30d / 100.0
        dow = rng.integers(0, 7)
        is_weekend = 1 if dow >= 5 else 0

        # Continuous multiplier. Margin is the primary lever, demand the
        # secondary one, weekend a small seasonal nudge.
        target = 1.0
        target += 0.30 * (0.55 - margin_ratio)   # thin/negative margin → raise; fat margin → ease down
        target += 0.18 * (sales_norm - 0.6)       # strong demand → raise; weak demand → discount
        target += 0.04 * is_weekend
        target += rng.normal(0, 0.015)
        X.append([margin_ratio, sales_norm, dow, is_weekend])
        y.append(target)
    model = GradientBoostingRegressor(n_estimators=220, max_depth=3, learning_rate=0.05)
    model.fit(np.array(X), np.array(y))
    return model


def _get_model():
    global _model_cache
    if _model_cache is None:
        _model_cache = _train_default_model()
    return _model_cache


def _confidence_from_staged(model, x_row) -> float:
    """Confidence proxy = 1 - normalized std of staged predictions."""
    staged = list(model.staged_predict(x_row))
    if not staged:
        return 0.5
    series = np.array([float(s[0]) for s in staged])
    std = float(np.std(series[-30:])) if len(series) > 0 else 0.0
    proxy = max(0.0, min(1.0, 1.0 - (std / 0.05)))
    return float(proxy)


def optimize_price(
    dish_id: str,
    *,
    features: Optional[Dict[str, float]] = None,
) -> dict:
    """Return {currentPrice, suggestedPrice, multiplier, confidence, skippedReason}.

    `features` is injectable for tests; when None, falls through to
    repository.get_pricing_features.
    """
    if features is None:
        features = repository.get_pricing_features(dish_id)

    if features.get("ingredientCost") is None:
        return {
            "currentPrice": features.get("currentPrice"),
            "suggestedPrice": None,
            "multiplier": None,
            "confidence": 0.0,
            "skippedReason": "missing_cost_data",
        }
    if features.get("historyDays", 0) < 14:
        return {
            "currentPrice": features.get("currentPrice"),
            "suggestedPrice": None,
            "multiplier": None,
            "confidence": 0.0,
            "skippedReason": "insufficient_history",
        }

    current_price = float(features["currentPrice"])
    ingredient_cost = float(features["ingredientCost"])
    # Profit margin as a share of price — the dominant, dish-specific signal.
    margin_ratio = (current_price - ingredient_cost) / current_price if current_price > 0 else 0.0

    model = _get_model()
    x_row = np.array([[
        float(margin_ratio),
        float(features.get("salesCount30d", 0.0)) / 100.0,
        int(features.get("dayOfWeek", 0)),
        1 if features.get("isWeekend") else 0,
    ]])
    raw_multiplier = float(model.predict(x_row)[0])
    confidence = _confidence_from_staged(model, x_row)

    # Cap multiplier per FR-025: high confidence → ±50%, otherwise ±25%.
    if confidence >= 0.8:
        lo, hi = 0.5, 1.5
    else:
        lo, hi = 0.75, 1.25
    multiplier = max(lo, min(hi, raw_multiplier))

    suggested_price = round(current_price * multiplier, 2)

    return {
        "currentPrice": current_price,
        "suggestedPrice": suggested_price,
        "multiplier": round(multiplier, 4),
        "confidence": round(confidence, 4),
        "ingredientCost": round(ingredient_cost, 2),
        "margin": round(current_price - ingredient_cost, 2),
        "marginRatio": round(margin_ratio, 4),
        "skippedReason": None,
    }
