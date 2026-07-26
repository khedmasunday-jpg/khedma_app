
const mongoose = require('mongoose');
const crypto = require('crypto');

const AES_SECRET = process.env.AES_SECRET_KEY || process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'khedma_fallback_secret_key_2026';
const AES_KEY = crypto.createHash('sha256').update(AES_SECRET).digest();

function encryptField(value) {
  if (value === undefined || value === null) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', AES_KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(value), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    data: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

function decryptField(enc) {
  if (!enc || !enc.data || !enc.iv || !enc.tag) return null;
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    AES_KEY,
    Buffer.from(enc.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(enc.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(enc.data, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

const counterSchema = new mongoose.Schema({
  model_enc: { data: String, iv: String, tag: String },
  count_enc: { data: String, iv: String, tag: String },
});

counterSchema.pre('save', function (next) {
  const fields = ['model', 'count'];
  for (const field of fields) {
    if (this.isModified(field) && this[field] !== undefined) {
      this[`${field}_enc`] = encryptField(this[field]);
      this[field] = undefined;
    }
  }
  next();
});

['model', 'count'].forEach((field) => {
  counterSchema.virtual(field).get(function () {
    const dec = decryptField(this[`${field}_enc`]);
    if (field === 'count') return parseInt(dec, 10);
    return dec;
  });
});

counterSchema.methods.toJSON = function () {
  const obj = this.toObject({ virtuals: true });
  for (const key of Object.keys(obj)) {
    if (key.endsWith('_enc')) delete obj[key];
  }
  return obj;
};

module.exports = mongoose.model('Counter', counterSchema);
