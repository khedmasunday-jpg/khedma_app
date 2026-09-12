const crypto = require('crypto');
require('dotenv').config();

const ALGORITHM = 'aes-256-cbc';
const secretKey = process.env.ENCRYPTION_KEY || process.env.AES_SECRET_KEY || process.env.JWT_SECRET || 'khedma_fallback_secret_key_2026';
const KEY = crypto.createHash('sha256').update(String(secretKey)).digest();

const obj = { iv: 'JjevNs/GAZ4ULOkdazA9AQ==', data: 'lmMzEL2c42uPIgCZNxoqUA==' };
try {
  const iv = Buffer.from(obj.iv, 'base64');
  const encryptedText = Buffer.from(obj.data, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  console.log('Decrypted:', decrypted);
} catch (e) {
  console.error('Error:', e);
}
