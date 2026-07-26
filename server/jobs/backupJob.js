const cron = require('node-cron');
const { runDatabaseBackup } = require('../utils/backupEngine');

const backupCronSchedule = process.env.BACKUP_CRON_SCHEDULE || '0 3 1 * *';

cron.schedule(backupCronSchedule, async () => {
  try {
    const result = await runDatabaseBackup('cron');
  } catch (err) {
    console.error('❌ [BackupJob] Scheduled backup error:', err.message);
  }
});