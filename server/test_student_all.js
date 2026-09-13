const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config();

const fallbacks = [
  process.env.AES_SECRET_KEY,
  process.env.ENCRYPTION_KEY,
  process.env.JWT_SECRET,
  'khedma_fallback_secret_key_2026'
];

function tryDecrypt(enc, secret) {
  if (!enc || !enc.data || !enc.iv || !enc.tag) return null;
  const AES_KEY = crypto.createHash('sha256').update(secret).digest();
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', AES_KEY, Buffer.from(enc.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(enc.tag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(enc.data, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch (err) {
    return null;
  }
}

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Student = require('./models/Student');
  const students = await Student.collection.find({ classname_enc: { $ne: null } }).limit(10).toArray();
  
  for (const stu of students) {
    let works = false;
    for (const secret of fallbacks) {
      if (!secret) continue;
      const res = tryDecrypt(stu.classname_enc, secret);
      if (res) {
        works = true;
        console.log(`Student ${stu._id} decrypted with ${secret.substring(0,5)}... -> ${res}`);
        break;
      }
    }
    if (!works) console.log(`Student ${stu._id} FAILED to decrypt`);
  }
  process.exit(0);
});
