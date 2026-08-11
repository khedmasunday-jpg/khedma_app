const express = require('express');
const router = express.Router();
const ScheduledJob = require('../models/ScheduledJob');
const { runJobManually } = require('../services/schedulerService');

router.get('/run-all', async (req, res) => {
  try {
    const activeJobs = await ScheduledJob.find({ isActive: true });
    
    for (const job of activeJobs) {
      await runJobManually(job._id);
    }
    
    const { processPendingNotifications } = require('../services/notificationService');
    await processPendingNotifications();
    
    res.json({ msg: 'Cron jobs executed successfully', jobsRun: activeJobs.length });
  } catch (err) {
    console.error('Error running cron jobs:', err);
    res.status(500).json({ msg: 'Failed to run cron jobs', error: err.message });
  }
});

module.exports = router;
