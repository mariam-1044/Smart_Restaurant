"""User-based collaborative filtering recommender (research §2)."""

from datetime import datetime
from typing import Dict, List, Optional, Tuple

import numpy as np
from scipy.sparse import csr_matrix
from sklearn.metrics.pairwise import cosine_similarity

from .. import main as _main
from ..data import repository


# Cached matrix + index lookups, refreshed on demand.
_cache: Dict[str, object] = {
    "matrix": None,
    "customer_ids": None,
    "dish_ids": None,
    "computed_at": None,
}


def _refresh(matrix=None, customer_ids=None, dish_ids=None) -> None:
    if matrix is None:
        matrix, customer_ids, dish_ids = repository.get_customer_dish_matrix()
    _cache["matrix"] = matrix
    _cache["customer_ids"] = customer_ids
    _cache["dish_ids"] = dish_ids
    _cache["computed_at"] = datetime.utcnow()
    state = _main.get_state()
    state["modelsLoaded"]["recommender"] = bool(customer_ids)


def recommend(
    customer_id: str,
    limit: int = 5,
    *,
    matrix: Optional[csr_matrix] = None,
    customer_ids: Optional[List[str]] = None,
    dish_ids: Optional[List[str]] = None,
    popularity_fallback_ids: Optional[List[Tuple[str, float]]] = None,
) -> dict:
    """Return {coldStart, basis, items: [{dishId, score, reason}, ...]}.

    `matrix`/`customer_ids`/`dish_ids` are injectable for tests.
    """
    if matrix is None:
        if _cache["matrix"] is None:
            _refresh()
        matrix = _cache["matrix"]
        customer_ids = _cache["customer_ids"]
        dish_ids = _cache["dish_ids"]
    if customer_ids is None or dish_ids is None or matrix is None or matrix.shape[0] == 0:
        return _popularity_fallback(customer_id, limit, popularity_fallback_ids)

    if customer_id not in customer_ids:
        return _popularity_fallback(customer_id, limit, popularity_fallback_ids)

    target_idx = customer_ids.index(customer_id)
    target_row = matrix.getrow(target_idx)

    # Suppress dishes the target customer already orders frequently (≥3).
    target_dense = target_row.toarray().flatten()
    suppressed = set(int(i) for i, v in enumerate(target_dense) if v >= 3)

    # Cosine similarity to every other customer.
    sims = cosine_similarity(target_row, matrix).flatten()
    sims[target_idx] = 0.0  # exclude self

    # Top-K similar customers (K = 20 or all if smaller).
    top_k = min(20, len(sims))
    top_idxs = np.argsort(sims)[::-1][:top_k]
    top_sims = sims[top_idxs]
    if top_sims.sum() <= 0:
        return _popularity_fallback(customer_id, limit, popularity_fallback_ids)

    # Weighted aggregate of their dish frequencies.
    neighbour_matrix = matrix[top_idxs]  # k × n_dishes sparse
    weights = top_sims.reshape(-1, 1)
    aggregated = neighbour_matrix.multiply(weights).sum(axis=0)
    aggregated = np.asarray(aggregated).flatten()

    # Subtract dishes already frequently ordered by target.
    for s in suppressed:
        aggregated[s] = 0.0

    if aggregated.max() <= 0:
        return _popularity_fallback(customer_id, limit, popularity_fallback_ids)

    norm = float(aggregated.max())
    ranked = np.argsort(aggregated)[::-1]
    items = []
    for di in ranked:
        if aggregated[di] <= 0:
            continue
        items.append({
            "dishId": dish_ids[int(di)],
            "score": round(float(aggregated[di] / norm), 4),
            "reason": "Liked by diners with similar order history",
        })
        if len(items) >= limit:
            break

    if not items:
        return _popularity_fallback(customer_id, limit, popularity_fallback_ids)

    return {"coldStart": False, "basis": "collaborative", "items": items}


def _popularity_fallback(customer_id: str, limit: int, override) -> dict:
    if override is not None:
        items = [
            {"dishId": did, "score": float(score), "reason": "Popular with our diners"}
            for did, score in override[:limit]
        ]
        return {"coldStart": True, "basis": "popularity_fallback", "items": items}

    db = repository.get_db()
    cursor = db.orders.aggregate([
        {"$match": {"status": "completed"}},
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.dish", "count": {"$sum": "$items.quantity"}}},
        {"$sort": {"count": -1}},
        {"$limit": limit},
    ])
    items = []
    for row in cursor:
        if row["_id"] is None:
            continue
        items.append({
            "dishId": str(row["_id"]),
            "score": float(row["count"]) / 100.0,
            "reason": "Popular with our diners",
        })
    return {"coldStart": True, "basis": "popularity_fallback", "items": items}
