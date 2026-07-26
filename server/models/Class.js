
const mongoose = require('mongoose');
const crypto = require('crypto');

function getAesKey() {
  const secret = process.env.AES_SECRET_KEY || process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error('Missing AES_SECRET_KEY in .env');
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptField(value) {
  if (value === undefined || value === null) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', getAesKey(), iv);
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

function normalizeDecryptedText(text) {
  if (text == null) return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const classSchema = new mongoose.Schema({
  name_enc: { data: String, iv: String, tag: String },
  level_enc: { data: String, iv: String, tag: String },
  year_enc: { data: String, iv: String, tag: String },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  coPrincipal: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
});

classSchema.index({ teacher: 1 });
classSchema.index({ coPrincipal: 1 });
classSchema.index({ students: 1 });

['name', 'level', 'year'].forEach((field) => {
  classSchema.virtual(field)
    .get(function () {
      const dec = normalizeDecryptedText(decryptField(this[`${field}_enc`]));
      if (['level', 'year'].includes(field)) {
        const n = Number(dec);
        return isNaN(n) ? undefined : n;
      }
      return dec;
    })
    .set(function (value) {
      this[`_${field}`] = value;
    });
});

classSchema.pre('save', function (next) {
  const fields = ['name', 'level', 'year'];
  for (const field of fields) {
    const transientValue = this[`_${field}`];
    if (transientValue !== undefined) {
      this[`${field}_enc`] = encryptField(transientValue);
      delete this[`_${field}`];
    }
  }
  next();
});

classSchema.methods.toJSON = function () {
  const obj = this.toObject({ virtuals: true });
  const source = this.toObject();
  for (const key of Object.keys(source)) {
    if (!key.endsWith('_enc')) continue;
    const base = key.slice(0, -4);
    delete obj[key];
    if (obj[base] !== undefined) continue;
    const dec = normalizeDecryptedText(decryptField(source[key]));
    if (base === 'level' || base === 'year') {
      const n = Number(dec);
      obj[base] = isNaN(n) ? dec : n;
    } else {
      obj[base] = dec;
    }
  }
  return obj;
};

classSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() || {};
  const set = update.$set ? update.$set : update;
  const unset = update.$unset ? update.$unset : (update.$unset = {});
  ['name', 'level', 'year'].forEach((field) => {
    if (set[field] !== undefined) {
      const val = field === 'level' || field === 'year' ? String(set[field]) : set[field];
      set[`${field}_enc`] = encryptField(val);
      unset[field] = '';
      delete set[field];
    }
  });
  next();
});

module.exports = mongoose.model('Class', classSchema);
