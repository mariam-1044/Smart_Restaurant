import { useCallback, useEffect, useState } from "react";
import {
  listRecipes,
  generateRecipe,
  generatePersonalizedRecipe,
  deleteRecipe,
  publishRecipe,
  listCustomerFavorites,
} from "../api/aiApi";
import { listInventory } from "../api/inventoryApi";

function normalizeRecipe(data) {
  if (!data) return null;
  const ingredients = Array.isArray(data.ingredients)
    ? data.ingredients.map((it) =>
        typeof it === "string"
          ? it
          : `${it.quantity ?? ""} ${it.unit ?? ""} ${it.name ?? ""}`.trim()
      )
    : [];
  const cost = Number(data.estimatedCost ?? 0);
  const price = Number(data.suggestedPrice ?? 0);
  const steps = Array.isArray(data.steps)
    ? data.steps.map((s) => String(s)).filter(Boolean)
    : [];
  return {
    _id: data._id,
    name: data.name || "Generated Recipe",
    description: data.description || "",
    style: data.style || "",
    prepTime: data.prepTime || "—",
    difficulty: data.difficulty || "—",
    whatsNew: data.whatsNew || "",
    whyItMatters: data.whyItMatters || "",
    steps,
    ingredients,
    ingredientCost: cost,
    suggestedPrice: price,
    estimatedProfit: Math.max(0, price - cost),
    status: data.status || "draft",
    publishedDish: data.publishedDish || null,
    createdAt: data.createdAt || null,
    generatedBy: data.generatedBy || null,
  };
}

/**
 * useRecipes — pulls recipe history, current selection, available ingredients,
 * customer favourites, and the generate/publish/delete lifecycle.
 *
 * Designed to keep the Recipes page declarative.
 */
export default function useRecipes({ isStaff = false } = {}) {
  const [recipe, setRecipe] = useState(null);
  const [history, setHistory] = useState([]);
  const [availableIngredients, setAvailableIngredients] = useState([]);
  const [customerFavorites, setCustomerFavorites] = useState([]);

  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadHistory = useCallback(async () => {
    try {
      const items = await listRecipes(20);
      setHistory(items);
      if (items.length > 0) setRecipe(normalizeRecipe(items[0]));
      else setRecipe(null);
    } catch (err) {
      console.error("Error loading recipe history:", err);
    }
  }, []);

  const fetchIngredients = useCallback(async () => {
    try {
      const data = await listInventory();
      const names = (data || [])
        .filter((item) => Number(item.quantity) > 0)
        .map((item) => item.name);
      setAvailableIngredients(names);
      return names;
    } catch (err) {
      console.error("Error fetching ingredients:", err);
      return [];
    }
  }, []);

  const fetchFavorites = useCallback(async () => {
    try {
      const data = await listCustomerFavorites(30);
      setCustomerFavorites(data || []);
    } catch (err) {
      console.error("Error fetching customer favorites:", err);
    }
  }, []);

  useEffect(() => {
    fetchIngredients();
    loadHistory();
  }, [fetchIngredients, loadHistory]);

  useEffect(() => {
    if (isStaff) fetchFavorites();
  }, [isStaff, fetchFavorites]);

  const generate = useCallback(
    async ({ ingredients, favorites, creativity, style, personalized = false }) => {
      setLoading(true);
      setError("");
      setSuccess("");
      try {
        let response;
        if (personalized) {
          response = await generatePersonalizedRecipe();
        } else {
          if (!ingredients || ingredients.length === 0) {
            throw new Error("Pick at least one ingredient or add inventory first.");
          }
          const payload = { ingredients, creativity };
          if (favorites && favorites.length > 0) payload.favoriteIngredients = favorites;
          if (style && style.trim()) payload.style = style.trim().slice(0, 50);
          response = await generateRecipe(payload);
        }
        const normalized = normalizeRecipe(response);
        setRecipe(normalized);
        setSuccess(
          personalized
            ? "Personalized recipe generated using your preferences and history."
            : "Recipe generated and saved to your history."
        );
        loadHistory();
        return normalized;
      } catch (err) {
        const apiErr = err.response?.data;
        setError(
          apiErr?.error?.message ||
            apiErr?.message ||
            err.message ||
            "Error generating recipe"
        );
        return null;
      } finally {
        setLoading(false);
      }
    },
    [loadHistory]
  );

  const remove = useCallback(
    async (id) => {
      if (!id) return false;
      setDeletingId(id);
      setError("");
      setSuccess("");
      try {
        await deleteRecipe(id);
        const target = history.find((h) => h._id === id);
        setSuccess(`Deleted "${target?.name || "recipe"}".`);
        if (recipe && recipe._id === id) setRecipe(null);
        await loadHistory();
        return true;
      } catch (err) {
        const apiErr = err.response?.data;
        setError(apiErr?.message || err.message || "Failed to delete recipe.");
        return false;
      } finally {
        setDeletingId(null);
      }
    },
    [history, recipe, loadHistory]
  );

  const publish = useCallback(
    async ({ price, category }) => {
      if (!recipe || !recipe._id) return null;
      setPublishing(true);
      setError("");
      setSuccess("");
      try {
        const data = await publishRecipe(recipe._id, { price, category });
        setSuccess(`Published! "${data.dish.name}" is now in the menu.`);
        await loadHistory();
        setRecipe((r) =>
          r ? { ...r, status: "published", publishedDish: data.dish._id } : r
        );
        return data;
      } catch (err) {
        const apiErr = err.response?.data;
        if (err.response?.status === 409) {
          setError("This recipe was already published.");
        } else {
          setError(apiErr?.message || err.message || "Failed to publish recipe.");
        }
        return null;
      } finally {
        setPublishing(false);
      }
    },
    [recipe, loadHistory]
  );

  const select = useCallback((item) => {
    setRecipe(normalizeRecipe(item));
    setError("");
    setSuccess("");
  }, []);

  return {
    recipe,
    history,
    availableIngredients,
    customerFavorites,
    loading,
    publishing,
    deletingId,
    error,
    success,
    setError,
    setSuccess,
    select,
    generate,
    remove,
    publish,
    refreshFavorites: fetchFavorites,
  };
}
