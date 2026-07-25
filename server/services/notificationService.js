// services/notificationService.js
const NotificationLog = require('../models/NotificationLog');
const telegramClient = require('./telegramClient');
const moment = require('moment');

const MAX_RETRIES = parseInt(process.env.MAX_RETRIES, 10) || 3;
const SEND_DELAY_MS = parseInt(process.env.TELEGRAM_SEND_DELAY_MS, 10) || 3000;

let isWorkerRunning = false;

/**
 * Queue a new notification for sending
 * @param {object} params
 * @param {string} params.recipient Phone number
 * @param {string} params.message Message content
 * @param {string} params.notificationType 'birthday' | 'weekly_followup' | 'custom'
 * @param {string} [params.recipientId] Optional DB Object ID reference
 * @param {string} [params.recipientType] Optional 'User' | 'Student' | 'custom'
 * @param {string} [params.jobId] Optional DB Object ID of ScheduledJob
 * @param {Date} [params.scheduledTime] Optional scheduled time (defaults to now)
 */
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
  console.log(`[NotificationService] Message queued for ${recipient} (Type: ${notificationType})`);
  
  // Start worker if not running
  triggerQueueWorker();
  
  return log;
}

/**
 * Check if a birthday message has already been sent/queued for a recipient on a specific day
 * @param {string} recipientId
 * @param {string} [recipientPhone] Optional recipient phone number to prevent duplicates per-recipient (needed for students' father/mother check)
 * @param {Date} [date] Day to check (e.g. today)
 * @param {string} [timezone] Timezone to check (defaults to Africa/Cairo)
 * @returns {Promise<boolean>}
 */
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

  // Filter in memory since the phone numbers are encrypted with GCM and dynamic IVs
  return logs.some(log => {
    if (!log.recipient) return false;
    return String(log.recipient).trim() === String(recipientPhone).trim();
  });
}

/**
 * Sequential background worker loop that handles sending and rate-limiting
 */
async function runQueueWorker() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;
  console.log('🚀 [NotificationQueue] Queue worker started.');

  while (isWorkerRunning) {
    if (process.env.PAUSE_SCHEDULER === 'true') {
      await new Promise(resolve => setTimeout(resolve, 5000));
      continue;
    }

    try {
      // Find next pending message scheduled for now or earlier
      const now = new Date();
      const nextItem = await NotificationLog.findOneAndUpdate(
        {
          status: 'pending',
          scheduledTime: { $lte: now }
        },
        {
          // Temporary status to reserve the item
          status: 'pending' 
        }
      ).sort({ scheduledTime: 1, createdAt: 1 });

      if (!nextItem) {
        // No pending items, wait before checking again
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      // Mark status as 'sending' to avoid double-processing
      nextItem.status = 'pending'; // keep it in log in case of crash, but let's change to a sending state
      // We will perform the send operation
      console.log(`[NotificationQueue] Processing item ${nextItem._id} to ${nextItem.recipient}...`);
      
      const result = await telegramClient.sendTelegramMessage(nextItem.recipient, nextItem.message);
      
      if (result.success) {
        nextItem.status = 'sent';
        nextItem.sentTime = new Date();
        nextItem.errorDetails = undefined;
        console.log(`✅ [NotificationQueue] Sent message to ${nextItem.recipient}. Message ID: ${result.messageId}`);
      } else {
        nextItem.retryCount += 1;
        nextItem.errorDetails = result.error;
        
        if (nextItem.retryCount >= MAX_RETRIES) {
          nextItem.status = 'failed';
          console.error(`❌ [NotificationQueue] Permanently failed to send to ${nextItem.recipient} after ${nextItem.retryCount} attempts. Error: ${result.error}`);
        } else {
          nextItem.status = 'pending'; // Leave it for retry
          console.warn(`⚠️ [NotificationQueue] Temporary send failure to ${nextItem.recipient}. Retry ${nextItem.retryCount}/${MAX_RETRIES}. Error: ${result.error}`);
        }
      }

      await nextItem.save();

      // Enforce rate limit delay between successive sends
      await new Promise(resolve => setTimeout(resolve, SEND_DELAY_MS));

    } catch (err) {
      console.error('[NotificationQueue] Error in queue worker loop:', err);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

/**
 * Trigger queue worker to check for pending jobs
 */
function triggerQueueWorker() {
  if (!isWorkerRunning) {
    runQueueWorker().catch(err => {
      console.error('Fatal error starting Notification Queue worker:', err);
      isWorkerRunning = false;
    });
  }
}

module.exports = {
  queueNotification,
  hasBeenNotifiedToday,
  triggerQueueWorker,
  telegramClient
};
