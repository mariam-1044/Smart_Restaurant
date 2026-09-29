import { useState, useEffect, useRef } from "react";
import IngredientLinker from "./IngredientLinker";

const CATEGORIES = ["Pizza", "Grills", "Drinks", "Desserts", "Sides", "Burgers", "Pasta", "Main"];

export default function DishFormModal({
  isOpen,
  mode,
  dish,
  ingredientOptions,
  onSubmit,
  onCancel,
  submitting,
  validationErrors,
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ingredients, setIngredients] = useState([]);
  const confirmRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setName(dish?.name || "");
      setDescription(dish?.description || "");
      setCategory(dish?.category || CATEGORIES[0]);
      setPrice(dish?.price ?? "");
      setImageUrl(dish?.imageUrl || "");
      setIngredients(
        (dish?.ingredients || []).map((i) => ({
          ingredientId:
            i.ingredient?._id || i.ingredient?.toString?.() || i.ingredientId || "",
          quantity: i.quantity || 1,
          unit: i.unit || "",
        }))
      );
      confirmRef.current?.focus();
    }
  }, [isOpen, dish]);

  useEffect(() => {
    if (isOpen) {
      const handleEsc = (e) => {
        if (e.key === "Escape") onCancel();
      };
      document.addEventListener("keydown", handleEsc);
      return () => document.removeEventListener("keydown", handleEsc);
    }
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      name,
      description,
      category,
      price: parseFloat(price) || 0,
      imageUrl,
      ingredients: ingredients.map((i) => ({
        ingredient: i.ingredientId,
        quantity: i.quantity,
      })),
      isAvailable: dish?.isAvailable ?? true,
    };
    if (mode === "edit" && dish) {
      payload.__version = dish.version;
    }
    onSubmit(payload);
  };

  const errors = validationErrors || {};

  return (
    <div
      className="dish-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="dish-modal">
        <div className="dish-modal-header">
          <div>
            <span className="dish-modal-kicker">
              {mode === "create" ? "Create" : "Edit"}
            </span>
            <h3 className="dish-modal-title">
              {mode === "create" ? "New Dish" : "Edit Dish"}
            </h3>
          </div>
          <button type="button" onClick={onCancel} className="dish-modal-close" aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="dish-modal-body">
          <div className="dish-form-row">
            <label className="dish-form-label">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="dish-form-input"
              placeholder="e.g. Truffle Risotto"
              required
            />
            {errors.name && <p className="dish-form-err">{errors.name}</p>}
          </div>

          <div className="dish-form-row">
            <label className="dish-form-label">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="dish-form-input dish-form-textarea"
              rows={2}
              placeholder="A short description shown on the menu."
            />
          </div>

          <div className="dish-form-grid">
            <div className="dish-form-row">
              <label className="dish-form-label">Price *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="dish-form-input"
                required
              />
              {errors.price && <p className="dish-form-err">{errors.price}</p>}
            </div>

            <div className="dish-form-row">
              <label className="dish-form-label">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="dish-form-input"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="dish-form-row">
            <label className="dish-form-label">Image URL</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="dish-form-input"
              placeholder="https://example.com/dish.jpg"
            />
          </div>

          <div className="dish-form-row">
            <label className="dish-form-label">Ingredients</label>
            <IngredientLinker
              value={ingredients}
              onChange={setIngredients}
              ingredientOptions={ingredientOptions}
            />
          </div>

          <div className="dish-modal-footer">
            <button type="button" onClick={onCancel} className="dish-form-btn ghost">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="dish-form-btn primary">
              {submitting ? "Saving…" : mode === "create" ? "Create" : "Save"}
            </button>
          </div>
        </form>

        <style>{`
          .dish-modal-overlay {
            position: fixed; inset: 0; z-index: 100;
            background: rgba(7, 7, 9, 0.65);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            display: flex; align-items: center; justify-content: center;
            padding: 20px;
          }
          .dish-modal {
            background: var(--bg-secondary);
            color: var(--text-primary);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-xl);
            box-shadow: var(--shadow-elev);
            width: 560px; max-width: 100%;
            max-height: 90vh; overflow-y: auto;
            animation: dishModalIn 240ms var(--ease-out-expo) both;
          }
          @keyframes dishModalIn {
            from { opacity: 0; transform: translateY(12px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          .dish-modal-header {
            display: flex; align-items: flex-start; justify-content: space-between;
            padding: 22px 24px 18px;
            border-bottom: 1px solid var(--border-color);
            position: sticky; top: 0;
            background: var(--bg-secondary);
            z-index: 1;
          }
          .dish-modal-kicker {
            font-family: var(--font-heading);
            font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase;
            color: var(--accent-gold);
          }
          .dish-modal-title {
            margin: 4px 0 0 0;
            font-family: var(--font-heading);
            font-size: 22px; font-weight: 700;
            letter-spacing: -0.01em;
            color: var(--text-primary);
          }
          .dish-modal-close {
            background: transparent;
            border: 1px solid var(--border-color);
            color: var(--text-muted);
            border-radius: 10px;
            width: 32px; height: 32px;
            font-size: 20px; cursor: pointer;
            line-height: 1;
            transition: all 200ms var(--ease-out-expo);
          }
          .dish-modal-close:hover {
            color: var(--accent-red);
            border-color: var(--accent-red);
            background: rgba(215,38,56,0.08);
          }

          .dish-modal-body {
            padding: 22px 24px;
            display: flex; flex-direction: column; gap: 16px;
          }
          .dish-form-row { display: flex; flex-direction: column; gap: 6px; }
          .dish-form-grid {
            display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
          }
          .dish-form-label {
            font-family: var(--font-heading);
            font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
            color: var(--text-muted); font-weight: 600;
          }
          .dish-form-input {
            width: 100%;
            padding: 11px 14px;
            background: var(--bg-elevated);
            color: var(--text-primary);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            font-size: 14px;
            font-family: var(--font-body);
            outline: none;
            transition: border-color 160ms var(--ease-out-expo), box-shadow 160ms var(--ease-out-expo);
          }
          .dish-form-input:focus {
            border-color: var(--accent-gold);
            box-shadow: 0 0 0 3px rgba(155,226,45,0.18);
          }
          .dish-form-textarea {
            resize: vertical;
            font-family: var(--font-body);
          }
          .dish-form-err {
            margin: 0;
            font-size: 12px;
            color: var(--accent-red);
          }

          .dish-modal-footer {
            display: flex; justify-content: flex-end; gap: 10px;
            padding-top: 14px;
            border-top: 1px solid var(--border-color);
          }
          .dish-form-btn {
            padding: 10px 20px;
            font-family: var(--font-heading);
            font-size: 13px; font-weight: 600;
            letter-spacing: 0.04em;
            border-radius: 12px;
            cursor: pointer;
            transition: all 200ms var(--ease-out-expo);
            border: 1px solid transparent;
          }
          .dish-form-btn:not(:disabled):hover { transform: translateY(-1px); }
          .dish-form-btn:disabled { opacity: 0.55; cursor: not-allowed; }
          .dish-form-btn.ghost {
            background: transparent;
            color: var(--text-secondary);
            border-color: var(--border-color);
          }
          .dish-form-btn.ghost:hover {
            color: var(--text-primary);
            border-color: var(--text-primary);
          }
          .dish-form-btn.primary {
            background: var(--accent-red);
            color: #fff;
          }
          .dish-form-btn.primary:not(:disabled):hover {
            background: #E5354A;
            box-shadow: var(--glow-red);
          }

          @media (max-width: 480px) {
            .dish-form-grid { grid-template-columns: 1fr; }
          }
        `}</style>
      </div>
    </div>
  );
}
