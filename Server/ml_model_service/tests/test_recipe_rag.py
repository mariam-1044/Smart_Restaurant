"""Tests for POST /v1/generate-recipe.

The RAG generation function (recipe_rag.generate_recipe) is monkeypatched so
these tests never touch Qdrant / Gemini / LangChain — they exercise the
endpoint's request validation and error mapping only.
"""

import pytest
from fastapi.testclient import TestClient

from ml_model_service.main import app
from ml_model_service.models import recipe_rag

client = TestClient(app)


SAMPLE_RECIPE = {
    "name": "Margherita Pizza",
    "description": "Chosen because it matches tomato and cheese.",
    "style": "Italian",
    "prepTime": "30 min",
    "difficulty": "Easy",
    "steps": ["Make dough", "Add sauce and cheese", "Bake"],
    "ingredients": [
        {"name": "tomato", "quantity": 200, "unit": "g"},
        {"name": "cheese", "quantity": 150, "unit": "g"},
    ],
    "estimatedCost": 30,
    "suggestedPrice": 90,
    "profitMargin": 66,
    "rag": {"matched": True, "sourceCount": 3, "scoreThreshold": 0.7},
}


def test_generate_recipe_success(monkeypatch):
    captured = {}

    def fake_generate(**kwargs):
        captured.update(kwargs)
        return dict(SAMPLE_RECIPE)

    monkeypatch.setattr(recipe_rag, "generate_recipe", fake_generate)

    res = client.post(
        "/v1/generate-recipe",
        json={
            "ingredients": ["tomato", "cheese"],
            "style": "Italian",
            "creativity": 7,
            "favoriteIngredients": ["cheese"],
            "customerContext": "vegetarian please",
        },
    )

    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "Margherita Pizza"
    assert body["rag"]["matched"] is True
    # Request fields are forwarded to the generator unchanged.
    assert captured["ingredients"] == ["tomato", "cheese"]
    assert captured["style"] == "Italian"
    assert captured["creativity"] == 7
    assert captured["favorite_ingredients"] == ["cheese"]
    assert captured["customer_context"] == "vegetarian please"


def test_generate_recipe_requires_ingredients():
    # Missing "ingredients" entirely -> FastAPI request validation (422).
    res = client.post("/v1/generate-recipe", json={"style": "Italian"})
    assert res.status_code == 422

    # Empty ingredients list also fails validation (min_length=1).
    res2 = client.post("/v1/generate-recipe", json={"ingredients": []})
    assert res2.status_code == 422


def test_generate_recipe_no_suitable_recipe(monkeypatch):
    def fake_generate(**kwargs):
        raise recipe_rag.NoSuitableRecipeError()

    monkeypatch.setattr(recipe_rag, "generate_recipe", fake_generate)

    res = client.post("/v1/generate-recipe", json={"ingredients": ["unicorn"]})
    assert res.status_code == 422
    detail = res.json()["detail"]
    assert detail["error"]["code"] == "no_suitable_recipe"
    assert detail["error"]["message"] == "No suitable recipe found"


def test_generate_recipe_malformed_upstream(monkeypatch):
    def fake_generate(**kwargs):
        raise recipe_rag.UpstreamRecipeError("malformed_recipe_json")

    monkeypatch.setattr(recipe_rag, "generate_recipe", fake_generate)

    res = client.post("/v1/generate-recipe", json={"ingredients": ["tomato"]})
    assert res.status_code == 502
    assert res.json()["detail"]["error"]["code"] == "recipe_upstream_failed"


def test_normalize_ingredients_arabic_to_english():
    out = recipe_rag.normalize_ingredients(["طماطم", "جبنة", "tomato"])
    assert out == ["tomato", "cheese", "tomato"]
