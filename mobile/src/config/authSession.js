

const TOKEN_KEY = 'khedma_token';
const USER_KEY = 'khedma_user';

let cachedToken = null;
let cachedUser = null;

function getStorage() {
  if (typeof window !== 'undefined') {
    return window.sessionStorage || window.localStorage;
  }
  return null;
}

export function setAuthToken(token, user = null) {
  cachedToken = token;
  const storage = getStorage();
  if (storage && token) {
    try {
      storage.setItem(TOKEN_KEY, token);
    } catch (e) {
      
    }
  }

  if (user) {
    cachedUser = user;
    if (storage) {
      try {
        storage.setItem(USER_KEY, JSON.stringify(user));
      } catch (e) {
        
      }
    }
  }
}

export function getAuthToken() {
  if (cachedToken) return cachedToken;
  const storage = getStorage();
  if (storage) {
    try {
      const storedToken = storage.getItem(TOKEN_KEY);
      if (storedToken) {
        cachedToken = storedToken;
        return storedToken;
      }
    } catch (e) {
      
    }
  }
  return null;
}

export function getAuthUser() {
  if (cachedUser) return cachedUser;
  const storage = getStorage();
  if (storage) {
    try {
      const storedUser = storage.getItem(USER_KEY);
      if (storedUser) {
        cachedUser = JSON.parse(storedUser);
        return cachedUser;
      }
    } catch (e) {
      
    }
  }
  return null;
}

export function clearAuthToken() {
  cachedToken = null;
  cachedUser = null;
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(TOKEN_KEY);
      storage.removeItem(USER_KEY);
      if (window.localStorage) {
        window.localStorage.removeItem(TOKEN_KEY);
        window.localStorage.removeItem(USER_KEY);
      }
    } catch (e) {
      
    }
  }
}
