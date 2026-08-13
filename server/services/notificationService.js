const NotificationLog = require('../models/NotificationLog');
const telegramClient = require('./telegramClient');
const moment = require('moment');
const Logger = require('../utils/logger');

const MAX_RETRIES = parseInt(process.env.MAX_RETRIES, 10) || 3;
const SEND_DELAY_MS = parseInt(process.env.TELEGRAM_SEND_DELAY_MS, 10) || 200; // reduced for Vercel

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
  Logger.info('TELEGRAM_MESSAGE_QUEUED', { recipient, notificationType });
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

// Bounded synchronous queue processor suitable for Vercel Serverless
async function processPendingNotifications() {
  console.log('[NotificationQueue] Processing pending notifications synchronously...');
  
  // To avoid hitting Vercel serverless timeouts (e.g. 10s or 60s max), limit the batch size.
  // 50 messages with 200ms delay = ~10s max.
  const MAX_BATCH_SIZE = 50; 
  let processedCount = 0;
  let hasMore = true;

  while (hasMore && processedCount < MAX_BATCH_SIZE) {
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
        Logger.info('TELEGRAM_MESSAGE_SENT', { recipient: sendToTarget, notificationType: nextItem.notificationType });
      } else {
        nextItem.retryCount += 1;
        nextItem.errorDetails = result.error;
        
        if (nextItem.retryCount >= MAX_RETRIES) {
          nextItem.status = 'failed';
          console.error(`❌ [NotificationQueue] Permanently failed to send to ${nextItem.recipient}. Error: ${result.error}`);
          Logger.error('TELEGRAM_MESSAGE_FAILED', { recipient: sendToTarget, error: result.error, retryCount: nextItem.retryCount });
        } else {
          nextItem.status = 'pending'; 
        }
      }

      await nextItem.save();
      processedCount++;
      await new Promise(resolve => setTimeout(resolve, SEND_DELAY_MS));
    } catch (err) {
      console.error('[NotificationQueue] Error in sync processor loop:', err);
      hasMore = false;
    }
  }
  console.log(`[NotificationQueue] Finished processing ${processedCount} pending notifications.`);
}

module.exports = {
  queueNotification,
  hasBeenNotifiedToday,
  processPendingNotifications,
  telegramClient
};
