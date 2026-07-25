const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const mongoose = require('mongoose');
const { google } = require('googleapis');
const Log = require('../models/Log');
const JobLog = require('../models/JobLog');

// Google Drive Auth helper
function getDriveInstance() {
  // Option 1: Use OAuth2 user credentials if provided (bypasses Service Account 0-quota limit on personal drives)
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });
    return google.drive({ version: 'v3', auth: oauth2Client });
  }

  // Option 2: Service Account (Requires Shared Drive / Workspace)
  const SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'];
  let googleAuthOpts = { scopes: SCOPES };

  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      googleAuthOpts.credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    } catch (err) {
      console.error('❌ Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON env variable:', err.message);
    }
  } else {
    // Check candidate key file paths
    const candidatePaths = [
      path.join(__dirname, '../config/drive-service-account.json'),
      '/home/georgeh/Desktop/khedma-project-503310-ae2a9e16c270.json',
      path.join(__dirname, '../../config/config/symbolic-photon-446116-r4-b6c0062c9eb7.json'),
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH
    ].filter(Boolean);

    let keyFilePath = candidatePaths.find(p => fs.existsSync(p));
    if (keyFilePath) {
      googleAuthOpts.keyFile = keyFilePath;
    } else {
      console.warn('⚠️ No Google Drive service account key file found at candidate paths.');
    }
  }

  const auth = new google.auth.GoogleAuth(googleAuthOpts);
  return google.drive({ version: 'v3', auth });
}

// Memory store for last backup info
let lastBackupInfo = null;

async function runDatabaseBackup(triggeredBy = 'cron', userObj = null) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '../backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const fileName = `khedma-backup-${timestamp}.json.gz`;
  const filePath = path.join(backupDir, fileName);

  console.log(`🚀 Starting database backup (${triggeredBy})...`);

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

    console.log(`📦 Extracted ${Object.keys(exportData.collections).length} collections (${totalDocs} documents).`);

    // Convert JSON to Gzip compressed buffer
    const jsonString = JSON.stringify(exportData);
    const compressedBuffer = zlib.gzipSync(Buffer.from(jsonString, 'utf-8'));
    fs.writeFileSync(filePath, compressedBuffer);
    const fileSize = compressedBuffer.length;

    console.log(`💾 Compressed backup created at ${filePath} (${(fileSize / 1024 / 1024).toFixed(2)} MB).`);

    // Upload to Google Drive
    let driveFileId = null;
    let driveErrorMsg = null;
    try {
      const drive = getDriveInstance();
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1sHyt3r1EyIB8RB5-7jNPheLoZ5Jm55Op';

      const fileMetadata = {
        name: fileName,
        parents: [folderId]
      };
      const media = {
        mimeType: 'application/gzip',
        body: fs.createReadStream(filePath)
      };

      const driveRes = await drive.files.create({
        resource: fileMetadata,
        media: media,
        supportsAllDrives: true,
        fields: 'id'
      });

      driveFileId = driveRes.data.id;
      console.log(`✅ Backup successfully uploaded to Google Drive. File ID: ${driveFileId}`);
    } catch (driveErr) {
      driveErrorMsg = driveErr.message;
      console.error('⚠️ Google Drive upload error:', driveErr.message);
    }

    // Upload to Telegram (if configured)
    let telegramUploaded = false;
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      try {
        const TelegramBot = require('node-telegram-bot-api');
        const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
        const caption = `📦 *Khedma App Database Backup*\n📅 *Date:* ${new Date().toLocaleString()}\n💾 *Size:* ${(fileSize / 1024 / 1024).toFixed(2)} MB\n📄 *Docs:* ${totalDocs} (${Object.keys(exportData.collections).length} collections)`;
        await bot.sendDocument(process.env.TELEGRAM_CHAT_ID, filePath, { caption, parse_mode: 'Markdown' });
        telegramUploaded = true;
        console.log('✅ Backup successfully sent to Telegram!');
      } catch (tgErr) {
        console.error('⚠️ Telegram upload error:', tgErr.message);
      }
    }

    // Upload to Dropbox (if configured)
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
        console.log('✅ Backup successfully uploaded to Dropbox!');
      } catch (dbxErr) {
        console.error('⚠️ Dropbox upload error:', dbxErr.response?.data || dbxErr.message);
      }
    }

    // Retain local backup file & auto-rotate old local backups (keep last 10 backups)
    try {
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
            console.log(`🧹 Rotated old local backup file: ${file.name}`);
          }
        }
      }
    } catch (rotateErr) {
      console.error('Failed to rotate old local backups:', rotateErr.message);
    }

    // Update JobLog in Mongo
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

    // Log action if triggered by user
    if (userObj) {
      try {
        await Log.create({
          action: 'MANUAL_BACKUP_EXECUTE',
          actor: userObj.id || userObj._id,
          performedBy: userObj.id || userObj._id,
          timestamp: new Date(),
          details: `Manual backup completed in ${Date.now() - startTime}ms. Collections: ${Object.keys(exportData.collections).length}, Docs: ${totalDocs}, Size: ${(fileSize / 1024).toFixed(1)} KB. Drive ID: ${driveFileId || 'None (Error: ' + (driveErrorMsg || 'N/A') + ')'}`,
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
      driveFileId,
      driveError: driveErrorMsg,
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

function getLastBackupInfo() {
  return lastBackupInfo;
}

module.exports = {
  runDatabaseBackup,
  getLastBackupInfo
};
