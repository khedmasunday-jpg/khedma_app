
import axios from 'axios';
import { logger } from './logger';

const memoryCache = new Map();
const DEFAULT_TTL_MS = 3 * 60 * 1000; 

export async function fetchWithCache(url, config = {}, ttlMs = DEFAULT_TTL_MS) {
  const cacheKey = `cache_${url}_${JSON.stringify(config.params || {})}`;
  const now = Date.now();

  if (memoryCache.has(cacheKey)) {
    const entry = memoryCache.get(cacheKey);
    if (now - entry.timestamp < ttlMs) {
      logger.log(`⚡ Cache HIT for ${url}`);
      return entry.data;
    }
  }

  try {
    const response = await axios.get(url, config);
    memoryCache.set(cacheKey, {
      timestamp: now,
      data: response.data,
    });
    return response.data;
  } catch (error) {
    
    if (memoryCache.has(cacheKey)) {
      logger.warn(`⚠️ Network failed, serving stale cache for ${url}`);
      return memoryCache.get(cacheKey).data;
    }
    throw error;
  }
}

export function invalidateCache(pattern) {
  for (const key of memoryCache.keys()) {
    if (typeof pattern === 'string' && key.includes(pattern)) {
      memoryCache.delete(key);
    } else if (pattern instanceof RegExp && pattern.test(key)) {
      memoryCache.delete(key);
    }
  }
}

export function clearAllCache() {
  memoryCache.clear();
}
