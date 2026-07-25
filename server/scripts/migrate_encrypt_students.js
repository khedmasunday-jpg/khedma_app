/*
  Migration script: encrypt plaintext fields for students collection.
  Usage:
    cd server
    node scripts/migrate_encrypt_students.js

  This script reads MONGO_URI and AES_SECRET_KEY from server/.env (so run from server/).
  It will encrypt plaintext fields into corresponding *_enc fields and unset the plaintext fields.
  Make a backup before running (recommended).
*/

require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MONGO_URI = process.env.MONGO_URI;
const AES_SECRET = process.env.AES_SECRET_KEY || process.env.ENCRYPTION_KEY || process.env.AES_KEY;
if (!MONGO_URI) {
  console.error('Missing MONGO_URI in server/.env');
  process.exit(1);
}
if (!AES_SECRET) {
  console.error('Missing AES_SECRET_KEY/ENCRYPTION_KEY in server/.env');
  process.exit(1);
}

const AES_KEY = crypto.createHash('sha256').update(String(AES_SECRET)).digest();
const ALGO = 'aes-256-gcm';

function encryptFieldRaw(value) {
  if (value === undefined || value === null) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, AES_KEY, iv);
  const buf = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { data: buf.toString('base64'), iv: iv.toString('base64'), tag: tag.toString('base64') };
}

async function main() {
  // CLI flags
  const argv = process.argv.slice(2);
  const isApply = argv.includes('--apply');
  const dryRun = !isApply; // default to dry-run unless --apply provided
  const backupDirArgIndex = argv.findIndex(a => a === '--backup-dir');
  const backupDir = backupDirArgIndex >= 0 ? argv[backupDirArgIndex + 1] : null;
  const batchSizeIndex = argv.findIndex(a => a === '--batch-size');
  const batchSize = batchSizeIndex >= 0 ? parseInt(argv[batchSizeIndex + 1], 10) : 100;

  console.log('Migration script: encrypt plaintext student fields.');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no writes)' : 'APPLY (will modify documents)'}`);
  if (backupDir) console.log(`Backup dir: ${backupDir}`);

  if (backupDir && !dryRun) {
    try {
      fs.mkdirSync(backupDir, { recursive: true });
    } catch (err) {
      console.error('Unable to create backup dir:', err.message);
      process.exit(1);
    }
  }

  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = mongoose.connection.db;
  console.log('Connected to MongoDB');

  const colName = 'students';
  const col = db.collection(colName);

  // First pass: count how many documents would be updated
  const cursor = col.find({});
  let willUpdateCount = 0;
  const fields = [
    ['fullName', 'fullName_enc'],
    ['classname', 'classname_enc'],
    ['classLevel', 'classLevel_enc'],
    ['studentId', 'studentId_enc'],
    ['googlecode', 'googlecode_enc'],
    ['address', 'address_enc'],
    ['mother_phonenumber', 'mother_phonenumber_enc'],
    ['father_phonenumber', 'father_phonenumber_enc'],
    ['birthdate', 'birthdate_enc'],
  ];

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    let will = false;
    for (const [plain, enc] of fields) {
      if (doc[plain] !== undefined && !doc[enc]) { will = true; break; }
    }
    if (will) willUpdateCount++;
  }

  console.log(`Documents that would be updated: ${willUpdateCount}`);
  if (dryRun) {
    console.log('Dry run complete. To apply changes run with --apply');
    await mongoose.disconnect();
    process.exit(0);
  }

  // Apply mode
  console.log('Starting update pass...');
  const applyCursor = col.find({});
  let updated = 0;
  let processed = 0;
  while (await applyCursor.hasNext()) {
    const doc = await applyCursor.next();
    const update = { $set: {}, $unset: {} };
    let will = false;

    for (const [plain, enc] of fields) {
      if (doc[plain] !== undefined && !doc[enc]) {
        let val = doc[plain];
        if (plain === 'classLevel') val = String(val);
        if (plain === 'birthdate' && val) val = new Date(val).toISOString();
        const encrypted = encryptFieldRaw(val);
        if (encrypted) {
          update.$set[enc] = encrypted;
          if (plain !== 'studentId') {
            update.$unset[plain] = '';
          }
          will = true;
        }
      }
    }

    if (will) {
      // backup original doc if requested
      if (backupDir) {
        try {
          const filePath = path.join(backupDir, `${doc._id}.json`);
          fs.writeFileSync(filePath, JSON.stringify(doc, null, 2), { flag: 'w' });
        } catch (err) {
          console.error('Failed to backup doc', doc._id, err.message);
          // continue even if backup fails
        }
      }

      if (Object.keys(update.$set).length === 0) delete update.$set;
      if (Object.keys(update.$unset).length === 0) delete update.$unset;
      try {
        await col.updateOne({ _id: doc._id }, update);
        updated++;
      } catch (err) {
        console.error('Failed to update doc', doc._id, err.message);
      }
    }

    processed++;
    if (processed % Math.max(1, batchSize) === 0) {
      console.log(`Processed ${processed} documents, updated ${updated}`);
    }
  }

  console.log(`Finished. Updated ${updated} documents in ${colName}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
