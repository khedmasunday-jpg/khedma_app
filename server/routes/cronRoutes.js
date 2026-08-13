const express = require('express');
const router = express.Router();
const { verifyCronAuth } = require('../middleware/verifyCronAuth');
const { runBirthdayJob } = require('../jobs/birthdayJob');
const { runWeeklyReminderJob } = require('../jobs/weeklyreminder');
const { runBackupJob } = require('../jobs/backupJob');
const { processPendingNotifications } = require('../services/notificationService');

router.get('/birthday', verifyCronAuth, async (req, res) => {
  try {
    const isManual = !!req.user; // If triggered by user, it's manual
    const result = await runBirthdayJob(isManual);
    await processPendingNotifications(); // Drain notifications
    res.json(result);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to run birthday job', error: err.message });
  }
});

router.get('/attendance', verifyCronAuth, async (req, res) => {
  try {
    const isManual = !!req.user;
    const result = await runWeeklyReminderJob(isManual);
    await processPendingNotifications();
    res.json(result);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to run attendance job', error: err.message });
  }
});

router.get('/backup', verifyCronAuth, async (req, res) => {
  try {
    const isManual = !!req.user;
    const result = await runBackupJob(isManual);
    await processPendingNotifications();
    res.json(result);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to run backup job', error: err.message });
  }
});

module.exports = router;
