
const mongoose = require('mongoose');
const crypto = require('crypto');

const AES_SECRET = process.env.AES_SECRET_KEY || process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'khedma_fallback_secret_key_2026';
const AES_KEY = crypto.createHash('sha256').update(AES_SECRET).digest();

function encryptField(value) {
  if (value === undefined || value === null) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', AES_KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
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
  try {
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
  return JSON.parse(decrypted.toString('utf8'));
  } catch (err) {
    console.error('Decryption error:', err.message);
    return null;
  }
}

const availableIdsSchema = new mongoose.Schema({
  ids_enc: { data: String, iv: String, tag: String },
});

availableIdsSchema.pre('save', function (next) {
  if (this.isModified('ids')) {
    this.ids_enc = encryptField(this.ids);
    this.ids = undefined;
  }
  next();
});

availableIdsSchema.virtual('ids').get(function () {
  return decryptField(this.ids_enc) || [];
});

availableIdsSchema.methods.toJSON = function () {
  const obj = this.toObject({ virtuals: true });
  delete obj.ids_enc;
  return obj;
};

module.exports = mongoose.model('AvailableIds', availableIdsSchema);
