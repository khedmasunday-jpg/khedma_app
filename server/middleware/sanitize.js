// middleware/sanitize.js

function sanitizeValue(val) {
  if (typeof val === 'string') {
    // 1. Strip HTML tags to prevent XSS
    let sanitized = val.replace(/<[^>]*>/g, '');
    // 2. Trim whitespaces
    sanitized = sanitized.trim();
    return sanitized;
  }
  
  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }
  
  if (val !== null && typeof val === 'object') {
    const sanitizedObj = {};
    for (const key in val) {
      if (Object.prototype.hasOwnProperty.call(val, key)) {
        // Prevent NoSQL Injection: skip keys starting with $ or containing dots in user input
        if (key.startsWith('$') || key.includes('.')) {
          continue; 
        }
        sanitizedObj[key] = sanitizeValue(val[key]);
      }
    }
    return sanitizedObj;
  }
  
  return val;
}

module.exports = (req, res, next) => {
  // Sanitize req.body, req.query, and req.params
  if (req.body) {
    req.body = sanitizeValue(req.body);
  }
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }
  if (req.params) {
    req.params = sanitizeValue(req.params);
  }
  next();
};
