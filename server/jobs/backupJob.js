const { runDatabaseBackup } = require('../utils/backupEngine');
const CronJobRun = require('../models/CronJobRun');
const moment = require('moment-timezone');
const Logger = require('../utils/logger');

const runBackupJob = async (isManual = false) => {
  const executionKey = `backup:${moment().tz('Africa/Cairo').format('YYYY-MM')}`; // Monthly backup key
  
  if (!isManual) {
    try {
      await CronJobRun.create({
        jobName: 'backup',
        executionKey,
        status: 'running'
      });
      Logger.info('JOB_STARTED', { jobName: 'backup', executionKey });
    } catch (err) {
      if (err.code === 11000) {
        Logger.info('JOB_SKIPPED', { jobName: 'backup', executionKey, reason: 'Already running or completed' });
        return { msg: 'Job already executed or running this month.' };
      }
      throw err;
    }
  }

  try {
    const result = await runDatabaseBackup('cron');
    
    if (!isManual) {
      await CronJobRun.findOneAndUpdate(
        { executionKey },
        { status: 'completed', completedAt: new Date(), recordsProcessed: result.documentCount }
      );
      Logger.info('JOB_COMPLETED', { jobName: 'backup', executionKey, recordsProcessed: result.documentCount });
    }
    return result;
  } catch (err) {
    if (!isManual) {
      await CronJobRun.findOneAndUpdate(
        { executionKey },
        { status: 'failed', completedAt: new Date(), error: err.message }
      );
      Logger.error('JOB_FAILED', { jobName: 'backup', executionKey, error: err.message });
    }
    console.error('❌ [BackupJob] Scheduled backup error:', err.message);
    throw err;
  }
};

module.exports = { runBackupJob };