export default function IngredientLinker({ value, onChange, ingredientOptions }) {
  const addIngredient = () => {
    const available = ingredientOptions.filter(
      (ing) => !value.some((v) => v.ingredientId === (ing._id || ing.id))
    );
    if (available.length === 0) return;
    const first = available[0];
    onChange([...value, { ingredientId: first._id || first.id, quantity: 1, unit: first.unit || "" }]);
  };

  const removeIngredient = (index) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, val) => {
    const updated = [...value];
    updated[index] = { ...updated[index], [field]: val };
    if (field === "ingredientId") {
      const ing = ingredientOptions.find((i) => (i._id || i.id) === val);
      if (ing) updated[index].unit = ing.unit || "";
    }
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {value.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <select
            value={item.ingredientId}
            onChange={(e) => updateItem(idx, "ingredientId", e.target.value)}
            className="border rounded px-2 py-1 flex-1"
          >
            <option value="">Select ingredient</option>
            {ingredientOptions.map((ing) => (
              <option key={ing._id || ing.id} value={ing._id || ing.id}>
                {ing.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="any"
            value={item.quantity}
            onChange={(e) => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)}
            className="border rounded px-2 py-1 w-20"
          />
          <span className="text-gray-500 text-sm w-12">{item.unit}</span>
          <button
            type="button"
            onClick={() => removeIngredient(idx)}
            className="text-red-600 hover:text-red-800 text-sm"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addIngredient}
        className="text-blue-600 hover:text-blue-800 text-sm"
      >
        + Add ingredient
      </button>
    </div>
  );
}