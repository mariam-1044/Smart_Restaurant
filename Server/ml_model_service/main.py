from datetime import datetime
from typing import List, Literal, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# State (mutated by model modules as they load / complete inference).
# ---------------------------------------------------------------------------

_state = {
    "lastSuccessAt": None,
    "modelsLoaded": {
        "forecasting": 0,
        "recommender": False,
        "pricing": False,
    },
}


def get_state() -> dict:
    return _state


def mark_success() -> None:
    _state["lastSuccessAt"] = datetime.utcnow().isoformat() + "Z"


# ---------------------------------------------------------------------------
# App + health
# ---------------------------------------------------------------------------

app = FastAPI(title="Smart Restaurant ML Service", version="1.0.0")


@app.get("/v1/health")
def health() -> dict:
    return {
        "status": "ok",
        "lastSuccessAt": _state["lastSuccessAt"],
        "modelsLoaded": dict(_state["modelsLoaded"]),
    }


# ---------------------------------------------------------------------------
# US1 — POST /v1/predict-sales
# ---------------------------------------------------------------------------

class PredictSalesRequest(BaseModel):
    dishId: str
    daysAhead: Literal[7, 30]


class PredictSalesPoint(BaseModel):
    date: str
    predicted: float
    lower: float
    upper: float


class PredictSalesResponse(BaseModel):
    dishId: str
    coldStart: bool
    points: List[PredictSalesPoint]


@app.post("/v1/predict-sales", response_model=PredictSalesResponse)
def predict_sales(req: PredictSalesRequest) -> PredictSalesResponse:
    from .models.forecasting import forecast
    from .models.coldstart import ColdStartError

    try:
        result = forecast(req.dishId, req.daysAhead)
    except ColdStartError as exc:
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "cold_start_no_data", "message": str(exc)}},
        )
    return PredictSalesResponse(
        dishId=req.dishId,
        coldStart=result["coldStart"],
        points=result["points"],
    )


# ---------------------------------------------------------------------------
# US3 — POST /v1/recommend
# ---------------------------------------------------------------------------

class RecommendRequest(BaseModel):
    customerId: str
    limit: int = Field(default=5, ge=1, le=50)


class RecommendItem(BaseModel):
    dishId: str
    score: float
    reason: str


class RecommendResponse(BaseModel):
    customerId: str
    coldStart: bool
    basis: Literal["collaborative", "popularity_fallback"]
    items: List[RecommendItem]


@app.post("/v1/recommend", response_model=RecommendResponse)
def recommend(req: RecommendRequest) -> RecommendResponse:
    from .models.recommender import recommend as _recommend
    res = _recommend(req.customerId, limit=req.limit)
    return RecommendResponse(
        customerId=req.customerId,
        coldStart=res["coldStart"],
        basis=res["basis"],
        items=[RecommendItem(**it) for it in res["items"]],
    )


# ---------------------------------------------------------------------------
# US4 — Market basket
# ---------------------------------------------------------------------------

class MarketBasketRefreshResponse(BaseModel):
    computedAt: str
    ruleCount: int
    reason: Optional[Literal["corpus_too_sparse"]] = None


@app.post("/v1/market-basket/refresh", response_model=MarketBasketRefreshResponse)
def market_basket_refresh() -> MarketBasketRefreshResponse:
    from .models.basket import compute_basket_rules
    from .data.repository import get_db
    rules, reason = compute_basket_rules()
    db = get_db()
    cutoff = datetime.utcnow().timestamp() - 7 * 24 * 60 * 60
    from datetime import timedelta
    week_ago = datetime.utcnow() - timedelta(days=7)
    db.market_basket_rules.delete_many({"computedAt": {"$lt": week_ago}})
    computed_at = datetime.utcnow()
    if reason == "corpus_too_sparse":
        db.market_basket_rules.insert_one({
            "antecedent": [],
            "consequent": [],
            "support": 0,
            "confidence": 0,
            "lift": 0,
            "computedAt": computed_at,
        })
        return MarketBasketRefreshResponse(
            computedAt=computed_at.isoformat() + "Z",
            ruleCount=0,
            reason="corpus_too_sparse",
        )
    if rules:
        for r in rules:
            r["computedAt"] = computed_at
        db.market_basket_rules.insert_many(rules)
    return MarketBasketRefreshResponse(
        computedAt=computed_at.isoformat() + "Z",
        ruleCount=len(rules),
        reason=None,
    )


@app.get("/v1/market-basket")
def market_basket_get():
    from .data.repository import get_db
    db = get_db()
    cur = db.market_basket_rules.find({}).sort([("computedAt", -1)]).limit(20)
    out = []
    for r in cur:
        out.append({
            "antecedent": [str(x) for x in (r.get("antecedent") or [])],
            "consequent": [str(x) for x in (r.get("consequent") or [])],
            "support": float(r.get("support", 0)),
            "confidence": float(r.get("confidence", 0)),
            "lift": float(r.get("lift", 0)),
        })
    return out


# ---------------------------------------------------------------------------
# US2 — POST /v1/generate-recipe (RAG: Qdrant + Gemini + LangChain)
# ---------------------------------------------------------------------------

class GenerateRecipeRequest(BaseModel):
    ingredients: List[str] = Field(..., min_length=1)
    style: Optional[str] = None
    creativity: Optional[int] = Field(default=None, ge=0, le=10)
    favoriteIngredients: Optional[List[str]] = None
    customerContext: Optional[str] = None


@app.post("/v1/generate-recipe")
def generate_recipe_endpoint(req: GenerateRecipeRequest) -> dict:
    from .models import recipe_rag

    try:
        recipe = recipe_rag.generate_recipe(
            ingredients=req.ingredients,
            style=req.style,
            creativity=req.creativity,
            favorite_ingredients=req.favoriteIngredients,
            customer_context=req.customerContext,
        )
    except recipe_rag.NoSuitableRecipeError:
        raise HTTPException(
            status_code=422,
            detail={
                "error": {
                    "code": "no_suitable_recipe",
                    "message": "No suitable recipe found",
                }
            },
        )
    except recipe_rag.UpstreamRecipeError as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "error": {
                    "code": "recipe_upstream_failed",
                    "message": str(exc),
                }
            },
        )

    mark_success()
    return recipe


# ---------------------------------------------------------------------------
# US5 — Pricing
# ---------------------------------------------------------------------------

class OptimizePricingRequest(BaseModel):
    dishId: str


class OptimizePricingResponse(BaseModel):
    dishId: str
    currentPrice: Optional[float]
    suggestedPrice: Optional[float]
    multiplier: Optional[float]
    confidence: float
    ingredientCost: Optional[float] = None
    margin: Optional[float] = None
    marginRatio: Optional[float] = None
    skippedReason: Optional[Literal["missing_cost_data", "insufficient_history"]] = None


@app.post("/v1/optimize-pricing", response_model=OptimizePricingResponse)
def optimize_pricing(req: OptimizePricingRequest) -> OptimizePricingResponse:
    from .models.pricing import optimize_price
    res = optimize_price(req.dishId)
    state = _state
    state["modelsLoaded"]["pricing"] = True
    return OptimizePricingResponse(
        dishId=req.dishId,
        currentPrice=res.get("currentPrice"),
        suggestedPrice=res.get("suggestedPrice"),
        multiplier=res.get("multiplier"),
        confidence=res.get("confidence", 0.0),
        ingredientCost=res.get("ingredientCost"),
        margin=res.get("margin"),
        marginRatio=res.get("marginRatio"),
        skippedReason=res.get("skippedReason"),
    )
