/**
 * 🔒 Universal Field Encryption Script (direct MongoDB version)
 * Encrypts ALL plaintext fields in every collection, skipping ObjectId references and already encrypted fields.
 * 
 * Usage: node server/scripts/encryptAll_universal.js
 */

require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const crypto = require('crypto');

const MONGO_URI = process.env.MONGO_URI;
const AES_SECRET = process.env.AES_SECRET_KEY;
if (!MONGO_URI) throw new Error('Missing MONGO_URI in .env');
if (!AES_SECRET) throw new Error('Missing AES_SECRET_KEY in .env');

const AES_KEY = crypto.createHash('sha256').update(AES_SECRET).digest();

function encryptFieldRaw(value) {
  if (value === undefined || value === null) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', AES_KEY, iv);
  const buf = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    data: buf.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64')
  };
}

function isEncryptable(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'object' && value._bsontype === 'ObjectId') return false;
  if (Array.isArray(value) && value.every(v => v?._bsontype === 'ObjectId')) return false;
  return true;
}

async function processCollection(db, colName) {
  const exists = await db.listCollections({ name: colName }).hasNext();
  if (!exists) {
    console.log(`⚠️  Collection "${colName}" not found, skipping.`);
    return;
  }

  const col = db.collection(colName);

  // Drop potentially problematic unique indexes
  const indexes = await col.listIndexes().toArray().catch(() => []);
  for (const idx of indexes) {
    if (idx.unique && !idx.name.startsWith('_id')) {
      console.log(`⚙️ Dropping unique index "${idx.name}" on ${colName}...`);
      try {
        await col.dropIndex(idx.name);
        console.log(`✅ Dropped index "${idx.name}"`);
      } catch {
        console.log(`ℹ️  Index "${idx.name}" already removed.`);
      }
    }
  }

  const cursor = col.find({});
  let count = 0;

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    const update = { $set: {}, $unset: {} };
    let willUpdate = false;

    for (const [field, value] of Object.entries(doc)) {
      if (
        field === '_id' ||
        field.endsWith('_enc') ||
        field === '__v'
      ) continue;

      if (isEncryptable(value)) {
        const encField = `${field}_enc`;
        if (!doc[encField]) {
          update.$set[encField] = encryptFieldRaw(value);
          update.$unset[field] = '';
          willUpdate = true;
        }
      }
    }

    if (willUpdate) {
      if (Object.keys(update.$set).length === 0) delete update.$set;
      if (Object.keys(update.$unset).length === 0) delete update.$unset;
      await col.updateOne({ _id: doc._id }, update);
      count++;
    }
  }

  console.log(`🔐 ${colName}: encrypted ${count} documents`);
}

async function main() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = mongoose.connection.db;
  console.log('✅ Connected to MongoDB');

  const collections = await db.listCollections().toArray();
  const names = collections.map(c => c.name);

  console.log(`📁 Found ${names.length} collections: ${names.join(', ')}`);

  for (const name of names) {
    await processCollection(db, name);
  }

  console.log('🎉 All encryption complete! You can safely recreate your indexes.');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
