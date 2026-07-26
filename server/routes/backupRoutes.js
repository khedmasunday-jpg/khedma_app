const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const JobLog = require('../models/JobLog');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const { runDatabaseBackup, restoreDatabaseBackup, getLastBackupInfo } = require('../utils/backupEngine');

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

router.post('/run', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { password } = req.body || {};

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
      msg: 'Database backup failed'
    });
  }
});

router.post('/restore', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const backupData = req.body;
    if (!backupData || !backupData.collections) {
      return res.status(400).json({ success: false, msg: 'Invalid JSON backup format: missing "collections" object.' });
    }

    const result = await restoreDatabaseBackup(backupData, req.user);

    res.json({
      success: true,
      msg: 'Database restored successfully!',
      details: result
    });
  } catch (err) {
    console.error('Database restore error:', err);
    res.status(500).json({
      success: false,
      msg: 'Database restore failed'
    });
  }
});

module.exports = router;
