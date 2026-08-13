import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';
import axios from 'axios';
import { logger } from '../utils/logger';
import { getAuthToken, clearAuthToken } from './authSession';
import * as RootNavigation from '../utils/RootNavigation';
import { showGlobalAlert } from '../components/GlobalAlert';

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

export const getApiBase = (overrideHost) => {
  const isWeb = Platform.OS === 'web';
  const isProduction = !__DEV__;

  const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
  
  if (envApiUrl) {
    logger.log('Using API URL from environment:', envApiUrl);
    return envApiUrl;
  }

  if (isProduction) {
    if (isWeb) {
      const resolvedHost = typeof window !== 'undefined' && window.location ? window.location.hostname : 'localhost';
      logger.log(`Production web mode fallback: using ${resolvedHost}:5000`);
      return `http://${resolvedHost}:5000/api`;
    }
    logger.error('CRITICAL: No EXPO_PUBLIC_API_URL set for production! This will cause app to fail.');
    throw new Error('EXPO_PUBLIC_API_URL environment variable is required for production builds');
  }

  if (isWeb) {
    const host = overrideHost || (typeof window !== 'undefined' && window.location ? window.location.hostname : '127.0.0.1');
    logger.log(`Development web mode: using ${host}:5000`);
    return `http://${host}:5000/api`;
  }

  const host = overrideHost || resolveHostFromConstants();

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

export const API_URL = getApiBase();

axios.defaults.timeout = 15000;

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

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    
    if (error.config && error.config.suppressAlert) {
      return Promise.reject(error);
    }

    if (error.response) {
      const status = error.response.status;
      const serverMsg = error.response.data?.msg || error.response.data?.message;

      if (status === 401) {
        logger.error('401 Unauthorized - clearing invalid/expired token session');
        clearAuthToken();
        
        if (!error.config?.url?.includes('/auth/login')) {
          showGlobalAlert(
            'انتهت الجلسة (Session Expired)', 
            'انتهت دورتك الحالية. يرجى تسجيل الدخول مجدداً.',
            [{ text: 'OK', onPress: () => {
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.location.href = '/';
              } else {
                RootNavigation.reset([{ name: 'Login' }]);
              }
            }}]
          );
        }
      } else if (status === 403) {
        Alert.alert('غير مصرح (Access Denied)', serverMsg || 'غير مصرح لك بإجراء هذه العملية.');
      } else if (status === 429) {
        Alert.alert('تنبيه (Rate Limited)', serverMsg || 'تم تجاوز عدد المحاولات المسموح بها. يرجى الانتظار والمحاولة لاحقاً.');
      } else if (status >= 400 && status < 500) {
        Alert.alert('خطأ في البيانات (Request Error)', serverMsg || 'تعذر إكمال الطلب. يرجى التأكد من البيانات والمحاولة مرة أخرى.');
      } else if (status >= 500) {
        Alert.alert('خطأ في الخادم (Server Error)', serverMsg || 'حدث خطأ غير متوقع في الخادم. يرجى المحاولة لاحقاً.');
      }
    } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      logger.error('Request timed out:', error.config?.url);
      Alert.alert('انتهت المهلة (Timeout)', 'استغرق الطلب وقتاً أطول من المتوقع. يرجى المحاولة مرة أخرى.');
    } else if (!error.response) {
      logger.error('Network Error / Server Unreachable:', error.message);
      Alert.alert('خطأ في الاتصال (Connection Error)', 'تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.');
    }

    return Promise.reject(error);
  }
);

