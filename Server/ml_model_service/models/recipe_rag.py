"""RAG-based recipe generation.

Retrieves recipes from a Qdrant vector store (similarity score threshold),
then asks Google Gemini to compose a dish using ONLY the retrieved context —
it never invents recipes. If nothing suitable is retrieved (or Gemini reports
no match), a NoSuitableRecipeError is raised so the API can return a clean 422.

LangChain / Qdrant / Gemini imports are intentionally LAZY (inside the builder
functions) so this module can be imported — and the endpoint tested with the
generation function mocked — without those heavy dependencies installed.

Configuration comes from environment variables ONLY (no hardcoded secrets):
  GOOGLE_API_KEY
  QDRANT_URL
  QDRANT_API_KEY
  QDRANT_COLLECTION_NAME
  RAG_TOP_K                 (default 5)
  RAG_SCORE_THRESHOLD       (default 0.3)
  RAG_EMBEDDING_PROVIDER    (huggingface | google; default huggingface)
  HF_EMBEDDING_MODEL        (default sentence-transformers/all-MiniLM-L6-v2)
  GOOGLE_EMBEDDING_MODEL    (default models/text-embedding-004)
  GOOGLE_RECIPE_MODEL       (default models/gemini-2.5-flash)

NOTE on the embedding model: the query MUST be embedded with the SAME model the
Qdrant collection was built with, or similarity scores are meaningless. The
shipped collections are 384-dim (sentence-transformers/all-MiniLM-L6-v2), so the
default provider is HuggingFace. Switch to Google only against a collection that
was actually embedded with a Google model (e.g. 768-dim text-embedding-004).
"""

import json
import os
import re

# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------


class NoSuitableRecipeError(Exception):
    """No retrieved recipe matched the requested ingredients well enough."""

    def __init__(self, message="No suitable recipe found"):
        super().__init__(message)
        self.message = message


class UpstreamRecipeError(Exception):
    """Gemini / Qdrant failed, or returned a payload we could not parse."""

    def __init__(self, message="recipe_upstream_failed"):
        super().__init__(message)
        self.message = message


# ---------------------------------------------------------------------------
# Arabic -> English ingredient normalization (real UTF-8 Arabic strings).
# ---------------------------------------------------------------------------

INGREDIENT_MAP = {
    "بطاطس": "potato",
    "لحمة مفرومة": "minced meat",
    "فراخ": "chicken",
    "دجاج": "chicken",
    "رز": "rice",
    "أرز": "rice",
    "طماطم": "tomato",
    "جبنة": "cheese",
    "بصل": "onion",
    "ثوم": "garlic",
}


def normalize_ingredient(term):
    """Translate a single Arabic ingredient to English when known."""
    if term is None:
        return ""
    text = str(term).strip()
    # Longest keys first so "لحمة مفرومة" wins over a substring match.
    for ar in sorted(INGREDIENT_MAP, key=len, reverse=True):
        text = text.replace(ar, INGREDIENT_MAP[ar])
    return text.strip()


def normalize_ingredients(ingredients):
    out = []
    for item in ingredients or []:
        norm = normalize_ingredient(item)
        if norm:
            out.append(norm)
    return out


# ---------------------------------------------------------------------------
# Env / config helpers
# ---------------------------------------------------------------------------


def _env(name, default=None, required=False):
    val = os.getenv(name, default)
    if required and (val is None or str(val).strip() == ""):
        raise UpstreamRecipeError(f"missing_env:{name}")
    return val


def _top_k():
    try:
        return int(_env("RAG_TOP_K", "5"))
    except (TypeError, ValueError):
        return 5


def _score_threshold():
    try:
        return float(_env("RAG_SCORE_THRESHOLD", "0.3"))
    except (TypeError, ValueError):
        return 0.3


def _temperature_for(creativity):
    """Map the 0-10 creativity dial onto a Gemini sampling temperature,
    mirroring the Node heuristic so the UI slider keeps its meaning."""
    if isinstance(creativity, (int, float)):
        return min(1.3, max(0.2, 0.2 + (float(creativity) / 10.0) * 1.0))
    return 0.5


