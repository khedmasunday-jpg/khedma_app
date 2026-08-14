import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
const TOKEN_KEY = 'khedma_token';
const USER_KEY = 'khedma_user';

let cachedToken = null;
let cachedUser = null;

function getStorage() {
  if (typeof window !== 'undefined') {
    return window.localStorage || window.sessionStorage;
  }
  return null;
}

export function setAuthToken(token, user = null) {
  cachedToken = token;
  const storage = getStorage();
  if (storage && token) {
    try {
      storage.setItem(TOKEN_KEY, token);
    } catch (e) {}
  } else if (Platform.OS !== 'web' && token) {
    AsyncStorage.setItem(TOKEN_KEY, token).catch(()=>{});
  }

  if (user) {
    cachedUser = user;
    if (storage) {
      try {
        storage.setItem(USER_KEY, JSON.stringify(user));
      } catch (e) {}
    } else if (Platform.OS !== 'web') {
      AsyncStorage.setItem(USER_KEY, JSON.stringify(user)).catch(()=>{});
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
      if (window.sessionStorage) {
        window.sessionStorage.removeItem(TOKEN_KEY);
        window.sessionStorage.removeItem(USER_KEY);
      }
    } catch (e) {}
  }
  if (Platform.OS !== 'web') {
    AsyncStorage.removeItem(TOKEN_KEY).catch(()=>{});
    AsyncStorage.removeItem(USER_KEY).catch(()=>{});
  }
}
