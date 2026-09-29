import api from "./axios";
import { aiCall } from "./aiCall";

/* Recipes -------------------------------------------------------------- */

export const listRecipes = (limit = 20) =>
  api.get(`/v1/ai/recipes?limit=${limit}`).then((r) => r.data?.data ?? []);

export const generateRecipe = (payload) =>
  api.post("/v1/ai/recipe", payload).then((r) => r.data);

export const generatePersonalizedRecipe = () =>
  api.post("/v1/ai/recipe/personalized", {}).then((r) => r.data);

export const deleteRecipe = (id) =>
  api.delete(`/v1/ai/recipes/${id}`).then((r) => r.data);

export const publishRecipe = (id, { price, category }) =>
  api.post(`/v1/ai/recipes/${id}/publish`, { price, category }).then((r) => r.data?.data);

export const listCustomerFavorites = (limit = 30) =>
  api.get(`/v1/ai/customer-favorites?limit=${limit}`).then((r) => r.data?.data ?? []);

/* Forecast ------------------------------------------------------------- */

export const fetchDemandForecast = (dishId, daysAhead = 7) =>
  aiCall("post", "/v1/ai/forecast", { dishId, daysAhead });

/* Recommendations ------------------------------------------------------ */

export const listPeerEndorsements = (limit = 8) =>
  api
    .get(`/v1/recommendations/peer-endorsements?limit=${limit}`)
    .then((r) => r.data?.data ?? []);

export const rateRecipe = (userId, dishId, score) =>
  api
    .post(`/v1/recommendations/${userId}/rate-recipe`, { dishId, score })
    .then((r) => r.data);
