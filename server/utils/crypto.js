const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const KEY = crypto.createHash('sha256').update(String(process.env.ENCRYPTION_KEY || 'default_secret_key')).digest();
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(String(text), 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return { iv: iv.toString('base64'), data: encrypted };
}

function decrypt(obj) {
  if (!obj || !obj.iv || !obj.data) return '';
  try {
    const iv = Buffer.from(obj.iv, 'base64');
    const encryptedText = Buffer.from(obj.data, 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return '';
  }
}

module.exports = { encrypt, decrypt };
