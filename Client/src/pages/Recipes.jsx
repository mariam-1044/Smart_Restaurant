import React, { useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { useAuth } from "../context/AuthContext";
import useRecipes from "../hooks/useRecipes";
import { rateRecipe } from "../api/aiApi";
import PageHeader from "../components/shared/PageHeader";
import Button from "../components/shared/Button";
import Badge from "../components/shared/Badge";
import Skeleton from "../components/shared/Skeleton";

export default function Recipes() {
  const { user } = useAuth();
  const isStaff = user && (user.role === "admin" || user.role === "staff");

  const {
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
  } = useRecipes({ isStaff });

  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [selectedFavorites, setSelectedFavorites] = useState([]);
  const [creativity, setCreativity] = useState(7);
  const [styleHint, setStyleHint] = useState("");
  const [customFavoriteInput, setCustomFavoriteInput] = useState("");

  // Once availableIngredients loads, default-select all of them — only on the
  // first arrival so that a user-driven "Clear all" stays cleared.
  const ingredientsInitRef = React.useRef(false);
  React.useEffect(() => {
    if (!ingredientsInitRef.current && availableIngredients.length > 0) {
      setSelectedIngredients(availableIngredients);
      ingredientsInitRef.current = true;
    }
  }, [availableIngredients]);

  const addIngredient = (name) =>
    setSelectedIngredients((prev) => (prev.includes(name) ? prev : [...prev, name]));
  const removeIngredient = (name) =>
    setSelectedIngredients((prev) => prev.filter((n) => n !== name));

  const addFavorite = (name) => {
    const clean = String(name || "").trim().slice(0, 60);
    if (!clean) return;
    setSelectedFavorites((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
  };
  const removeFavorite = (name) =>
    setSelectedFavorites((prev) => prev.filter((n) => n !== name));

  const handleAddCustomFavorite = (e) => {
    if (e) e.preventDefault();
    if (!customFavoriteInput.trim()) return;
    addFavorite(customFavoriteInput);
    setCustomFavoriteInput("");
  };

  const handleGenerate = async (personalized = false) => {
    const ingredientsToUse = selectedIngredients.length > 0 ? selectedIngredients : availableIngredients;
    await generate({
      ingredients: ingredientsToUse,
      favorites: selectedFavorites,
      creativity,
      style: styleHint,
      personalized,
    });
  };

  const handleRatePublishedRecipe = async (score) => {
    if (!recipe || !recipe.publishedDish || !user || user.role !== "customer") return;
    try {
      const r = await rateRecipe(user._id, recipe.publishedDish, score);
      if (r.ok) {
        setSuccess(
          r.published
            ? `Thanks! Your ${score}-star rating shared this recipe with similar diners.`
            : `Thanks for the ${score}-star rating.`
        );
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || "Could not save rating.");
    }
  };

  const handleDeleteRecipe = async (id, e) => {
    if (e) e.stopPropagation();
    if (!id) return;
    const target = history.find((h) => h._id === id);
    const name = target?.name || "this recipe";
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await remove(id);
  };

  const handlePublishToMenu = async () => {
    if (!recipe || !recipe._id) return;
    const defaultPrice = recipe.suggestedPrice > 0 ? recipe.suggestedPrice : 10;
    const priceStr = window.prompt(
      `Publish "${recipe.name}" to the menu.\nEnter price in EGP:`,
      String(defaultPrice)
    );
    if (priceStr === null) return;
    const price = Number(priceStr);
    if (!price || price <= 0) {
      setError("Invalid price.");
      return;
    }
    const category = window.prompt(
      "Category (Pizza, Grills, Drinks, Desserts, Sides, Burgers, Pasta, Main):",
      "Main"
    );
    if (category === null) return;
    await publish({ price, category });
  };

  const placeholderRecipe = {
    name: "No recipe yet",
    description:
      "Click 'Generate New Recipe' to create your first AI-powered dish based on what's in stock.",
    prepTime: "—",
    difficulty: "—",
    whatsNew: "",
    whyItMatters: "",
    steps: [],
    ingredients: [],
    ingredientCost: 0,
    suggestedPrice: 0,
    estimatedProfit: 0,
    status: "draft",
  };

  const displayRecipe = recipe || placeholderRecipe;
  const isPublished = displayRecipe.status === "published";
  const canDeleteCurrent = recipe && recipe._id && !isPublished;
  const creativityLabel =
    creativity >= 8 ? "Bold & inventive" : creativity >= 5 ? "Creative twist" : "Classic & familiar";

  return (
    <DashboardLayout>
      <div className="recipes-page-wrapper">
        <PageHeader
          kicker="AI Studio"
          title="Recipe Generator"
          subtitle="Compose new dishes from in-stock ingredients with the Gusteau AI engine."
        />

        <div className="recipes-layout">
          <aside className="recipe-history">
            <div className="history-header">My Recipe History ({history.length})</div>
            {history.length === 0 ? (
              <p className="history-empty">No recipes yet.</p>
            ) : (
              <ul className="history-list">
                {history.map((item) => {
                  const itemPublished = item.status === "published";
                  const canDeleteThis = isStaff || String(item.generatedBy) === String(user?._id);
                  const isActive = recipe && recipe._id === item._id;
                  return (
                    <li
                      key={item._id}
                      className={`history-item ${isActive ? "active" : ""}`}
                      onClick={() => select(item)}
                    >
                      <div className="history-item-name">{item.name}</div>
                      <div className="history-item-meta">
                        <Badge tone={itemPublished ? "success" : "warning"} size="sm">
                          {item.status || "draft"}
                        </Badge>
                        <span className="history-item-date">
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                        </span>
                      </div>
                      {canDeleteThis && !itemPublished && (
                        <button
                          type="button"
                          className="history-delete-btn"
                          onClick={(e) => handleDeleteRecipe(item._id, e)}
                          disabled={deletingId === item._id}
                          title="Delete this recipe"
                        >
                          {deletingId === item._id ? "…" : "🗑 Delete"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          <div className="recipe-card-large">
            {error && <div className="recipe-msg recipe-msg-error">{error}</div>}
            {success && <div className="recipe-msg recipe-msg-success">{success}</div>}

            {isStaff && (
              <div className="rg-config">
                <div className="rg-config-head">
                  <div>
                    <h3 className="rg-title">Recipe generation settings</h3>
                    <p className="rg-sub">Pick what the AI should work with, then click Generate at the bottom.</p>
                  </div>
                  <div className="rg-summary-badge">
                    {selectedIngredients.length} ingredients · {selectedFavorites.length} favorites · creativity {creativity}
                  </div>
                </div>

                <div className="rg-grid">
                  <section className="rg-card">
                    <div className="rg-card-head">
                      <h4>Ingredients to use</h4>
                      <div className="rg-card-actions">
                        <button type="button" className="rg-link" onClick={() => setSelectedIngredients(availableIngredients)}>Select all</button>
                        <button type="button" className="rg-link" onClick={() => setSelectedIngredients([])}>Clear all</button>
                      </div>
                    </div>
                    <div className="rg-counter">{selectedIngredients.length} of {availableIngredients.length} selected</div>
                    {availableIngredients.length === 0 ? (
                      <p className="rg-empty">No ingredients in stock. Add some via Inventory.</p>
                    ) : (
                      <ul className="rg-checklist">
                        {availableIngredients.map((name) => {
                          const checked = selectedIngredients.includes(name);
                          return (
                            <li key={name}>
                              <label className={`rg-check ${checked ? "rg-check-on" : ""}`}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => (checked ? removeIngredient(name) : addIngredient(name))}
                                />
                                <span className="rg-check-name">{name}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>

                  <section className="rg-card">
                    <div className="rg-card-head">
                      <h4>Customer favorites to feature</h4>
                      <div className="rg-card-actions">
                        <button type="button" className="rg-link" onClick={() => setSelectedFavorites([])}>Clear</button>
                      </div>
                    </div>
                    <div className="rg-counter">{selectedFavorites.length} featured</div>
                    <p className="rg-hint">From customer preference profiles. The AI will try to feature what you check.</p>

                    {customerFavorites.length === 0 && selectedFavorites.length === 0 ? (
                      <p className="rg-empty">No customer favorites recorded yet — add a custom one below.</p>
                    ) : (
                      <ul className="rg-checklist">
                        {customerFavorites.map((fav) => {
                          const checked = selectedFavorites.includes(fav.name);
                          return (
                            <li key={fav.name}>
                              <label className={`rg-check ${checked ? "rg-check-on rg-check-fav" : ""}`}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => (checked ? removeFavorite(fav.name) : addFavorite(fav.name))}
                                />
                                <span className="rg-check-name">{fav.name}</span>
                                <span className="rg-pop-badge" title={`${fav.count} customer${fav.count > 1 ? "s" : ""}`}>×{fav.count}</span>
                              </label>
                            </li>
                          );
                        })}
                        {selectedFavorites
                          .filter((n) => !customerFavorites.some((f) => f.name === n))
                          .map((name) => (
                            <li key={`custom-${name}`}>
                              <label className="rg-check rg-check-on rg-check-fav">
                                <input type="checkbox" checked onChange={() => removeFavorite(name)} />
                                <span className="rg-check-name">{name}</span>
                                <span className="rg-pop-badge">custom</span>
                              </label>
                            </li>
                          ))}
                      </ul>
                    )}

                    <form onSubmit={handleAddCustomFavorite} className="rg-add-row">
                      <input
                        type="text"
                        value={customFavoriteInput}
                        onChange={(e) => setCustomFavoriteInput(e.target.value)}
                        placeholder="Add a custom favorite (e.g. truffle)"
                        maxLength={60}
                        className="rg-input"
                      />
                      <button type="submit" className="rg-btn-add" disabled={!customFavoriteInput.trim()}>Add</button>
                    </form>
                  </section>
                </div>

                <div className="rg-row">
                  <div className="rg-card rg-card-tight">
                    <h4>Creativity: <span className="rg-creativity-num">{creativity}</span> <span className="rg-creativity-tag">{creativityLabel}</span></h4>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={creativity}
                      onChange={(e) => setCreativity(Number(e.target.value))}
                      className="rg-slider"
                    />
                    <div className="rg-slider-labels">
                      <span>Classic</span>
                      <span>Balanced</span>
                      <span>Bold</span>
                    </div>
                  </div>
                  <div className="rg-card rg-card-tight">
                    <h4>Style hint (optional)</h4>
                    <input
                      type="text"
                      value={styleHint}
                      onChange={(e) => setStyleHint(e.target.value)}
                      placeholder="e.g. Mediterranean, Comfort food"
                      maxLength={50}
                      className="rg-input"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="card-header-section">
              <div className="recipe-main-info">
                <Badge tone={isPublished ? "success" : "gold"} glow>
                  {isPublished ? "Published" : "Featured"}
                </Badge>
                {loading ? (
                  <div className="recipe-skeleton">
                    <Skeleton width="70%" height={36} radius={10} />
                    <Skeleton.Block lines={2} />
                  </div>
                ) : (
                  <>
                    <h1 className="recipe-title">{displayRecipe.name}</h1>
                    <p className="recipe-lead-text">{displayRecipe.description}</p>
                  </>
                )}
                <div className="recipe-meta">
                  <div className="meta-item">
                    <span className="meta-label">Prep Time</span>
                    <span className="meta-value">{displayRecipe.prepTime}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Difficulty</span>
                    <span className="meta-value">{displayRecipe.difficulty}</span>
                  </div>
                  {displayRecipe.style && (
                    <div className="meta-item">
                      <span className="meta-label">Style</span>
                      <span className="meta-value">{displayRecipe.style}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {!loading && displayRecipe.whatsNew && (
              <>
                <hr className="premium-divider" />
                <div className="recipe-callout recipe-callout-new">
                  <h3 className="section-subtitle">✨ What's new in this recipe</h3>
                  <p className="recipe-callout-text">{displayRecipe.whatsNew}</p>
                </div>
              </>
            )}

            <hr className="premium-divider" />

            <div className="ingredients-container">
              <h3 className="section-subtitle">Required Ingredients</h3>
              {loading ? (
                <Skeleton.Block lines={4} />
              ) : displayRecipe.ingredients.length === 0 ? (
                <p className="muted">No ingredients listed.</p>
              ) : (
                <ul className="ingredients-grid">
                  {displayRecipe.ingredients.map((ingredient, index) => (
                    <li key={index}>
                      <span className="dot-icon"></span> {ingredient}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {!loading && displayRecipe.steps && displayRecipe.steps.length > 0 && (
              <>
                <hr className="premium-divider" />
                <div className="howto-container">
                  <h3 className="section-subtitle">👨‍🍳 How to prepare</h3>
                  <ol className="howto-steps">
                    {displayRecipe.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              </>
            )}

            {!loading && displayRecipe.whyItMatters && (
              <>
                <hr className="premium-divider" />
                <div className="recipe-callout recipe-callout-why">
                  <h3 className="section-subtitle">💡 Why it's important</h3>
                  <p className="recipe-callout-text">{displayRecipe.whyItMatters}</p>
                </div>
              </>
            )}

            <hr className="premium-divider" />

            {user && user.role === "customer" && isPublished && recipe && recipe.publishedDish && (
              <div className="rating-row">
                <span className="rating-prompt">Tried this dish? Rate it:</span>
                <div className="rating-stars">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="rating-star"
                      onClick={() => handleRatePublishedRecipe(s)}
                      title={`${s} star${s > 1 ? "s" : ""}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <span className="rating-hint">4★ or 5★ shares it with similar diners.</span>
              </div>
            )}

            <div className="card-action-footer">
              <div className="financial-summary">
                <div className="stat-box">
                  <span className="stat-label">Ingredient Cost</span>
                  <span className="stat-value">{(displayRecipe.ingredientCost || 0).toFixed(2)} EGP</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Suggested Price</span>
                  <span className="stat-value">{(displayRecipe.suggestedPrice || 0).toFixed(2)} EGP</span>
                </div>
                <div className="stat-box profit-highlight">
                  <span className="stat-label">Estimated Profit</span>
                  <span className="stat-value">{(displayRecipe.estimatedProfit || 0).toFixed(2)} EGP</span>
                </div>
              </div>

              <div className="buttons-group">
                {canDeleteCurrent && (
                  <Button
                    variant="danger"
                    onClick={() => handleDeleteRecipe(recipe._id)}
                    disabled={deletingId === recipe._id}
                  >
                    {deletingId === recipe._id ? "Deleting…" : "🗑 Delete"}
                  </Button>
                )}
                {isStaff && recipe && recipe._id && !isPublished && (
                  <Button variant="gold" onClick={handlePublishToMenu} loading={publishing}>
                    {publishing ? "Publishing…" : "📋 Save to Menu"}
                  </Button>
                )}
                {user && user.role === "customer" && (
                  <Button
                    variant="primary"
                    onClick={() => handleGenerate(true)}
                    loading={loading}
                    title="Uses your preferences + order history + current stock"
                  >
                    {loading ? "Generating..." : "★ For Me"}
                  </Button>
                )}
                <Button onClick={() => handleGenerate(false)} loading={loading}>
                  {loading ? "Generating..." : "✓ Generate New Recipe"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .recipes-page-wrapper { padding: 28px; }
        .recipes-layout { display: grid; grid-template-columns: 300px 1fr; gap: 22px; }
        .recipe-history {
          padding: 18px;
          border-radius: var(--radius-lg);
          max-height: 80vh; overflow-y: auto;
        }
        .history-header { font-family: var(--font-heading); font-weight: 700; font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 14px; }
        .history-empty { color: var(--text-muted); font-size: 13px; }
        .history-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
        .history-item {
          padding: 12px;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          cursor: pointer;
          transition: border-color 200ms var(--ease-out-expo), background-color 200ms var(--ease-out-expo);
          position: relative;
        }
        .history-item:hover { border-color: var(--accent-gold); }
        .history-item-name { font-weight: 600; font-size: 13px; color: var(--text-primary); margin-bottom: 6px; line-height: 1.3; }
        .history-item-meta { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .history-item-date { font-size: 11px; color: var(--text-muted); }
        .history-delete-btn { margin-top: 8px; width: 100%; padding: 6px 8px; font-size: 11px; background: rgba(215,38,56,0.08); color: var(--accent-red); border: 1px solid rgba(215,38,56,0.3); border-radius: 8px; cursor: pointer; transition: all 160ms var(--ease-out-expo); }
        .history-delete-btn:hover:not(:disabled) { background: var(--accent-red); color: #fff; }

        .recipe-card-large { padding: 26px; border-radius: var(--radius-xl); }
        .recipe-msg { padding: 12px 14px; border-radius: 12px; font-size: 13px; margin-bottom: 12px; }
        .recipe-msg-error { background: var(--status-danger-bg); color: var(--status-danger-fg); border: 1px solid rgba(215,38,56,0.32); }
        .recipe-msg-success { background: var(--status-success-bg); color: var(--status-success-fg); border: 1px solid rgba(16,185,129,0.32); }

        .rg-config { padding: 18px; border-radius: var(--radius-lg); margin-bottom: 22px; border: 1px solid var(--border-color); }
        .rg-config-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
        .rg-title { margin: 0 0 4px 0; font-size: 18px; color: var(--text-primary); font-family: var(--font-heading); }
        .rg-sub { margin: 0; color: var(--text-secondary); font-size: 13px; }
        .rg-summary-badge { background: rgba(155,226,45,0.12); color: var(--accent-gold); padding: 6px 12px; border-radius: 999px; font-size: 11px; font-weight: 600; white-space: nowrap; border: 1px solid rgba(155,226,45,0.32); }
        .rg-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .rg-card { padding: 14px; border-radius: 12px; }
        .rg-card-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
        .rg-card-head h4 { margin: 0; font-size: 14px; color: var(--text-primary); font-family: var(--font-heading); }
        .rg-card-actions { display: flex; gap: 12px; }
        .rg-link { background: none; border: none; color: var(--accent-gold); cursor: pointer; font-size: 12px; padding: 0; text-decoration: underline; font-weight: 500; }
        .rg-counter { font-size: 12px; color: var(--text-muted); margin-bottom: 8px; font-weight: 500; }
        .rg-hint { font-size: 12px; color: var(--text-muted); margin: 0 0 10px 0; }
        .rg-empty { font-size: 13px; color: var(--text-muted); padding: 12px; text-align: center; border: 1px dashed var(--border-color); border-radius: 8px; margin: 0; }
        .rg-checklist { list-style: none; padding: 0; margin: 0; max-height: 220px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 10px; }
        .rg-checklist li { border-bottom: 1px solid var(--border-color); }
        .rg-checklist li:last-child { border-bottom: none; }
        .rg-check { display: flex; align-items: center; gap: 10px; padding: 10px 12px; cursor: pointer; transition: background-color .12s; user-select: none; }
        .rg-check:hover { background: var(--bg-elevated); }
        .rg-check input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; accent-color: var(--accent-red); flex-shrink: 0; margin: 0; }
        .rg-check-name { flex: 1; font-size: 14px; }
        .rg-check-on { background: rgba(215,38,56,0.10); }
        .rg-check-on .rg-check-name { color: var(--text-primary); font-weight: 500; }
        .rg-check-fav input[type="checkbox"] { accent-color: var(--accent-gold); }
        .rg-check-fav.rg-check-on { background: rgba(155,226,45,0.10); }
        .rg-check-fav.rg-check-on .rg-check-name { color: var(--accent-gold); }
        .rg-pop-badge { font-size: 11px; color: var(--text-muted); background: var(--bg-elevated); padding: 2px 8px; border-radius: 999px; font-weight: 500; }
        .rg-add-row { display: flex; gap: 8px; margin-top: 10px; }
        .rg-input { flex: 1; padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 10px; font-size: 13px; outline: none; background: var(--bg-secondary); color: var(--text-primary); transition: border-color 160ms var(--ease-out-expo), box-shadow 160ms var(--ease-out-expo); }
        .rg-input:focus { border-color: var(--accent-gold); box-shadow: 0 0 0 3px rgba(155,226,45,0.18); }
        .rg-btn-add { padding: 9px 18px; background: var(--accent-gold); color: #1A1408; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 13px; transition: all 200ms var(--ease-out-expo); font-family: var(--font-heading); }
        .rg-btn-add:hover:not(:disabled) { box-shadow: var(--glow-gold); transform: translateY(-1px); }
        .rg-btn-add:disabled { opacity: 0.5; cursor: not-allowed; }
        .rg-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
        .rg-creativity-num { color: var(--accent-red); font-size: 18px; }
        .rg-creativity-tag { font-size: 11px; color: var(--text-muted); font-weight: 400; margin-left: 4px; }
        .rg-slider { width: 100%; accent-color: var(--accent-red); }
        .rg-slider-labels { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-top: 4px; }

        .card-header-section { margin-bottom: 12px; display: flex; flex-direction: column; gap: 14px; }
        .recipe-main-info { display: flex; flex-direction: column; gap: 14px; }
        .recipe-skeleton { display: flex; flex-direction: column; gap: 10px; }
        .recipe-title { font-family: var(--font-heading); font-size: clamp(28px, 3.6vw, 40px); font-weight: 700; color: var(--text-primary); margin: 0; letter-spacing: -0.02em; line-height: 1.05; }
        .recipe-lead-text { color: var(--text-secondary); line-height: 1.6; margin: 0; font-size: 15px; }
        .recipe-meta { display: flex; gap: 30px; margin-top: 6px; flex-wrap: wrap; }
        .meta-item { display: flex; flex-direction: column; gap: 4px; }
        .meta-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; font-family: var(--font-heading); font-weight: 600; }
        .meta-value { font-size: 15px; color: var(--text-primary); font-weight: 600; }
        .premium-divider { border: none; border-top: 1px solid var(--border-color); margin: 22px 0; }
        .ingredients-container { margin-bottom: 12px; }
        .section-subtitle { font-family: var(--font-heading); font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 14px; }
        .ingredients-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; list-style: none; padding: 0; margin: 0; }
        .ingredients-grid li { display: flex; align-items: center; gap: 10px; color: var(--text-secondary); font-size: 14px; }
        .dot-icon { width: 6px; height: 6px; background: var(--accent-gold); border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 8px rgba(155,226,45,0.6); }
        .muted { color: var(--text-muted); }
        .recipe-callout { margin: 4px 0; padding: 14px 16px; border-radius: var(--radius-lg, 14px); border: 1px solid var(--border-color); }
        .recipe-callout-new { background: rgba(155,226,45,0.08); border-color: color-mix(in srgb, var(--accent-gold, #C9A227) 30%, transparent); }
        .recipe-callout-why { background: rgba(16,185,129,0.08); border-color: rgba(16,185,129,0.30); }
        .recipe-callout-text { margin: 0; color: var(--text-secondary); line-height: 1.6; font-size: 14px; }
        .howto-container { margin-bottom: 12px; }
        .howto-steps { margin: 0; padding-left: 22px; display: flex; flex-direction: column; gap: 10px; }
        .howto-steps li { color: var(--text-secondary); font-size: 14px; line-height: 1.55; padding-left: 4px; }
        .howto-steps li::marker { color: var(--accent-gold, #C9A227); font-weight: 700; }
        .card-action-footer { display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-top: 16px; flex-wrap: wrap; }
        .financial-summary { display: flex; gap: 14px; }
        .stat-box { display: flex; flex-direction: column; gap: 5px; padding: 14px 16px; background: var(--bg-elevated); border-radius: 12px; min-width: 150px; border: 1px solid var(--border-color); }
        .stat-box.profit-highlight { background: rgba(16,185,129,0.10); border-color: rgba(16,185,129,0.32); }
        .stat-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; font-family: var(--font-heading); font-weight: 600; }
        .stat-value { font-size: 18px; color: var(--text-primary); font-weight: 700; font-family: var(--font-heading); }
        .buttons-group { display: flex; gap: 10px; flex-wrap: wrap; }

        .rating-row { display: flex; align-items: center; gap: 12px; padding: 14px; background: rgba(155,226,45,0.10); border: 1px solid rgba(155,226,45,0.32); border-radius: 12px; margin-bottom: 18px; flex-wrap: wrap; }
        .rating-prompt { font-weight: 600; color: var(--text-primary); font-size: 14px; }
        .rating-stars { display: flex; gap: 4px; }
        .rating-star { background: none; border: none; cursor: pointer; color: var(--accent-gold); font-size: 22px; line-height: 1; padding: 0 2px; transition: transform 160ms var(--ease-out-expo); }
        .rating-star:hover { transform: scale(1.2); }
        .rating-hint { color: var(--text-muted); font-size: 12px; }

        @media (max-width: 900px) { .recipes-layout { grid-template-columns: 1fr; } .rg-grid, .rg-row { grid-template-columns: 1fr; } }
        @media (max-width: 768px) { .card-action-footer { flex-direction: column; align-items: stretch; } .ingredients-grid { grid-template-columns: 1fr; } }
      `}</style>
    </DashboardLayout>
  );
}
