"""MongoDB data access for the ML service.

All functions here are pure data fetchers — they never mutate Mongo state.
The Node orchestrator owns all writes (per the layered architecture rule);
the ML service only reads facts and writes its own cached artifacts.
"""

import os
from datetime import datetime, timedelta
from typing import List, Tuple

import numpy as np
import pandas as pd
from pymongo import MongoClient
from pymongo.database import Database
from scipy.sparse import csr_matrix


_client: MongoClient = None  # type: ignore


def get_db() -> Database:
    """Return a pymongo Database.

    Reads the Mongo connection string from MONGODB_URI, falling back to
    MONGO_URI (the name docker-compose sets for the ml service) and finally a
    local default. Accepting both names is what keeps the deployed ML service
    pointed at the same database the Node API and seed scripts write to —
    without it the container falls back to localhost and every AI feature
    reads an empty DB.
    """
    global _client
    if _client is None:
        uri = (
            os.environ.get("MONGODB_URI")
            or os.environ.get("MONGO_URI")
            or "mongodb://localhost:27017/smart-restaurant"
        )
        _client = MongoClient(uri)
    # If URI ends with /<dbname>, pymongo picks it up via get_default_database.
    try:
        return _client.get_default_database()
    except Exception:
        return _client["smart_restaurant"]


def get_dish_order_history(dish_id: str, days: int = 365) -> pd.DataFrame:
    """Returns columns ds (date) and y (qty) suitable for Prophet.

    Aggregates Order.items[] across `days` trailing days where status is
    completed. dish_id is the string form of an ObjectId.
    """
    from bson import ObjectId

    db = get_db()
    cutoff = datetime.utcnow() - timedelta(days=days)
    cursor = db.orders.aggregate([
        {"$match": {"createdAt": {"$gte": cutoff}, "status": "completed"}},
        {"$unwind": "$items"},
        {"$match": {"items.dish": ObjectId(dish_id)}},
        {
            "$group": {
                "_id": {
                    "$dateTrunc": {"date": "$createdAt", "unit": "day"}
                },
                "y": {"$sum": "$items.quantity"},
            }
        },
        {"$sort": {"_id": 1}},
    ])
    rows = [{"ds": doc["_id"], "y": float(doc["y"])} for doc in cursor]
    return pd.DataFrame(rows, columns=["ds", "y"])


def get_dish_category(dish_id: str):
    from bson import ObjectId
    db = get_db()
    dish = db.dishes.find_one({"_id": ObjectId(dish_id)}, {"category": 1})
    return dish.get("category") if dish else None


def get_category_orders_30d(category: str) -> pd.DataFrame:
    """Trailing-30-day order quantities for all dishes in a category.

    Returns columns ds (date) and y (qty).
    """
    db = get_db()
    cutoff = datetime.utcnow() - timedelta(days=30)
    dish_ids = [d["_id"] for d in db.dishes.find({"category": category}, {"_id": 1})]
    if not dish_ids:
        return pd.DataFrame(columns=["ds", "y"])
    cursor = db.orders.aggregate([
        {"$match": {"createdAt": {"$gte": cutoff}, "status": "completed"}},
        {"$unwind": "$items"},
        {"$match": {"items.dish": {"$in": dish_ids}}},
        {
            "$group": {
                "_id": {"$dateTrunc": {"date": "$createdAt", "unit": "day"}},
                "y": {"$sum": "$items.quantity"},
            }
        },
        {"$sort": {"_id": 1}},
    ])
    rows = [{"ds": doc["_id"], "y": float(doc["y"])} for doc in cursor]
    return pd.DataFrame(rows, columns=["ds", "y"])


