const express = require('express');
const router = express.Router();
const ScheduledJob = require('../models/ScheduledJob');
const { runJobManually } = require('../services/schedulerService');
const { runBirthdayJob } = require('../jobs/birthdayJob');
const { runWeeklyReminderJob } = require('../jobs/weeklyreminder');
const { runBackupJob } = require('../jobs/backupJob');

router.get('/run-all', async (req, res) => {
  try {
    const activeJobs = await ScheduledJob.find({ isActive: true });
    
    for (const job of activeJobs) {
      await runJobManually(job._id);
    }
    
    // Run the manual scripts on Vercel
    if (new Date().getDay() === 3) { // Run weekly reminder on Wednesdays
       await runWeeklyReminderJob();
    }
    await runBirthdayJob(true); // Run birthday job daily
    await runBackupJob(); // Run backup job

    const { processPendingNotifications } = require('../services/notificationService');
    await processPendingNotifications();
    
    res.json({ msg: 'Cron jobs executed successfully', jobsRun: activeJobs.length });
  } catch (err) {
    console.error('Error running cron jobs:', err);
    res.status(500).json({ msg: 'Failed to run cron jobs', error: err.message });
  }
});

module.exports = router;
