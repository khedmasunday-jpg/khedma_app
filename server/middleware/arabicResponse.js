const { translateMessage } = require('../utils/translations');

// Middleware to translate standardized 'msg' fields in JSON responses to Arabic
function arabicResponse(req, res, next) {
  const oldJson = res.json;
  res.json = function (body) {
    try {
      if (body && typeof body === 'object') {
        // translate common message fields
        if (body.msg) body.msg = translateMessage(body.msg);
        if (body.message) body.message = translateMessage(body.message);
        // if there's an errors array, translate msg within
        if (Array.isArray(body.errors)) {
          body.errors = body.errors.map(e => {
            if (e && e.msg) return { ...e, msg: translateMessage(e.msg) };
            return e;
          });
        }
      }
    } catch (e) {
      // ignore translation errors and return original
    }
    return oldJson.call(this, body);
  };
  next();
}

module.exports = arabicResponse;
