
const mongoose = require('mongoose');
const crypto = require('crypto');

const AES_SECRET = process.env.AES_SECRET_KEY || process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'khedma_fallback_secret_key_2026';
const AES_KEY = crypto.createHash('sha256').update(AES_SECRET).digest();

function encryptField(value) {
  if (!value) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', AES_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { data: encrypted.toString('base64'), iv: iv.toString('base64'), tag: tag.toString('base64') };
}

function decryptField(enc) {
  if (!enc || !enc.data || !enc.iv || !enc.tag) return null;
  try {
const decipher = crypto.createDecipheriv('aes-256-gcm', AES_KEY, Buffer.from(enc.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(enc.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(enc.data, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
  } catch (err) {
    console.error('Decryption error:', err.message);
    return null;
  }
}

const logSchema = new mongoose.Schema({
  action: { type: String, required: true },

  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  targetClass: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  timestamp: { type: Date, default: Date.now },

  details_enc: { data: String, iv: String, tag: String },
  ip_enc: { data: String, iv: String, tag: String },
  userAgent_enc: { data: String, iv: String, tag: String },
  actorName_enc: { data: String, iv: String, tag: String },
  actorRole_enc: { data: String, iv: String, tag: String },
  performedByName_enc: { data: String, iv: String, tag: String },
  performedByRole_enc: { data: String, iv: String, tag: String },
  targetUserName_enc: { data: String, iv: String, tag: String },
  targetUserRole_enc: { data: String, iv: String, tag: String },
  targetClassName_enc: { data: String, iv: String, tag: String },
  actionDescription_enc: { data: String, iv: String, tag: String },
  deviceId_enc: { data: String, iv: String, tag: String },
});

logSchema.index({ timestamp: -1 });
logSchema.index({ performedBy: 1, timestamp: -1 });
logSchema.index({ targetUser: 1 });
logSchema.index({ targetClass: 1 });

[
  'details', 'ip', 'userAgent', 'actorName', 'actorRole',
  'performedByName', 'performedByRole', 'targetUserName', 'targetUserRole', 'targetClassName', 'actionDescription', 'deviceId'
].forEach(field => {
  logSchema.virtual(field)
    .get(function () {
      return decryptField(this[`${field}_enc`]);
    })
    .set(function (val) {
      if (val !== undefined && val !== null && val !== '') {
        this[`${field}_enc`] = encryptField(val);
      } else {
        this[`${field}_enc`] = undefined;
      }
    });
});

logSchema.methods.toJSON = function () {
  const obj = this.toObject({ virtuals: true });
  for (const key of Object.keys(obj)) {
    if (key.endsWith('_enc')) delete obj[key];
  }
  return obj;
};

module.exports = mongoose.model('Log', logSchema);
