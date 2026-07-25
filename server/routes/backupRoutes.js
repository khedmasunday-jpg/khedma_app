const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const JobLog = require('../models/JobLog');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const { runDatabaseBackup, getLastBackupInfo } = require('../utils/backupEngine');

/**
 * GET /api/backup/status
 * Get the last backup execution details and schedule info
 */
router.get('/status', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    let lastJobLog = null;
    try {
      lastJobLog = await JobLog.findOne().sort({ _id: -1 });
    } catch (e) {
      console.error('Error reading JobLog:', e.message);
    }

    const memoryInfo = getLastBackupInfo();

    res.json({
      success: true,
      schedule: process.env.BACKUP_CRON_SCHEDULE || '0 3 1 * *',
      scheduleDescription: 'Monthly on the 1st day of every month at 3:00 AM',
      lastBackup: memoryInfo || {
        lastRunDate: lastJobLog ? lastJobLog.lastRunDate : null,
        success: true,
        note: 'Backup service ready'
      }
    });
  } catch (err) {
    console.error('Error fetching backup status:', err);
    res.status(500).json({ msg: 'Failed to fetch backup status' });
  }
});

/**
 * POST /api/backup/run
 * Manually trigger a database backup with optional password verification
 */
router.post('/run', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { password } = req.body || {};

    // If password is provided, verify it against admin user
    if (password) {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(401).json({ msg: 'User not found' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ msg: 'Invalid password provided' });
      }
    }

    console.log(`👤 Admin ${req.user.fullName || req.user.username} triggered manual backup.`);

    const result = await runDatabaseBackup('manual', req.user);

    res.json({
      success: true,
      msg: 'Database backup completed and uploaded successfully',
      backup: result
    });
  } catch (err) {
    console.error('Manual backup error:', err);
    res.status(500).json({
      success: false,
      msg: err.message || 'Database backup failed'
    });
  }
});

module.exports = router;
