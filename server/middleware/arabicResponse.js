const { translateMessage } = require('../utils/translations');

function arabicResponse(req, res, next) {
  const oldJson = res.json;
  res.json = function (body) {
    try {
      if (body && typeof body === 'object') {
        
        if (body.msg) body.msg = translateMessage(body.msg);
        if (body.message) body.message = translateMessage(body.message);
        
        if (Array.isArray(body.errors)) {
          body.errors = body.errors.map(e => {
            if (e && e.msg) return { ...e, msg: translateMessage(e.msg) };
            return e;
          });
        }
      }
    } catch (e) {
      
    }
    return oldJson.call(this, body);
  };
  next();
}

module.exports = arabicResponse;
