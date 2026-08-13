const Log = require('./Log');

/**
 * Structured logger for Splunk ingestion.
 * Outputs strict JSON format to stdout so Vercel can forward it.
 */
class Logger {
  static info(event, payload = {}) {
    this._log('INFO', event, payload);
  }

  static error(event, payload = {}) {
    this._log('ERROR', event, payload);
  }

  static warn(event, payload = {}) {
    this._log('WARN', event, payload);
  }

  static _log(level, event, payload) {
    // Generate the structured log
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      ...payload
    };
    
    // Output strictly as JSON for Vercel -> Splunk Log Drain
    console.log(JSON.stringify(logEntry));
  }
}

module.exports = Logger;
