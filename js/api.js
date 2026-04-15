// frontend/js/api.js

export const API_URL = window.API_URL;

export async function fetchModelList() {
  try {
    const models = await apiCall('GET', '/api/models');
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
    const model = await apiCall('GET', `/api/models/${modelId}`);
    console.log(`[MODELS] Loaded ${modelId}:`, model);
    return model;
  } catch (err) {
    console.error(`[MODELS] Failed to load ${modelId}:`, err.message);
    throw err;
  }
}

export async function unfold(payload) {
  const response = await apiCall('POST', '/api/unfold', payload);
  return response;
}

}

export async function fetchModel(modelId) {
  try {
    console.log(`[MODELS] Loading model: ${modelId}`);
    const model = await apiCall('GET', `/api/models/${modelId}`);
    console.log(`[MODELS] Loaded ${modelId}:`, model);
    return model;
  } catch (err) {
    console.error(`[MODELS] Failed to load ${modelId}:`, err.message);
    throw err;
  }
}

export async function unfold(payload) {
  const response = await apiCall('POST', '/api/unfold', payload);
  return response;
}

}

export async function fetchModel(modelId) {
  try {
    console.log(`[MODELS] Loading model: ${modelId}`);
    const model = await apiCall('GET', `/api/models/${modelId}`);
    console.log(`[MODELS] Loaded ${modelId}:`, model);
    return model;
  } catch (err) {
    console.error(`[MODELS] Failed to load ${modelId}:`, err.message);
    throw err;
  }
}

export async function unfold(payload) {
  const response = await apiCall('POST', '/api/unfold', payload);
  return response;
}

}

export async function fetchModel(modelId) {
  try {
    console.log(`[MODELS] Loading model: ${modelId}`);
    const model = await apiCall('GET', `/api/models/${modelId}`);
    console.log(`[MODELS] Loaded ${modelId}:`, model);
    return model;
  } catch (err) {
    console.error(`[MODELS] Failed to load ${modelId}:`, err.message);
    throw err;
  }
}

export async function unfold(payload) {
  const response = await apiCall('POST', '/api/unfold', payload);
  return response;
}

}

export async function fetchModel(modelId) {
  try {
    console.log(`[MODELS] Loading model: ${modelId}`);
    const model = await apiCall('GET', `/api/models/${modelId}`);
    console.log(`[MODELS] Loaded ${modelId}:`, model);
    return model;
  } catch (err) {
    console.error(`[MODELS] Failed to load ${modelId}:`, err.message);
    throw err;
  }
}

export async function unfold(payload) {
  const response = await apiCall('POST', '/api/unfold', payload);
  return response;
}

}

export async function fetchModel(modelId) {
  try {
    console.log(`[MODELS] Loading model: ${modelId}`);
    const model = await apiCall('GET', `/api/models/${modelId}`);
    console.log(`[MODELS] Loaded ${modelId}:`, model);
    return model;
  } catch (err) {
    console.error(`[MODELS] Failed to load ${modelId}:`, err.message);
    throw err;
  }
}

export async function unfold(payload) {
  const response = await apiCall('POST', '/api/unfold', payload);
  return response;
}

}

export async function fetchModel(modelId) {
  try {
    console.log(`[MODELS] Loading model: ${modelId}`);
    const model = await apiCall('GET', `/api/models/${modelId}`);
    console.log(`[MODELS] Loaded ${modelId}:`, model);
    return model;
  } catch (err) {
    console.error(`[MODELS] Failed to load ${modelId}:`, err.message);
    throw err;
  }
}

export async function unfold(payload) {
  const response = await apiCall('POST', '/api/unfold', payload);
  return response;
}
