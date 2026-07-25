/**
 * Secure Logging Utility
 * 
 * Automatically strips sensitive console logging in production builds.
 * Only logs in development (__DEV__ = true).
 * 
 * Usage:
 *   import { logger } from './logger';
 *   logger.log('message');
 *   logger.warn('warning');
 *   logger.error('error');
 */

const isProduction = !__DEV__;

/**
 * Safe logging function that respects __DEV__ environment
 * @param {string} level - 'log', 'warn', 'error', 'info', 'debug'
 * @param {...any} args - Arguments to log
 */
function safeLog(level, ...args) {
  // Completely strip logging from production builds
  if (isProduction) {
    return;
  }

  // In development, use the appropriate console method
  if (console[level] && typeof console[level] === 'function') {
    console[level](...args);
  }
}

export const logger = {
  /**
   * Log a message (development only)
   * @param {...any} args - Arguments to log
   */
  log: (...args) => safeLog('log', ...args),

  /**
   * Log a warning (development only)
   * @param {...any} args - Arguments to warn about
   */
  warn: (...args) => safeLog('warn', ...args),

  /**
   * Log an error (development only)
   * @param {...any} args - Arguments to log as error
   */
  error: (...args) => safeLog('error', ...args),

  /**
   * Log info (development only)
   * @param {...any} args - Arguments to log as info
   */
  info: (...args) => safeLog('info', ...args),

  /**
   * Log debug info (development only)
   * @param {...any} args - Arguments to log as debug
   */
  debug: (...args) => safeLog('debug', ...args),

  /**
   * Assert a condition (development only)
   * @param {boolean} condition - Condition to assert
   * @param {...any} args - Arguments to log if assertion fails
   */
  assert: (condition, ...args) => {
    if (!isProduction && !condition) {
      console.assert(false, ...args);
    }
  },
};

/**
 * Override global console in production to ensure nothing leaks
 * (Fallback protection if logger is not used everywhere)
 */
if (isProduction) {
  // Disable all console methods in production
  global.console = {
    log: () => {},
    warn: () => {},
    error: () => {},
    info: () => {},
    debug: () => {},
    assert: () => {},
    clear: () => {},
    count: () => {},
    group: () => {},
    groupCollapsed: () => {},
    groupEnd: () => {},
    table: () => {},
    time: () => {},
    timeEnd: () => {},
    trace: () => {},
    profile: () => {},
    profileEnd: () => {},
  };
}

export default logger;
