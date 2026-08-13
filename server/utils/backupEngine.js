const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const mongoose = require('mongoose');
const Log = require('../models/Log');
const JobLog = require('../models/JobLog');



const os = require('os');

let lastBackupInfo = null;

async function runDatabaseBackup(triggeredBy = 'cron', userObj = null) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = process.env.VERCEL ? os.tmpdir() : path.join(__dirname, '../backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const fileName = `khedma-backup-${timestamp}.json.gz`;
  const filePath = path.join(backupDir, fileName);

  try {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not open.');
    }

    const collections = await db.listCollections().toArray();
    const exportData = {
      app: 'khedma_app',
      exportDate: new Date().toISOString(),
      triggeredBy,
      collections: {}
    };

    let totalDocs = 0;
    for (const col of collections) {
      if (col.name.startsWith('system.')) continue;
      const docs = await db.collection(col.name).find({}).toArray();
      exportData.collections[col.name] = docs;
      totalDocs += docs.length;
    }

    const jsonString = JSON.stringify(exportData);
    const compressedBuffer = zlib.gzipSync(Buffer.from(jsonString, 'utf-8'));
    fs.writeFileSync(filePath, compressedBuffer);
    const fileSize = compressedBuffer.length;



    let telegramUploaded = false;
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      try {
        const TelegramBot = require('node-telegram-bot-api');
        const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
        const caption = `📦 *Khedma App Database Backup*\n📅 *Date:* ${new Date().toLocaleString()}\n💾 *Size:* ${(fileSize / 1024 / 1024).toFixed(2)} MB\n📄 *Docs:* ${totalDocs} (${Object.keys(exportData.collections).length} collections)`;
        await bot.sendDocument(process.env.TELEGRAM_CHAT_ID, filePath, { caption, parse_mode: 'Markdown' });
        telegramUploaded = true;
      } catch (tgErr) {
        console.error('⚠️ Telegram upload error:', tgErr.message);
      }
    }

    let dropboxUploaded = false;
    if (process.env.DROPBOX_ACCESS_TOKEN) {
      try {
        const axios = require('axios');
        const fileData = fs.readFileSync(filePath);
        await axios.post('https://content.dropboxapi.com/2/files/upload', fileData, {
          headers: {
            'Authorization': `Bearer ${process.env.DROPBOX_ACCESS_TOKEN}`,
            'Dropbox-API-Arg': JSON.stringify({
              path: `/backups/${fileName}`,
              mode: 'add',
              autorename: true,
              mute: false
            }),
            'Content-Type': 'application/octet-stream'
          }
        });
        dropboxUploaded = true;
      } catch (dbxErr) {
        console.error('⚠️ Dropbox upload error:', dbxErr.response?.data || dbxErr.message);
      }
    }

    try {
      if (process.env.VERCEL) {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } else {
        const files = fs.readdirSync(backupDir)
          .filter(f => f.startsWith('khedma-backup-') && f.endsWith('.json.gz'))
          .map(f => ({ name: f, path: path.join(backupDir, f), time: fs.statSync(path.join(backupDir, f)).mtime.getTime() }))
          .sort((a, b) => b.time - a.time);

        const MAX_LOCAL_BACKUPS = 10;
        if (files.length > MAX_LOCAL_BACKUPS) {
          const toDelete = files.slice(MAX_LOCAL_BACKUPS);
          for (const file of toDelete) {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          }
        }
      }
    } catch (rotateErr) {
      console.error('Failed to rotate old local backups:', rotateErr.message);
    }

    try {
      const existingJobLog = await JobLog.findOne({ jobName_enc: { $exists: true } });
      const runDateStr = new Date().toISOString();
      if (existingJobLog) {
        existingJobLog.lastRunDate = runDateStr;
        await existingJobLog.save();
      } else {
        await JobLog.create({ jobName: 'Monthly Database Backup', lastRunDate: runDateStr });
      }
    } catch (jobLogErr) {
      console.error('Failed to save JobLog:', jobLogErr.message);
    }

    if (userObj) {
      try {
        await Log.create({
          action: 'MANUAL_BACKUP_EXECUTE',
          actor: userObj.id || userObj._id,
          performedBy: userObj.id || userObj._id,
          timestamp: new Date(),
          details: `Manual backup completed in ${Date.now() - startTime}ms. Collections: ${Object.keys(exportData.collections).length}, Docs: ${totalDocs}, Size: ${(fileSize / 1024).toFixed(1)} KB.`,
          actorName: userObj.fullName || userObj.username,
          actorRole: userObj.role,
          actionDescription: `Admin ${userObj.fullName || userObj.username} triggered a manual database backup.`
        });
      } catch (logErr) {
        console.error('Failed to write audit log:', logErr.message);
      }
    }

    lastBackupInfo = {
      success: true,
      timestamp: new Date().toISOString(),
      fileName,

      telegramUploaded,
      dropboxUploaded,
      sizeBytes: fileSize,
      collectionCount: Object.keys(exportData.collections).length,
      documentCount: totalDocs,
      durationMs: Date.now() - startTime,
      triggeredBy
    };

    return lastBackupInfo;
  } catch (err) {
    console.error('❌ Backup execution failed:', err);
    lastBackupInfo = {
      success: false,
      timestamp: new Date().toISOString(),
      error: err.message,
      triggeredBy
    };
    throw err;
  }
}

