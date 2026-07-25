// src/config/authSession.js

let cachedToken = null;

/**
 * Set the active authentication token in memory
 * @param {string} token 
 */
export function setAuthToken(token) {
  cachedToken = token;
}

/**
 * Retrieve the active authentication token
 * @returns {string|null}
 */
export function getAuthToken() {
  return cachedToken;
}

/**
 * Clear the active authentication token
 */
export function clearAuthToken() {
  cachedToken = null;
}
