// frontend/js/api.js

export const API_URL = window.API_URL;

export async function fetchModelList() {
  try {
    const response = await fetch(`${API_URL}/api/models`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const models = await response.json();
    console.log('[MODELS] Fetched list:', models);
    return models;
  } catch (err) {
    console.error('[MODELS] Failed to load list:', err.message);
    throw err;
  }
}

export async function fetchModel(modelId) {
  try {
    console.log(`[MODELS] Loading model: ${modelId}`);
    const response = await fetch(`${API_URL}/api/models/${modelId}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const model = await response.json();
    console.log(`[MODELS] Loaded ${modelId}:`, model);
    return model;
  } catch (err) {
    console.error(`[MODELS] Failed to load ${modelId}:`, err.message);
    throw err;
  }
}

export async function unfold(payload) {
  const response = await fetch(`${API_URL}/api/unfold`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }
  return await response.json();
}
