const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config();

const fallbacks = [
  process.env.JWT_SECRET,
  'khedma_fallback_secret_key_2026',
  process.env.AES_SECRET_KEY,
  process.env.ENCRYPTION_KEY
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
  const Class = require('./models/Class');
  const cls = await Class.collection.findOne({});
  console.log('Raw class:', cls.name_enc);
  
  for (const secret of fallbacks) {
    if (!secret) continue;
    const res = tryDecrypt(cls.name_enc, secret);
    console.log(`Secret starting with ${secret.substring(0, 10)}... ->`, res);
  }
  process.exit(0);
});
