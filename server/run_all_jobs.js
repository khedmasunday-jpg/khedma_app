require('dotenv').config();
const mongoose = require('mongoose');
const { runBirthdayJob } = require('./jobs/birthdayJob');
const { runWeeklyReminderJob } = require('./jobs/weeklyreminder');
const { runBackupJob } = require('./jobs/backupJob');
const { processPendingNotifications } = require('./services/notificationService');

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Running Birthday Job...');
  await runBirthdayJob(true);
  console.log('Running Weekly Reminder Job...');
  await runWeeklyReminderJob(true);
  console.log('Running Backup Job...');
  await runBackupJob(true);
  console.log('Processing Notifications...');
  await processPendingNotifications();
  console.log('Done!');
  process.exit(0);
}
main();
