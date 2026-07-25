// routes/telegramRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken, authorizeRoles } = require('../middleware/auth');

const MessageTemplate = require('../models/MessageTemplate');
const RecipientGroup = require('../models/RecipientGroup');
const ScheduledJob = require('../models/ScheduledJob');
const NotificationLog = require('../models/NotificationLog');

const telegramClient = require('../services/telegramClient');
const schedulerService = require('../services/schedulerService');

// Require authentication and principal/admin authorization for all Telegram configurations
router.use(verifyToken);
router.use(authorizeRoles('admin', 'principal'));

/**
 * GET /api/telegram/status
 * Get the current OpenWA connection status and mode
 */
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
    res.status(500).json({ msg: err.message || 'Server error' });
  }
});

/**
 * POST /api/telegram/reconnect
 * Manually trigger re-initialization of Telegram client (e.g. to get a new QR code)
 */
router.post('/reconnect', async (req, res) => {
  try {
    await telegramClient.reconnectTelegram();
    res.json({ msg: 'Telegram client re-initialization triggered successfully.' });
  } catch (err) {
    res.status(500).json({ msg: err.message || 'Server error' });
  }
});

/**
 * POST /api/telegram/logout
 * Log out and clear the saved Telegram session
 */
router.post('/logout', async (req, res) => {
  try {
    await telegramClient.logoutTelegram();
    res.json({ msg: 'Telegram logged out successfully.' });
  } catch (err) {
    res.status(500).json({ msg: err.message || 'Server error' });
  }
});

// --- Message Template Endpoints ---

/**
 * GET /api/telegram/templates
 */
router.get('/templates', async (req, res) => {
  try {
    const templates = await MessageTemplate.find().sort({ createdAt: -1 });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ msg: err.message || 'Server error' });
  }
});

/**
 * POST /api/telegram/templates
 */
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
    res.status(500).json({ msg: err.message || 'Server error' });
  }
});

/**
 * PUT /api/telegram/templates/:id
 */
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
    res.status(500).json({ msg: err.message || 'Server error' });
  }
});

/**
 * DELETE /api/telegram/templates/:id
 */
router.delete('/templates/:id', async (req, res) => {
  try {
    const template = await MessageTemplate.findByIdAndDelete(req.params.id);
    if (!template) return res.status(404).json({ msg: 'Template not found' });
    res.json({ msg: 'Template deleted successfully' });
  } catch (err) {
    res.status(500).json({ msg: err.message || 'Server error' });
  }
});


// --- Recipient Group Endpoints ---

/**
 * GET /api/telegram/groups
 */
router.get('/groups', async (req, res) => {
  try {
    const groups = await RecipientGroup.find().sort({ createdAt: -1 });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ msg: err.message || 'Server error' });
  }
});

/**
 * POST /api/telegram/groups
 */
router.post('/groups', async (req, res) => {
  try {
    const { name, description, criteria, recipients } = req.body;
    if (!name) return res.status(400).json({ msg: 'Group name is required' });
    
    const group = new RecipientGroup({ name, description, criteria, recipients });
    await group.save();
    res.status(201).json(group);
  } catch (err) {
    res.status(500).json({ msg: err.message || 'Server error' });
  }
});

/**
 * PUT /api/telegram/groups/:id
 */
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
    res.status(500).json({ msg: err.message || 'Server error' });
  }
});

/**
 * DELETE /api/telegram/groups/:id
 */
router.delete('/groups/:id', async (req, res) => {
  try {
    const group = await RecipientGroup.findByIdAndDelete(req.params.id);
    if (!group) return res.status(404).json({ msg: 'Group not found' });
    res.json({ msg: 'Group deleted successfully' });
  } catch (err) {
    res.status(500).json({ msg: err.message || 'Server error' });
  }
});


// --- Scheduled Job Endpoints ---

/**
 * GET /api/telegram/jobs
 */
router.get('/jobs', async (req, res) => {
  try {
    const jobs = await ScheduledJob.find()
      .populate('templateId')
      .populate('recipientGroupId')
      .sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ msg: err.message || 'Server error' });
  }
});

/**
 * POST /api/telegram/jobs
 */
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
    
    // Reload scheduler to apply changes
    await schedulerService.initializeScheduler();

    res.status(201).json(job);
  } catch (err) {
    res.status(500).json({ msg: err.message || 'Server error' });
  }
});

/**
 * PUT /api/telegram/jobs/:id
 */
router.put('/jobs/:id', async (req, res) => {
  try {
    const { name, description, cronExpression, timezone, isActive, notificationType, templateId, recipientGroupId, settings } = req.body;
    const job = await ScheduledJob.findByIdAndUpdate(
      req.params.id,
      { name, description, cronExpression, timezone, isActive, notificationType, templateId, recipientGroupId, settings },
      { new: true, runValidators: true }
    );
    if (!job) return res.status(404).json({ msg: 'Job not found' });

    // Reload scheduler to apply changes
    await schedulerService.initializeScheduler();

    res.json(job);
  } catch (err) {
    res.status(500).json({ msg: err.message || 'Server error' });
  }
});

/**
 * POST /api/telegram/jobs/:id/run
 * Manually trigger a job to execute right now
 */
router.post('/jobs/:id/run', async (req, res) => {
  try {
    const job = await ScheduledJob.findById(req.params.id);
    if (!job) return res.status(404).json({ msg: 'Job not found' });

    console.log(`[Manual Trigger] User initiated manual run of job: "${job.name}"`);
    
    // Run asynchronously so response is instant, worker process-queue handles sending
    schedulerService.runJobManually(job._id).catch(err => {
      console.error(`Manual run of job ${job.name} failed:`, err);
    });

    res.json({ msg: `Job "${job.name}" triggered successfully. Messages are being queued.` });
  } catch (err) {
    res.status(500).json({ msg: err.message || 'Server error' });
  }
});


// --- Notification Log Endpoints ---

/**
 * GET /api/telegram/logs
 * Retrieve all send logs with optional status, type, and pagination
 */
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
    res.status(500).json({ msg: err.message || 'Server error' });
  }
});

/**
 * POST /api/telegram/send-test
 * Directly send a test message to a specified number or user
 */
router.post('/send-test', async (req, res) => {
  try {
    const { to, message, userId } = req.body;
    if (!to || !message) {
      return res.status(400).json({ msg: 'Recipient (to) and message are required' });
    }

    console.log(`[Test Telegram Send] Sending test to ${to} for user ${userId || 'none'}`);
    const result = await telegramClient.sendTelegramMessage(to, message);

    // Save to NotificationLog
    const log = new NotificationLog({
      recipient: to,
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
      res.status(500).json({ success: false, msg: result.error || 'Failed to send message' });
    }
  } catch (err) {
    res.status(500).json({ msg: err.message || 'Server error' });
  }
});

module.exports = router;