def get_customer_dish_matrix() -> Tuple[csr_matrix, List[str], List[str]]:
    """Build a sparse customer × dish frequency matrix.

    Returns (matrix, customer_ids, dish_ids). customer_ids/dish_ids are the
    string ObjectIds in row/column order.
    """
    db = get_db()
    cursor = db.orders.aggregate([
        {"$match": {"status": "completed"}},
        {"$unwind": "$items"},
        {
            "$group": {
                "_id": {"customer": "$user", "dish": "$items.dish"},
                "qty": {"$sum": "$items.quantity"},
            }
        },
    ])
    customer_index = {}
    dish_index = {}
    rows, cols, vals = [], [], []
    for doc in cursor:
        cust = doc["_id"]["customer"]
        dish = doc["_id"]["dish"]
        if cust is None or dish is None:
            continue
        cust_s = str(cust)
        dish_s = str(dish)
        if cust_s not in customer_index:
            customer_index[cust_s] = len(customer_index)
        if dish_s not in dish_index:
            dish_index[dish_s] = len(dish_index)
        rows.append(customer_index[cust_s])
        cols.append(dish_index[dish_s])
        vals.append(float(doc["qty"]))
    n_rows = len(customer_index)
    n_cols = len(dish_index)
    if n_rows == 0 or n_cols == 0:
        return csr_matrix((0, 0)), [], []
    matrix = csr_matrix((vals, (rows, cols)), shape=(n_rows, n_cols))
    customer_ids = [None] * n_rows
    for cid, idx in customer_index.items():
        customer_ids[idx] = cid
    dish_ids = [None] * n_cols
    for did, idx in dish_index.items():
        dish_ids[idx] = did
    return matrix, customer_ids, dish_ids


def get_orders_for_basket(min_items: int = 2) -> List[List[str]]:
    """Return one list of dish-id strings per multi-item completed order."""
    db = get_db()
    out: List[List[str]] = []
    for order in db.orders.find({"status": "completed"}, {"items.dish": 1}):
        items = order.get("items") or []
        ids = [str(it["dish"]) for it in items if it.get("dish") is not None]
        if len(ids) >= min_items:
            out.append(ids)
    return out


def get_pricing_features(dish_id: str) -> dict:
    """Pull current price, ingredient cost, DOW one-hot, and recent sales count."""
    from bson import ObjectId

    db = get_db()
    dish = db.dishes.find_one({"_id": ObjectId(dish_id)})
    if not dish:
        return {
            "currentPrice": None,
            "ingredientCost": None,
            "dayOfWeek": datetime.utcnow().weekday(),
            "isWeekend": datetime.utcnow().weekday() >= 5,
            "salesCount30d": 0,
            "historyDays": 0,
        }

    # Aggregate ingredient cost from linked Ingredient records.
    ingredient_cost = 0.0
    have_costs = True
    for entry in dish.get("ingredients") or []:
        ing = db.ingredients.find_one(
            {"_id": entry["ingredient"]},
            {"costPerUnit": 1}
        )
        if not ing or ing.get("costPerUnit") in (None, 0):
            have_costs = False
            break
        ingredient_cost += float(ing["costPerUnit"]) * float(entry.get("quantity", 0))
    if not have_costs:
        ingredient_cost = None

    # Trailing 30-day sales count for this dish.
    cutoff = datetime.utcnow() - timedelta(days=30)
    history = list(db.orders.aggregate([
        {"$match": {"createdAt": {"$gte": cutoff}, "status": "completed"}},
        {"$unwind": "$items"},
        {"$match": {"items.dish": ObjectId(dish_id)}},
        {"$group": {"_id": None, "qty": {"$sum": "$items.quantity"}}},
    ]))
    sales_count_30d = float(history[0]["qty"]) if history else 0.0

    # Days of order history available.
    history_days = list(db.orders.aggregate([
        {"$match": {"status": "completed"}},
        {"$unwind": "$items"},
        {"$match": {"items.dish": ObjectId(dish_id)}},
        {
            "$group": {
                "_id": {"$dateTrunc": {"date": "$createdAt", "unit": "day"}}
            }
        },
        {"$count": "n"},
    ]))
    days_count = int(history_days[0]["n"]) if history_days else 0

    today = datetime.utcnow()
    return {
        "currentPrice": float(dish.get("price", 0)),
        "ingredientCost": ingredient_cost,
        "dayOfWeek": today.weekday(),
        "isWeekend": today.weekday() >= 5,
        "salesCount30d": sales_count_30d,
        "historyDays": days_count,
    }
