
const express = require('express');
const router = express.Router();
const { verifyToken, authorizeRoles } = require('../middleware/auth');

const MessageTemplate = require('../models/MessageTemplate');
const RecipientGroup = require('../models/RecipientGroup');
const ScheduledJob = require('../models/ScheduledJob');
const NotificationLog = require('../models/NotificationLog');

const telegramClient = require('../services/telegramClient');
const schedulerService = require('../services/schedulerService');

// Public Telegram Webhook Endpoint for receiving /start and user messages
router.post('/webhook', async (req, res) => {
  try {
    await telegramClient.handleIncomingUpdate(req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Error handling Telegram Webhook:', err.message);
    res.json({ ok: true });
  }
});

router.use(verifyToken);
router.use(authorizeRoles('admin', 'principal'));

router.post('/setup-webhook', async (req, res) => {
  try {
    const hostUrl = req.body.url || `https://${req.get('host')}`;
    const ok = await telegramClient.registerWebhook(hostUrl);
    if (ok) {
      res.json({ success: true, msg: `Webhook set successfully to ${hostUrl}/api/telegram/webhook` });
    } else {
      res.status(400).json({ success: false, msg: 'Failed to set webhook. Check TELEGRAM_BOT_TOKEN.' });
    }
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

router.get('/status', async (req, res) => {
  try {
    const status = telegramClient.getTelegramStatus();
    const info = telegramClient.getTelegramQrCode();
    res.json({
      status,
      info,
      mode: process.env.TELEGRAM_MODE || 'mock',
      apiUrl: process.env.OPENWA_API_URL || 'http://localhost:8080',
      rateLimitDelayMs: process.env.TELEGRAM_SEND_DELAY_MS || 3000
    });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/reconnect', async (req, res) => {
  try {
    await telegramClient.reconnectTelegram();
    res.json({ msg: 'Telegram client re-initialization triggered successfully.' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    await telegramClient.logoutTelegram();
    res.json({ msg: 'Telegram logged out successfully.' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/templates', async (req, res) => {
  try {
    const templates = await MessageTemplate.find().sort({ createdAt: -1 });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/templates', async (req, res) => {
  try {
    const { name, content, type, description } = req.body;
    if (!name || !content) {
      return res.status(400).json({ msg: 'Name and content are required' });
    }
    const template = new MessageTemplate({ name, content, type, description });
    await template.save();
    res.status(201).json(template);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.put('/templates/:id', async (req, res) => {
  try {
    const { name, content, type, description } = req.body;
    const template = await MessageTemplate.findByIdAndUpdate(
      req.params.id,
      { name, content, type, description },
      { new: true, runValidators: true }
    );
    if (!template) return res.status(404).json({ msg: 'Template not found' });
    res.json(template);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.delete('/templates/:id', async (req, res) => {
  try {
    const template = await MessageTemplate.findByIdAndDelete(req.params.id);
    if (!template) return res.status(404).json({ msg: 'Template not found' });
    res.json({ msg: 'Template deleted successfully' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/groups', async (req, res) => {
  try {
    const groups = await RecipientGroup.find().sort({ createdAt: -1 });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/groups', async (req, res) => {
  try {
    const { name, description, criteria, recipients } = req.body;
    if (!name) return res.status(400).json({ msg: 'Group name is required' });
    
    const group = new RecipientGroup({ name, description, criteria, recipients });
    await group.save();
    res.status(201).json(group);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.put('/groups/:id', async (req, res) => {
  try {
    const { name, description, criteria, recipients } = req.body;
    const group = await RecipientGroup.findByIdAndUpdate(
      req.params.id,
      { name, description, criteria, recipients },
      { new: true, runValidators: true }
    );
    if (!group) return res.status(404).json({ msg: 'Group not found' });
    res.json(group);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.delete('/groups/:id', async (req, res) => {
  try {
    const group = await RecipientGroup.findByIdAndDelete(req.params.id);
    if (!group) return res.status(404).json({ msg: 'Group not found' });
    res.json({ msg: 'Group deleted successfully' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/jobs', async (req, res) => {
  try {
    const jobs = await ScheduledJob.find()
      .populate('templateId')
      .populate('recipientGroupId')
      .sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/jobs', async (req, res) => {
  try {
    const { name, description, cronExpression, timezone, isActive, notificationType, templateId, recipientGroupId, settings } = req.body;
    if (!name || !cronExpression || !notificationType) {
      return res.status(400).json({ msg: 'Name, cronExpression, and notificationType are required' });
    }

    const job = new ScheduledJob({
      name,
      description,
      cronExpression,
      timezone,
      isActive,
      notificationType,
      templateId,
      recipientGroupId,
      settings
    });

    await job.save();

    await schedulerService.initializeScheduler();

    res.status(201).json(job);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.put('/jobs/:id', async (req, res) => {
  try {
    const { name, description, cronExpression, timezone, isActive, notificationType, templateId, recipientGroupId, settings } = req.body;
    const job = await ScheduledJob.findByIdAndUpdate(
      req.params.id,
      { name, description, cronExpression, timezone, isActive, notificationType, templateId, recipientGroupId, settings },
      { new: true, runValidators: true }
    );
    if (!job) return res.status(404).json({ msg: 'Job not found' });

    await schedulerService.initializeScheduler();

    res.json(job);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/jobs/:id/run', async (req, res) => {
  try {
    const job = await ScheduledJob.findById(req.params.id);
    if (!job) return res.status(404).json({ msg: 'Job not found' });

    schedulerService.runJobManually(job._id).catch(err => {
      console.error(`Manual run of job ${job.name} failed:`, err);
    });

    res.json({ msg: `Job "${job.name}" triggered successfully. Messages are being queued.` });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/logs', async (req, res) => {
  try {
    const { status, type, page = 1, limit = 50 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (type) query.notificationType = type;

    const skipIndex = (page - 1) * limit;

    const logs = await NotificationLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skipIndex)
      .limit(parseInt(limit, 10))
      .populate('jobId', 'name');

    const total = await NotificationLog.countDocuments(query);

    res.json({
      logs,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / limit),
      totalItems: total
    });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/send-test', async (req, res) => {
  try {
    const { to, message, userId } = req.body;
    if (!to || !message) {
      return res.status(400).json({ msg: 'Recipient (to) and message are required' });
    }

    let targetChatId = to;
    if (userId) {
      const User = require('../models/User');
      const targetUser = await User.findById(userId);
      if (targetUser && targetUser.telegramChatId) {
        targetChatId = targetUser.telegramChatId;
      }
    }
    const result = await telegramClient.sendTelegramMessage(targetChatId, message);

    const log = new NotificationLog({
      recipient: targetChatId,
      recipientId: userId || null,
      recipientType: userId ? 'User' : 'custom',
      message: message,
      notificationType: 'custom',
      scheduledTime: new Date(),
      sentTime: result.success ? new Date() : null,
      status: result.success ? 'sent' : 'failed',
      errorDetails: result.success ? null : result.error
    });
    await log.save();

    if (result.success) {
      res.json({ success: true, messageId: result.messageId });
    } else {
      let friendlyError = result.error || 'Failed to send message';
      if (friendlyError.includes('chat not found')) {
        friendlyError = `Telegram Chat ID "${targetChatId}" was not found by Telegram. Please ensure the user has started the bot (/start) and saved their correct numeric Chat ID in their profile.`;
      }
      res.status(400).json({ success: false, msg: friendlyError });
    }
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/broadcast', async (req, res) => {
  try {
    const { message, targetRole } = req.body;
    if (!message) {
      return res.status(400).json({ msg: 'Message text is required for broadcast' });
    }

    const User = require('../models/User');
    const notificationService = require('../services/notificationService');

    const query = { isActive: true };
    if (targetRole && targetRole !== 'all') {
      query.role = targetRole;
    }

    const users = await User.find(query);
    let queuedCount = 0;

    for (const u of users) {
      const recipientTarget = u.telegramChatId || u.phonenumber;
      if (!recipientTarget) continue;

      await notificationService.queueNotification({
        recipient: recipientTarget,
        message: message,
        notificationType: 'custom',
        recipientId: u._id,
        recipientType: 'User',
        scheduledTime: new Date()
      });
      queuedCount++;
    }

    res.json({
      success: true,
      msg: `Broadcast queued successfully for ${queuedCount} users! Messages are sending safely in the background.`,
      targetCount: queuedCount
    });
  } catch (err) {
    console.error('Broadcast error:', err);
    res.status(500).json({ msg: 'Failed to send broadcast' });
  }
});

module.exports = router;
