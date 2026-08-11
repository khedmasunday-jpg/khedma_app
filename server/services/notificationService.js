
const NotificationLog = require('../models/NotificationLog');
const telegramClient = require('./telegramClient');
const moment = require('moment');

const MAX_RETRIES = parseInt(process.env.MAX_RETRIES, 10) || 3;
const SEND_DELAY_MS = parseInt(process.env.TELEGRAM_SEND_DELAY_MS, 10) || 200; // reduced for Vercel

let isWorkerRunning = false;

async function queueNotification({
  recipient,
  message,
  notificationType,
  recipientId,
  recipientType = 'custom',
  jobId,
  scheduledTime = new Date()
}) {
  const log = new NotificationLog({
    recipient,
    message,
    notificationType,
    recipientId,
    recipientType,
    jobId,
    scheduledTime,
    status: 'pending'
  });

  await log.save();

  triggerQueueWorker();
  
  return log;
}

async function hasBeenNotifiedToday(recipientId, recipientPhone, date = new Date(), timezone = 'Africa/Cairo') {
  const startOfDay = moment.tz(date, timezone).startOf('day').toDate();
  const endOfDay = moment.tz(date, timezone).endOf('day').toDate();

  const logs = await NotificationLog.find({
    recipientId,
    notificationType: 'birthday',
    scheduledTime: { $gte: startOfDay, $lte: endOfDay }
  });

  if (!recipientPhone) {
    return logs.length > 0;
  }

  return logs.some(log => {
    if (!log.recipient) return false;
    return String(log.recipient).trim() === String(recipientPhone).trim();
  });
}

async function runQueueWorker() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  while (isWorkerRunning) {
    if (process.env.PAUSE_SCHEDULER === 'true') {
      await new Promise(resolve => setTimeout(resolve, 5000));
      continue;
    }

    try {
      
      const now = new Date();
      const nextItem = await NotificationLog.findOneAndUpdate(
        {
          status: 'pending',
          scheduledTime: { $lte: now }
        },
        {
          
          status: 'pending' 
        }
      ).sort({ scheduledTime: 1, createdAt: 1 });

      if (!nextItem) {
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      let sendToTarget = nextItem.recipient;
      if (nextItem.recipientId && (nextItem.recipientType === 'User' || !nextItem.recipientType)) {
        try {
          const User = require('../models/User');
          const u = await User.findById(nextItem.recipientId);
          if (u && u.telegramChatId) {
            sendToTarget = u.telegramChatId;
          }
        } catch (e) {
          
        }
      }
      
      const result = await telegramClient.sendTelegramMessage(sendToTarget, nextItem.message);
      
      if (result.success) {
        nextItem.status = 'sent';
        nextItem.sentTime = new Date();
        nextItem.errorDetails = undefined;
      } else {
        nextItem.retryCount += 1;
        nextItem.errorDetails = result.error;
        
        if (nextItem.retryCount >= MAX_RETRIES) {
          nextItem.status = 'failed';
          console.error(`❌ [NotificationQueue] Permanently failed to send to ${nextItem.recipient} after ${nextItem.retryCount} attempts. Error: ${result.error}`);
        } else {
          nextItem.status = 'pending'; 
          console.warn(`⚠️ [NotificationQueue] Temporary send failure to ${nextItem.recipient}. Retry ${nextItem.retryCount}/${MAX_RETRIES}. Error: ${result.error}`);
        }
      }

      await nextItem.save();

      await new Promise(resolve => setTimeout(resolve, SEND_DELAY_MS));

    } catch (err) {
      console.error('[NotificationQueue] Error in queue worker loop:', err);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

function triggerQueueWorker() {
  if (!isWorkerRunning) {
    runQueueWorker().catch(err => {
      console.error('Fatal error starting Notification Queue worker:', err);
      isWorkerRunning = false;
    });
  }
}

async function processPendingNotifications() {
  console.log('[NotificationQueue] Processing pending notifications synchronously...');
  let hasMore = true;
  while (hasMore) {
    try {
      const now = new Date();
      const nextItem = await NotificationLog.findOneAndUpdate(
        {
          status: 'pending',
          scheduledTime: { $lte: now }
        },
        {
          status: 'processing'
        }
      ).sort({ scheduledTime: 1, createdAt: 1 });

      if (!nextItem) {
        hasMore = false;
        break;
      }

      let sendToTarget = nextItem.recipient;
      if (nextItem.recipientId && (nextItem.recipientType === 'User' || !nextItem.recipientType)) {
        try {
          const User = require('../models/User');
          const u = await User.findById(nextItem.recipientId);
          if (u && u.telegramChatId) {
            sendToTarget = u.telegramChatId;
          }
        } catch (e) {
        }
      }
      
      const result = await telegramClient.sendTelegramMessage(sendToTarget, nextItem.message);
      
      if (result.success) {
        nextItem.status = 'sent';
        nextItem.sentTime = new Date();
        nextItem.errorDetails = undefined;
      } else {
        nextItem.retryCount += 1;
        nextItem.errorDetails = result.error;
        
        if (nextItem.retryCount >= MAX_RETRIES) {
          nextItem.status = 'failed';
          console.error(`❌ [NotificationQueue] Permanently failed to send to ${nextItem.recipient}. Error: ${result.error}`);
        } else {
          nextItem.status = 'pending'; 
        }
      }

      await nextItem.save();
      await new Promise(resolve => setTimeout(resolve, SEND_DELAY_MS));
    } catch (err) {
      console.error('[NotificationQueue] Error in sync processor loop:', err);
      hasMore = false;
    }
  }
  console.log('[NotificationQueue] Finished processing pending notifications.');
}

module.exports = {
  queueNotification,
  hasBeenNotifiedToday,
  triggerQueueWorker,
  processPendingNotifications,
  telegramClient
};
