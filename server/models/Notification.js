
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

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['birthday', 'weekly', 'other'], default: 'other' },

  message: {
    type: String,
    set: function (v) {
      if (v === undefined) return v;
      if (v === null || v === '') {
        this.message_enc = undefined;
        return undefined;
      }
      this.message_enc = encryptField(v);
      return undefined; 
    },
    get: function () {
      return decryptField(this.message_enc);
    }
  },

  message_enc: { data: String, iv: String, tag: String },
  createdAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
});

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, read: 1 });

notificationSchema.pre('save', function(next) {

  if (this.isModified('message') && this.message) {
    this.message_enc = encryptField(this.message);
    this.message = undefined;
  }
  next();
});

notificationSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  if (!update) return next();
  
  const set = update.$set || update;
  if (set.message !== undefined) {
    if (set.message === null || set.message === '') {
      set.message_enc = undefined;
    } else {
      set.message_enc = encryptField(set.message);
    }
    
    if (update.$set) delete update.$set.message;
    else delete update.message;
  }
  next();
});

notificationSchema.pre('insertMany', function(next, docs) {
  for (const doc of docs) {
    if (doc.message) {
      doc.message_enc = encryptField(doc.message);
      delete doc.message;
    }
  }
  next();
});

notificationSchema.methods.toJSON = function() {
  const obj = this.toObject({ getters: true, virtuals: false });
  if (obj && obj.message_enc) delete obj.message_enc;
  return obj;
};

module.exports = mongoose.model('Notification', notificationSchema);