# ---------------------------------------------------------------------------
# Lazy, cached LangChain components.
# ---------------------------------------------------------------------------

_CACHE = {
    "embeddings": None,
    "vector_store": None,
    "retriever": None,
    "llms": {},  # keyed by rounded temperature
}


def _get_embeddings():
    if _CACHE["embeddings"] is None:
        provider = str(_env("RAG_EMBEDDING_PROVIDER", "huggingface")).strip().lower()
        if provider == "google":
            from langchain_google_genai import GoogleGenerativeAIEmbeddings

            _CACHE["embeddings"] = GoogleGenerativeAIEmbeddings(
                model=_env("GOOGLE_EMBEDDING_MODEL", "models/text-embedding-004"),
                google_api_key=_env("GOOGLE_API_KEY", required=True),
            )
        else:
            # Local sentence-transformers model — matches the 384-dim collections
            # and needs no API key.
            from langchain_huggingface import HuggingFaceEmbeddings

            _CACHE["embeddings"] = HuggingFaceEmbeddings(
                model_name=_env(
                    "HF_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
                ),
            )
    return _CACHE["embeddings"]


def _get_vector_store():
    if _CACHE["vector_store"] is None:
        from langchain_qdrant import QdrantVectorStore

        _CACHE["vector_store"] = QdrantVectorStore.from_existing_collection(
            embedding=_get_embeddings(),
            url=_env("QDRANT_URL", required=True),
            api_key=_env("QDRANT_API_KEY", required=True),
            collection_name=_env("QDRANT_COLLECTION_NAME", required=True),
        )
    return _CACHE["vector_store"]


def _get_retriever():
    if _CACHE["retriever"] is None:
        _CACHE["retriever"] = _get_vector_store().as_retriever(
            search_type="similarity_score_threshold",
            search_kwargs={"k": _top_k(), "score_threshold": _score_threshold()},
        )
    return _CACHE["retriever"]


def _get_llm(creativity):
    temperature = round(_temperature_for(creativity), 2)
    cached = _CACHE["llms"].get(temperature)
    if cached is None:
        from langchain_google_genai import ChatGoogleGenerativeAI

        cached = ChatGoogleGenerativeAI(
            model=_env("GOOGLE_RECIPE_MODEL", "models/gemini-2.5-flash"),
            google_api_key=_env("GOOGLE_API_KEY", required=True),
            temperature=temperature,
        )
        _CACHE["llms"][temperature] = cached
    return cached


# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

_NO_RECIPE_SENTINEL = "No suitable recipe found"

_PROMPT_TEMPLATE = """You are a professional AI cooking assistant for a restaurant.

Rules:
- Use ONLY the recipes provided in the Context below.
- Do NOT invent recipes or use any knowledge outside the Context.
- Prefer the recipe that matches the MOST of the user's ingredients.
- If no recipe in the Context is a suitable match, respond with EXACTLY this text and nothing else: {sentinel}
- Otherwise respond with STRICT JSON only (no markdown, no code fences, no commentary).

The JSON MUST have exactly this shape:
{{
  "name": "Dish Name",
  "description": "A short, appetising description of the dish.",
  "style": "cuisine or style, or empty string",
  "prepTime": "30 min",
  "difficulty": "Easy",
  "whatsNew": "1-2 sentences on what makes THIS version new or different (the twist, the chosen ingredients, the technique).",
  "whyItMatters": "1-2 sentences on why this dish is worth putting on the menu (appeal, uses in-stock items, margin, crowd-pleaser, etc.).",
  "steps": ["step 1", "step 2"],
  "ingredients": [{{ "name": "tomato", "quantity": 200, "unit": "g" }}],
  "estimatedCost": 0,
  "suggestedPrice": 0,
  "profitMargin": 0
}}
- "difficulty" must be one of: Easy, Medium, Hard.
- "prepTime" must be a human-readable duration like "25 min".
- "whatsNew" and "whyItMatters" must be non-empty, plain prose (no JSON, no lists).
- Numeric fields (quantity, estimatedCost, suggestedPrice, profitMargin) must be plain numbers.
- estimatedCost and suggestedPrice are in Egyptian Pounds (EGP); profitMargin is a percentage number.
- ALWAYS provide realistic NON-ZERO estimates for estimatedCost and suggestedPrice based on
  typical restaurant ingredient costs in Egypt (suggestedPrice should comfortably exceed
  estimatedCost). Never leave them at 0.

Context:
{context}

User request:
{question}
"""


