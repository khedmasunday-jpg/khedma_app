require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI;
const AES_SECRET = process.env.AES_SECRET_KEY;
if (!MONGO_URI) throw new Error('Missing MONGO_URI in .env');
if (!AES_SECRET) throw new Error('Missing AES_SECRET_KEY in .env');

const AES_KEY = crypto.createHash('sha256').update(AES_SECRET).digest();

function decryptField(enc) {
  if (!enc || !enc.data || !enc.iv || !enc.tag) return null;
  const decipher = crypto.createDecipheriv('aes-256-gcm', AES_KEY, Buffer.from(enc.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(enc.tag, 'base64'));
  const buf = Buffer.concat([
    decipher.update(Buffer.from(enc.data, 'base64')),
    decipher.final(),
  ]);
  const txt = buf.toString('utf8');
  try {
    // Bulk script stored JSON.stringify values
    return JSON.parse(txt);
  } catch {
    return txt;
  }
}

async function main() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('✅ Connected to MongoDB');

  const col = mongoose.connection.collection('users');
  const cursor = col.find({});
  let fixed = 0;
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    const updates = {};

    // Restore username
    if ((!doc.username || typeof doc.username !== 'string') && doc.username_enc) {
      const decUsername = decryptField(doc.username_enc);
      if (decUsername && typeof decUsername === 'string') {
        updates.username = decUsername;
      }
    }

    // Restore password (bcrypt hash)
    if ((!doc.password || typeof doc.password !== 'string') && doc.password_enc) {
      const decHash = decryptField(doc.password_enc);
      if (decHash && typeof decHash === 'string' && decHash.startsWith('$2')) {
        updates.password = decHash;
      }
    }

    // Restore fullName
    if ((!doc.fullName || typeof doc.fullName !== 'string') && doc.fullName_enc) {
      const decFull = decryptField(doc.fullName_enc);
      if (decFull && typeof decFull === 'string') updates.fullName = decFull;
    }

    // Restore role from encrypted if present
    if (doc.role_enc) {
      const decRole = decryptField(doc.role_enc);
      const allowed = ['admin', 'principal', 'co-principal', 'teacher'];
      if (decRole && typeof decRole === 'string' && allowed.includes(decRole)) {
        if (doc.role !== decRole) updates.role = decRole;
      }
    }

    if (Object.keys(updates).length > 0) {
      try {
        await col.updateOne({ _id: doc._id }, { $set: updates });
        fixed++;
      } catch (e) {
        console.error('Failed to repair user', String(doc._id), e.message);
      }
    }
  }

  console.log(`🔧 Repaired ${fixed} users. Ensure an index exists on username (unique).`);

  // Create partial unique index on username (only when username is a string)
  try {
    await col.createIndex(
      { username: 1 },
      { unique: true, partialFilterExpression: { username: { $type: 'string' } } }
    );
    console.log('✅ Ensured partial unique index on username');
  } catch (e) {
    console.warn('Index creation warning:', e.message);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('❌ Repair failed:', e);
  process.exit(1);
});


