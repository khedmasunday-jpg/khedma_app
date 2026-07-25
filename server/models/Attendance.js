// models/Attendance.js
const mongoose = require('mongoose');
const crypto = require('crypto');

const AES_SECRET = process.env.AES_SECRET_KEY;
if (!AES_SECRET) throw new Error('Missing AES_SECRET_KEY in .env');
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
}

const attendanceSchema = new mongoose.Schema({
  class_enc: { data: String, iv: String, tag: String },
  student_enc: { data: String, iv: String, tag: String },
  date_enc: { data: String, iv: String, tag: String },
  status_enc: { data: String, iv: String, tag: String },
  // Deterministic hashes for efficient lookups and upserts
  class_hash: { type: String, index: true },
  student_hash: { type: String, index: true },
  date_hash: { type: String, index: true }
});

// Virtuals for decrypted fields
attendanceSchema.virtual('class')
  .get(function () { return decryptField(this.class_enc); })
  .set(function (val) { this.class_enc = encryptField(val); });

attendanceSchema.virtual('student')
  .get(function () { return decryptField(this.student_enc); })
  .set(function (val) { this.student_enc = encryptField(val); });

attendanceSchema.virtual('date')
  .get(function () { return decryptField(this.date_enc); })
  .set(function (val) { this.date_enc = encryptField(val); });

attendanceSchema.virtual('status')
  .get(function () { return decryptField(this.status_enc); })
  .set(function (val) { this.status_enc = encryptField(val); });

// Hide encrypted data when sending responses
attendanceSchema.methods.toJSON = function () {
  const obj = this.toObject({ virtuals: true });
  delete obj.class_enc;
  delete obj.student_enc;
  delete obj.date_enc;
  delete obj.status_enc;
  return obj;
};

module.exports = mongoose.model('Attendance', attendanceSchema);
