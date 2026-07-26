
const mongoose = require('mongoose');
const crypto = require('crypto');

function getAesKey() {
  const secret = process.env.AES_SECRET_KEY || process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error('Missing AES_SECRET_KEY in .env');
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptField(value) {
  if (!value) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', getAesKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { data: encrypted.toString('base64'), iv: iv.toString('base64'), tag: tag.toString('base64') };
}

function decryptField(enc) {
  if (!enc || !enc.data || !enc.iv || !enc.tag) return null;
  const decipher = crypto.createDecipheriv('aes-256-gcm', getAesKey(), Buffer.from(enc.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(enc.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(enc.data, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

const jobLogSchema = new mongoose.Schema({
  jobName_enc: { data: String, iv: String, tag: String },
  lastRunDate_enc: { data: String, iv: String, tag: String },
});

jobLogSchema.pre('save', function (next) {
  const fields = ['jobName', 'lastRunDate'];
  for (const field of fields) {
    if (this.isModified(field) && this[field]) {
      this[`${field}_enc`] = encryptField(this[field]);
      this[field] = undefined;
    }
  }
  next();
});

['jobName', 'lastRunDate'].forEach(field => {
  jobLogSchema.virtual(field).get(function () {
    return decryptField(this[`${field}_enc`]);
  });
});

jobLogSchema.methods.toJSON = function () {
  const obj = this.toObject({ virtuals: true });
  for (const key of Object.keys(obj)) {
    if (key.endsWith('_enc')) delete obj[key];
  }
  return obj;
};

module.exports = mongoose.model('JobLog', jobLogSchema);
