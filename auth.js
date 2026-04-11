// ═══════════════════════════════════════════════════════════════════════════
//  Client-Side Auth Utilities
// ═══════════════════════════════════════════════════════════════════════════

const TOKEN_KEY = 'acm_jwt_token';
const REMAINING_UNFOLDS_KEY = 'acm_remaining_unfolds';
const IS_ADMIN_KEY = 'acm_is_admin';
const USERNAME_KEY = 'acm_username';

// Use window.API_URL if set (set before loading this script)
// Otherwise try 8789 first (recent wrangler default), then fallback to 8788
const API_BASE = (typeof window !== 'undefined' && window.API_URL) 
  ? window.API_URL 
  : 'http://127.0.0.1:8789';

/**
 * Store JWT token in localStorage
 */
function storeToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Retrieve JWT token from localStorage
 */
function getToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}

/**
 * Clear JWT token from localStorage
 */
function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  console.log('[AUTH] Token cleared');
}

/**
 * Store remaining unfolds in localStorage
 */
function storeRemainingUnfolds(count) {
  localStorage.setItem(REMAINING_UNFOLDS_KEY, String(count));
}

/**
 * Get remaining unfolds from localStorage
 */
function getRemainingUnfolds() {
  const stored = localStorage.getItem(REMAINING_UNFOLDS_KEY);
  // Default to 5 for free tier, but server will override with actual limit
  return stored ? parseInt(stored) : 5;
}

/**
 * Clear remaining unfolds
 */
function clearRemainingUnfolds() {
  localStorage.removeItem(REMAINING_UNFOLDS_KEY);
}

/**
 * Store admin flag
 */
function storeAdminFlag(isAdmin) {
  localStorage.setItem(IS_ADMIN_KEY, isAdmin ? 'true' : 'false');
}

/**
 * Check if user is admin
 */
function isAdmin() {
  return localStorage.getItem(IS_ADMIN_KEY) === 'true';
}

/**
 * Clear admin flag
 */
function clearAdminFlag() {
  localStorage.removeItem(IS_ADMIN_KEY);
}

/**
 * Store username
 */
function storeUsername(username) {
  localStorage.setItem(USERNAME_KEY, username);
  console.log(`[AUTH] Stored username: ${username}`);
}

/**
 * Get username from localStorage
 */
function getUsername() {
  return localStorage.getItem(USERNAME_KEY) || 'User';
}

/**
 * Check if user is authenticated (token exists and is not empty)
 */
function isAuthenticated() {
  return !!getToken();
}

/**
 * Decode JWT payload (client-side only - for display)
 * WARNING: Do NOT use this for security checks. Always verify on server.
 */
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

/**
 * Check if token is expired (client-side)
 * NEW: Verify with backend instead of local checking
 */
function isTokenExpired() {
  const token = getToken();
  if (!token) return true;

  // With new session system, we don't check tokens locally
  // Backend handles expiration - this is just a sanity check
  return false;
}

/**
 * Redirect to login page
 */
function redirectToLogin() {
  window.location.href = './login.html';
}

/**
 * Make authenticated API request
 * Simple and reliable - backend validates token, no client-side crypto
 */
async function apiCall(method, path, body = null) {
  const token = getToken();
  if (!token) {
    console.log('[API] No token found, redirecting to login');
    redirectToLogin();
    throw new Error('Not authenticated');
  }

  const url = `${API_BASE}${path}`;
  console.log(`[API] ${method} ${url}`);
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    console.log(`[API] Response status: ${response.status} for ${path}`);

    if (response.status === 401) {
      console.log('[API] Received 401 Unauthorized - session expired or invalid');
      clearToken();
      redirectToLogin();
      throw new Error('Unauthorized - please login again');
    }
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      console.log('[API] Error response:', error);
      throw new Error(error.message || error.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log(`[API] Success:`, data);
    return data;
  } catch (err) {
    console.error('[API] Request failed:', err.message);
    if (err.message.includes('Unauthorized')) {
      clearToken();
      redirectToLogin();
    }
    throw err;
  }
}

/**
 * Login user (without token context)
 */
async function loginUser(username, password) {
  const url = `${API_BASE}/api/auth/login`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Login failed' }));
    throw new Error(error.message || error.error || 'Login failed');
  }

  const data = await response.json();
  storeToken(data.token);
  storeUsername(data.username);
  if (data.remaining_unfolds !== undefined) {
    storeRemainingUnfolds(data.remaining_unfolds);
  }
  if (data.is_admin !== undefined) {
    storeAdminFlag(data.is_admin);
  }
  return data;
}

/**
 * Logout user - clear session on backend and local storage
 */
function logoutUser() {
  console.log('[AUTH] Logging out user');
  const token = getToken();
  
  // Try to notify backend (best effort)
  if (token) {
    const url = `${API_BASE}/api/auth/logout`;
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }).catch(err => console.log('[AUTH] Logout notification failed:', err.message));
  }

  // Clear local data
  clearToken();
  clearRemainingUnfolds();
  clearAdminFlag();
  localStorage.removeItem(USERNAME_KEY);
  localStorage.clear();
  console.log('[AUTH] Session cleared, redirecting to login');
  redirectToLogin();
}

/**
 * Check token validity with backend (diagnostic)
 */
async function checkTokenValidity() {
  try {
    const token = getToken();
    if (!token) {
      console.log('[DIAG] No token in localStorage');
      return { valid: false, reason: 'No token' };
    }

    // Call diagnostic endpoint
    const response = await fetch(`${API_BASE}/api/auth/check`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();
    console.log('[DIAG] Token check response:', data);
    
    if (!response.ok) {
      console.error('[DIAG] Backend rejected token with status', response.status);
      return { valid: false, status: response.status, data };
    }

    return { valid: data.valid, data };
  } catch (err) {
    console.error('[DIAG] Token check error:', err);
    return { valid: false, error: err.message };
  }
}

/**
 * Reset testing data - for demo/testing purposes only
 * Clears token and rate limit, stays on current page
 */
function resetTestingData() {
  console.log('[TESTING] Resetting all data for testing');
  localStorage.clear();
  alert('✓ Testing data reset. Reload page to login fresh.');
  window.location.reload();
}

// Keyboard shortcut: Ctrl+Shift+R to reset for testing
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyR') {
      e.preventDefault();
      resetTestingData();
    }
  });
}
