

const MAX_STRING_LENGTH = 5000;
const MAX_DEPTH = 10;

function sanitizeValue(val, depth = 0) {
  if (depth > MAX_DEPTH) return null;

  if (typeof val === 'string') {
    
    let sanitized = val.replace(/\0/g, '');
    
    sanitized = sanitized.replace(/<[^>]*>/g, '');
    
    sanitized = sanitized.replace(/javascript\s*:/gi, '');
    
    return sanitized.trim();
  }

  if (Array.isArray(val)) {
    return val.map(item => sanitizeValue(item, depth + 1));
  }

  if (val !== null && typeof val === 'object') {
    const sanitizedObj = {};
    for (const key in val) {
      if (Object.prototype.hasOwnProperty.call(val, key)) {
        
        if (key.startsWith('$') || key.includes('.')) {
          continue;
        }
        sanitizedObj[key] = sanitizeValue(val[key], depth + 1);
      }
    }
    return sanitizedObj;
  }

  return val;
}

function containsOversizedData(obj, depth = 0) {
  if (depth > MAX_DEPTH) return true;
  if (typeof obj === 'string') {
    return obj.length > MAX_STRING_LENGTH;
  }
  if (Array.isArray(obj)) {
    return obj.some(item => containsOversizedData(item, depth + 1));
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.values(obj).some(val => containsOversizedData(val, depth + 1));
  }
  return false;
}

module.exports = (req, res, next) => {
  
  if (containsOversizedData(req.body) || containsOversizedData(req.query) || containsOversizedData(req.params)) {
    return res.status(400).json({ msg: 'Oversized or malformed input rejected.' });
  }

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
