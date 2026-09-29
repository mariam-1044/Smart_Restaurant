import React, { useState, useEffect } from 'react';
import api from '../api/axios';

export default function PreferencesQuestionnaire({ onClose, onSaved }) {
  const [schema, setSchema] = useState({ cuisines: [], dietary: [], spiceLevels: [] });
  const [cuisines, setCuisines] = useState([]);
  const [dietary, setDietary] = useState([]);
  const [spiceLevel, setSpiceLevel] = useState('medium');
  const [allergiesInput, setAllergiesInput] = useState('');
  const [favoriteIngredientsInput, setFavoriteIngredientsInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/v1/preferences/schema').then((r) => {
      if (r.data.success) setSchema(r.data.data);
    }).catch(() => {});
    // Pre-fill from any preferences the user has already saved so re-opening
    // and saving the form never wipes existing choices.
    api.get('/v1/preferences/me').then((r) => {
      const p = r.data && r.data.data;
      if (!p) return;
      if (Array.isArray(p.cuisines)) setCuisines(p.cuisines);
      if (Array.isArray(p.dietary)) setDietary(p.dietary);
      if (p.spiceLevel) setSpiceLevel(p.spiceLevel);
      if (Array.isArray(p.allergies)) setAllergiesInput(p.allergies.join(', '));
      if (Array.isArray(p.favoriteIngredients)) setFavoriteIngredientsInput(p.favoriteIngredients.join(', '));
    }).catch(() => {});
  }, []);

  const toggle = (list, setList, value) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = {
        cuisines,
        dietary,
        spiceLevel,
        allergies: allergiesInput.split(',').map((s) => s.trim()).filter(Boolean),
        favoriteIngredients: favoriteIngredientsInput.split(',').map((s) => s.trim()).filter(Boolean)
      };
      const resp = await api.put('/v1/preferences/me', body);
      if (resp.data.success) {
        if (onSaved) onSaved(resp.data.data);
        if (onClose) onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="prefs-overlay">
      <div className="prefs-modal">
        <h2>Welcome! Tell us your taste</h2>
        <p className="prefs-subtitle">
          We'll use this to suggest recipes you'll love. You can change it any time.
        </p>
        {error && <div className="prefs-error">{error}</div>}
        <form onSubmit={handleSave}>
          <div className="prefs-section">
            <label className="prefs-label">Favorite cuisines</label>
            <div className="prefs-chips">
              {schema.cuisines.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`prefs-chip ${cuisines.includes(c) ? 'active' : ''}`}
                  onClick={() => toggle(cuisines, setCuisines, c)}
                >{c}</button>
              ))}
            </div>
          </div>

          <div className="prefs-section">
            <label className="prefs-label">Dietary requirements</label>
            <div className="prefs-chips">
              {schema.dietary.map((d) => (
                <button
                  type="button"
                  key={d}
                  className={`prefs-chip ${dietary.includes(d) ? 'active' : ''}`}
                  onClick={() => toggle(dietary, setDietary, d)}
                >{d.replace('_', ' ')}</button>
              ))}
            </div>
          </div>

          <div className="prefs-section">
            <label className="prefs-label">Spice tolerance</label>
            <div className="prefs-chips">
              {schema.spiceLevels.map((s) => (
                <button
                  type="button"
                  key={s}
                  className={`prefs-chip ${spiceLevel === s ? 'active' : ''}`}
                  onClick={() => setSpiceLevel(s)}
                >{s.replace('_', ' ')}</button>
              ))}
            </div>
          </div>

          <div className="prefs-section">
            <label className="prefs-label">Allergies (comma separated)</label>
            <input
              className="prefs-input"
              placeholder="e.g. peanut, shellfish"
              value={allergiesInput}
              onChange={(e) => setAllergiesInput(e.target.value)}
            />
          </div>

          <div className="prefs-section">
            <label className="prefs-label">Favorite ingredients (comma separated)</label>
            <input
              className="prefs-input"
              placeholder="e.g. salmon, mushrooms, basil"
              value={favoriteIngredientsInput}
              onChange={(e) => setFavoriteIngredientsInput(e.target.value)}
            />
          </div>

          <div className="prefs-actions">
            {onClose && (
              <button type="button" className="prefs-btn-secondary" onClick={onClose} disabled={saving}>
                Skip
              </button>
            )}
            <button type="submit" className="prefs-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save preferences'}
            </button>
          </div>
        </form>
      </div>
      <style>{`
        .prefs-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .prefs-modal { background: white; border-radius: 10px; padding: 28px; width: 92%; max-width: 560px; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
        .prefs-modal h2 { margin: 0 0 6px; color: #333; }
        .prefs-subtitle { color: #777; margin: 0 0 18px; font-size: 14px; }
        .prefs-error { background: #ffebee; color: #d32f2f; padding: 10px; border-radius: 5px; margin-bottom: 12px; font-size: 14px; }
        .prefs-section { margin-bottom: 16px; }
        .prefs-label { display: block; font-weight: bold; color: #444; margin-bottom: 8px; font-size: 13px; }
        .prefs-chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .prefs-chip { padding: 8px 14px; background: #f0f2f5; border: 1px solid #ddd; border-radius: 20px; cursor: pointer; font-size: 13px; color: #555; text-transform: capitalize; transition: all .15s; }
        .prefs-chip:hover { background: #e3e7eb; }
        .prefs-chip.active { background: #2196F3; border-color: #2196F3; color: white; }
        .prefs-input { width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 5px; font-size: 14px; box-sizing: border-box; }
        .prefs-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 18px; }
        .prefs-btn-primary { padding: 10px 20px; background: #27ae60; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; }
        .prefs-btn-primary:hover { background: #1e8449; }
        .prefs-btn-primary:disabled { background: #95a5a6; cursor: not-allowed; }
        .prefs-btn-secondary { padding: 10px 20px; background: #ecf0f1; color: #555; border: 1px solid #ddd; border-radius: 5px; cursor: pointer; }
        .prefs-btn-secondary:hover { background: #d5dbdb; }
      `}</style>
    </div>
  );
}
