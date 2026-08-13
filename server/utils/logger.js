

const AXIOM_TOKEN = 'xaat-3ac34375-3ee2-42f0-ab22-64e1d69234e4';
const AXIOM_DATASET = 'khedmalogs';
const AXIOM_URL = `https://api.axiom.co/v1/datasets/${AXIOM_DATASET}/ingest`;

/**
 * Structured logger for Axiom ingestion.
 * Bypasses Vercel's Log Drain restriction by sending logs directly via HTTP.
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
      _time: new Date().toISOString(),
      level,
      event,
      ...payload
    };
    
    // Still output to console for standard Vercel logs
    console.log(JSON.stringify(logEntry));

    // Send asynchronously to Axiom, bypassing Vercel restrictions
    if (typeof fetch !== 'undefined') {
      fetch(AXIOM_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AXIOM_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([logEntry]) // Axiom expects an array of events
      }).catch(err => {
        console.error('Failed to send log to Axiom:', err.message);
      });
    }
  }
}

module.exports = Logger;
