const cron = require('node-cron');
const { runDatabaseBackup } = require('../utils/backupEngine');

// Scheduled backup job: Runs on the 1st day of every month at 3:00 AM (0 3 1 * *)
const backupCronSchedule = process.env.BACKUP_CRON_SCHEDULE || '0 3 1 * *';

console.log(`⏰ [BackupJob] Registering monthly backup cron task with schedule [${backupCronSchedule}]`);

cron.schedule(backupCronSchedule, async () => {
  console.log('🔔 [BackupJob] Scheduled monthly database backup task triggered.');
  try {
    const result = await runDatabaseBackup('cron');
    console.log('✅ [BackupJob] Monthly backup completed successfully:', result.fileName);
  } catch (err) {
    console.error('❌ [BackupJob] Scheduled backup error:', err.message);
  }
});