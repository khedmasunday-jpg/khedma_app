import Constants from 'expo-constants';
import { Platform } from 'react-native';
import axios from 'axios';
import { logger } from '../utils/logger';
import { getAuthToken } from './authSession';

/**
 * ⚠️ SECURITY: API Configuration
 * 
 * NEVER hardcode API URLs in source code. Always use:
 * 1. Environment variables (EXPO_PUBLIC_API_URL)
 * 2. EAS Secrets / app.json environment section
 * 3. Build-time configuration
 */

/**
 * Resolve the local IP address or host based on Expo environment
 * Used ONLY in development for localhost/LAN detection
 */
export const resolveHostFromConstants = () => {
  const m = Constants.manifest || {};
  const expoConfig = Constants.expoConfig || {};
  const manifest2 = Constants.manifest2 || {};

  const candidates = [
    m.debuggerHost,
    expoConfig.hostUri,
    manifest2.packagerOpts && manifest2.packagerOpts.devServerHost,
    m.packagerOpts && m.packagerOpts.host,
    null,
  ];

  for (const c of candidates) {
    if (!c) continue;
    const host = String(c).split(':')[0];
    if (host && host !== 'undefined') return host;
  }

  return 'localhost';
};

/**
 * Get API base URL depending on platform
 * 
 * Priority:
 * 1. Environment variable EXPO_PUBLIC_API_URL (preferred)
 * 2. For web: 127.0.0.1 (dev only) or environment var
 * 3. For mobile: LAN IP detection (dev only) or environment var
 * 
 * ⚠️ In production builds:
 *    - MUST use EXPO_PUBLIC_API_URL
 *    - Should use HTTPS
 *    - Should enable certificate pinning
 */
export const getApiBase = (overrideHost) => {
  const isWeb = Platform.OS === 'web';
  const isProduction = !__DEV__;
  
  // Get API URL from environment variable (highest priority)
  const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
  
  if (envApiUrl) {
    logger.log('Using API URL from environment:', envApiUrl);
    return envApiUrl;
  }

  // ⚠️ Fallback logic for development or production web
  if (isProduction) {
    if (isWeb) {
      const resolvedHost = typeof window !== 'undefined' && window.location ? window.location.hostname : 'localhost';
      logger.log(`Production web mode fallback: using ${resolvedHost}:5000`);
      return `http://${resolvedHost}:5000/api`;
    }
    logger.error('CRITICAL: No EXPO_PUBLIC_API_URL set for production! This will cause app to fail.');
    throw new Error('EXPO_PUBLIC_API_URL environment variable is required for production builds');
  }

  // ✅ WEB mode (expo start --web) - development only
  if (isWeb) {
    const host = overrideHost || (typeof window !== 'undefined' && window.location ? window.location.hostname : '127.0.0.1');
    logger.log(`Development web mode: using ${host}:5000`);
    return `http://${host}:5000/api`;
  }

  // ✅ MOBILE mode (Expo Go or emulator) - development only
  const host = overrideHost || resolveHostFromConstants();

  // Special case: Android emulator
  if (Platform.OS === 'android' && host === 'localhost') {
    logger.log('Android emulator detected: using special gateway IP 10.0.2.2');
    const protocol = 'http:';
    const emulatorIp = '10.0.2.2';
    return `${protocol}//${emulatorIp}:5000/api`;
  }

  logger.log(`Development mobile mode: using host ${host}`);
  const protocol = 'http:';
  return `${protocol}//${host}:5000/api`;
};

/**
 * Create an axios client configured for your backend
 * Includes Authorization header if token provided
 */
export function createApiClient(token, overrideHost) {
  const baseURL = getApiBase(overrideHost);

  const client = axios.create({ baseURL });

  const activeToken = token || getAuthToken();

  if (activeToken) {
    const header = String(activeToken).startsWith('Bearer ')
      ? String(activeToken)
      : `Bearer ${activeToken}`;
    client.defaults.headers.common['Authorization'] = header;
  }

  client.defaults.headers.common['Accept'] = 'application/json';
  client.defaults.headers.common['Content-Type'] = 'application/json';

  return client;
}

/**
 * Export the API base URL (for direct axios use)
 */
export const API_URL = getApiBase();

// ✅ Security: Globally intercept all Axios requests to automatically attach the Auth Token
axios.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
