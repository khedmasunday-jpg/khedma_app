
const mongoose = require('mongoose');
const crypto = require('crypto');

const AES_SECRET = process.env.AES_SECRET_KEY || process.env.ENCRYPTION_KEY;
if (!AES_SECRET) throw new Error('Missing AES_SECRET_KEY or ENCRYPTION_KEY in .env');

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
    return '';
  }
}

const notificationLogSchema = new mongoose.Schema(
  {
    
    recipient: {
      type: String,
      set: function (v) {
        if (v === undefined) return v;
        if (v === null || v === '') {
          this.recipient_enc = undefined;
          return undefined;
        }
        this.recipient_enc = encryptField(v);
        return undefined;
      },
      get: function () {
        return decryptField(this.recipient_enc);
      },
    },
    recipient_enc: { data: String, iv: String, tag: String },

    recipientId: { type: mongoose.Schema.Types.ObjectId, refPath: 'recipientType' },
    recipientType: { type: String, enum: ['User', 'Student', 'custom'], default: 'custom' },

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
      },
    },
    message_enc: { data: String, iv: String, tag: String },

    notificationType: { type: String, enum: ['birthday', 'weekly_followup', 'custom'], required: true },
    scheduledTime: { type: Date, required: true },
    sentTime: { type: Date },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    retryCount: { type: Number, default: 0 },
    errorDetails: { type: String },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'ScheduledJob' },
  },
  { timestamps: true, toJSON: { getters: true }, toObject: { getters: true } }
);

notificationLogSchema.index({ status: 1, scheduledTime: 1 });
notificationLogSchema.index({ jobId: 1 });
notificationLogSchema.index({ recipientId: 1 });

notificationLogSchema.pre('save', function (next) {
  if (this.isModified('message') && this.message) {
    this.message_enc = encryptField(this.message);
    this.message = undefined;
  }
  if (this.isModified('recipient') && this.recipient) {
    this.recipient_enc = encryptField(this.recipient);
    this.recipient = undefined;
  }
  next();
});

notificationLogSchema.pre('insertMany', function (next, docs) {
  for (const doc of docs) {
    if (doc.message) {
      doc.message_enc = encryptField(doc.message);
      delete doc.message;
    }
    if (doc.recipient) {
      doc.recipient_enc = encryptField(doc.recipient);
      delete doc.recipient;
    }
  }
  next();
});

notificationLogSchema.methods.toJSON = function () {
  const obj = this.toObject({ getters: true, virtuals: false });
  if (obj) {
    delete obj.message_enc;
    delete obj.recipient_enc;
  }
  return obj;
};

module.exports = mongoose.model('NotificationLog', notificationLogSchema);