def _build_question(ingredients, style, favorite_ingredients, customer_context):
    parts = ["Ingredients: " + ", ".join(ingredients) + "."]
    if style and str(style).strip():
        parts.append("Preferred style: " + str(style).strip() + ".")
    if favorite_ingredients:
        favs = ", ".join(normalize_ingredients(favorite_ingredients))
        if favs:
            parts.append("Customer-favourite ingredients to feature when sensible: " + favs + ".")
    if customer_context and str(customer_context).strip():
        parts.append(str(customer_context).strip())
    return "\n".join(parts)


def _format_docs(docs):
    return "\n\n-------------------\n\n".join(getattr(d, "page_content", str(d)) for d in docs)


def _strip_json(text):
    """Extract a JSON object from a model response, tolerating markdown fences."""
    cleaned = (text or "").strip()
    # Strip ``` / ```json fences if present.
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", cleaned, re.DOTALL)
    if fence:
        cleaned = fence.group(1).strip()
    # Fall back to the first {...} block.
    if not cleaned.startswith("{"):
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            cleaned = cleaned[start:end + 1]
    return cleaned


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def generate_recipe(
    ingredients,
    style=None,
    creativity=None,
    favorite_ingredients=None,
    customer_context=None,
):
    """Generate a recipe from retrieved context.

    Returns a dict matching the Node persistence shape, or raises
    NoSuitableRecipeError / UpstreamRecipeError.
    """
    norm_ingredients = normalize_ingredients(ingredients)
    if not norm_ingredients:
        raise NoSuitableRecipeError()

    question = _build_question(norm_ingredients, style, favorite_ingredients, customer_context)
    structured_query = "Ingredients:\n" + ", ".join(norm_ingredients)

    try:
        retriever = _get_retriever()
        docs = retriever.invoke(structured_query)
    except (NoSuitableRecipeError, UpstreamRecipeError):
        raise
    except Exception as exc:  # noqa: BLE001 - surface as a clean upstream error
        raise UpstreamRecipeError(f"retrieval_failed:{exc}") from exc

    if not docs:
        raise NoSuitableRecipeError()

    context = _format_docs(docs)
    prompt = _PROMPT_TEMPLATE.format(
        sentinel=_NO_RECIPE_SENTINEL, context=context, question=question
    )

    try:
        result = _get_llm(creativity).invoke(prompt)
    except Exception as exc:  # noqa: BLE001
        raise UpstreamRecipeError(f"generation_failed:{exc}") from exc

    raw = getattr(result, "content", result)
    if isinstance(raw, list):  # some chat models return content parts
        raw = "".join(str(p) for p in raw)
    raw = str(raw or "").strip()

    if not raw:
        raise UpstreamRecipeError("empty_generation")

    # Gemini was told to answer with the exact sentinel when nothing fits.
    if _NO_RECIPE_SENTINEL.lower() in raw.lower() and "{" not in raw:
        raise NoSuitableRecipeError()

    cleaned = _strip_json(raw)
    try:
        recipe = json.loads(cleaned)
    except (ValueError, TypeError) as exc:
        raise UpstreamRecipeError("malformed_recipe_json") from exc

    if not isinstance(recipe, dict) or not recipe.get("name"):
        raise UpstreamRecipeError("malformed_recipe_json")

    recipe["rag"] = {
        "matched": True,
        "sourceCount": len(docs),
        "scoreThreshold": _score_threshold(),
    }
    return recipe