async function restoreDatabaseBackup(backupJsonData, userObj = null) {
  const startTime = Date.now();

  try {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not open.');
    }

    if (!backupJsonData || !backupJsonData.collections) {
      throw new Error('Invalid backup file format: missing "collections" object.');
    }

    let restoredCollectionsCount = 0;
    let restoredDocsCount = 0;

    const convertValue = (key, value) => {
      if (value === null || value === undefined) return value;

      const dateKeys = ['date', 'timestamp', 'createdAt', 'updatedAt', 'birthdate', 'lastRunDate', 'lastAttendanceDate', 'lastAbsentDate', 'scheduledTime'];
      if (dateKeys.includes(key) && typeof value === 'string') {
        const d = new Date(value);
        if (!isNaN(d.getTime())) return d;
      }

      if (typeof value === 'string' && value.length === 24 && /^[0-9a-fA-F]{24}$/.test(value)) {
        try {
          return new mongoose.Types.ObjectId(value);
        } catch (e) {
          return value;
        }
      }

      if (Array.isArray(value)) {
        return value.map(v => convertValue(key, v));
      }

      if (typeof value === 'object' && value !== null) {
        if (value.$oid && typeof value.$oid === 'string') {
          return new mongoose.Types.ObjectId(value.$oid);
        }
        if (value.$date) {
          return new Date(value.$date);
        }
        const newObj = {};
        for (const [k, v] of Object.entries(value)) {
          newObj[k] = convertValue(k, v);
        }
        return newObj;
      }

      return value;
    };

    for (const [colName, docs] of Object.entries(backupJsonData.collections)) {
      if (colName.startsWith('system.')) continue;
      if (!Array.isArray(docs)) continue;

      const collection = db.collection(colName);
      await collection.deleteMany({});

      if (docs.length > 0) {
        const processedDocs = docs.map(doc => {
          const newDoc = {};
          for (const [k, v] of Object.entries(doc)) {
            newDoc[k] = convertValue(k, v);
          }
          return newDoc;
        });
        await collection.insertMany(processedDocs);
        restoredDocsCount += docs.length;
      }
      restoredCollectionsCount++;
    }

    if (userObj) {
      try {
        await Log.create({
          action: 'MANUAL_BACKUP_RESTORE',
          actor: userObj.id || userObj._id,
          performedBy: userObj.id || userObj._id,
          timestamp: new Date(),
          details: `Database restore completed in ${Date.now() - startTime}ms. Restored ${restoredCollectionsCount} collections (${restoredDocsCount} documents) including Tayo points and Telegram Chat IDs.`,
          actorName: userObj.fullName || userObj.username,
          actorRole: userObj.role,
          actionDescription: `Admin ${userObj.fullName || userObj.username} restored database from JSON backup.`
        });
      } catch (e) {}
    }

    return {
      success: true,
      restoredCollectionsCount,
      restoredDocsCount,
      durationMs: Date.now() - startTime
    };
  } catch (err) {
    console.error('❌ Restore execution failed:', err);
    throw err;
  }
}

function getLastBackupInfo() {
  return lastBackupInfo;
}

module.exports = {
  runDatabaseBackup,
  restoreDatabaseBackup,
  getLastBackupInfo
};
