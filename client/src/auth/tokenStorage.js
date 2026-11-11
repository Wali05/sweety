// Keeps the auth token in localStorage. Storage can be unavailable (e.g.
// blocked by privacy settings), so failures are ignored: the session then
// lasts only until the page is reloaded.

const TOKEN_KEY = 'sweety.token';

export function getToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Ignored, see above.
  }
}

export function clearToken() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignored, see above.
  }
}
