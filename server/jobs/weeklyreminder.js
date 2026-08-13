const moment = require('moment-timezone');
const User = require('../models/User');
const Student = require('../models/Student');
const CronJobRun = require('../models/CronJobRun');
const { queueNotification } = require('../services/notificationService');
const Logger = require('../utils/logger');

const runWeeklyReminderJob = async (isManual = false) => {
  const timezone = 'Africa/Cairo';
  const todayKey = moment().tz(timezone).isoWeek(); 
  const yearKey = moment().tz(timezone).year();
  const executionKey = `attendance:${yearKey}-W${todayKey}`;

  if (!isManual) {
    try {
      await CronJobRun.create({
        jobName: 'attendance',
        executionKey,
        status: 'running'
      });
      Logger.info('JOB_STARTED', { jobName: 'attendance', executionKey });
    } catch (err) {
      if (err.code === 11000) {
        Logger.info('JOB_SKIPPED', { jobName: 'attendance', executionKey, reason: 'Already running or completed' });
        return { msg: 'Job already executed or running this week.' };
      }
      throw err;
    }
  }

  let recordsProcessed = 0;
  try {
    const allUsers = await User.find({ isActive: true, role: 'teacher' });
    const allStudents = await Student.find({});
    const fourteenDaysAgo = moment().subtract(14, 'days');

    for (const teacher of allUsers) {
      if (!teacher.telegramChatId) continue;

      let myStudents = allStudents.filter(s => 
        s.teacher && s.teacher.toString() === teacher._id.toString()
      );

      if (myStudents.length === 0) {
        if (!teacher.assignedlevel || !teacher.assignedclass) continue;
        myStudents = allStudents.filter(s => {
          const sLevel = typeof s.getClassLevel === 'function' ? s.getClassLevel() : s.classLevel;
          const sClassname = typeof s.getClassname === 'function' ? s.getClassname() : s.classname;
          return sLevel === Number(teacher.assignedlevel) && sClassname === teacher.assignedclass;
        });
      }

      if (myStudents.length === 0) continue;

      const absentees = myStudents.filter(s => {
        if (!s.lastAttendanceDate) return true; // never attended
        const lastAttended = moment(s.lastAttendanceDate);
        return lastAttended.isBefore(fourteenDaysAgo);
      });

      if (absentees.length > 0) {
        let messageText = `🕊️ سلام ونعمة ميس/مستر ${teacher.fullName}\n\n`;
        messageText += `نذكرك بافتقاد مخدوميك الذين تغيبوا لأكثر من أسبوعين:\n\n`;
        absentees.forEach(s => {
          const sName = typeof s.getFullName === 'function' ? s.getFullName() : s.fullName;
          messageText += `👤 ${sName || 'بدون اسم'}\n`;
          if (s.father_phonenumber || s.mother_phonenumber) {
            messageText += `📞 أب: ${s.father_phonenumber || '-'}\n📞 أم: ${s.mother_phonenumber || '-'}\n`;
          }
          messageText += `\n`;
        });
        messageText += `ربنا يعوض تعب محبتك 📋`;

        await queueNotification({
          recipient: teacher.telegramChatId,
          message: messageText,
          notificationType: 'weekly_followup',
          recipientId: teacher._id,
          recipientType: 'User'
        });
        recordsProcessed++;
      }
    }

    if (!isManual) {
      await CronJobRun.findOneAndUpdate(
        { executionKey },
        { status: 'completed', completedAt: new Date(), recordsProcessed }
      );
      Logger.info('JOB_COMPLETED', { jobName: 'attendance', executionKey, recordsProcessed });
    }
    return { success: true, recordsProcessed };
  } catch (err) {
    if (!isManual) {
      await CronJobRun.findOneAndUpdate(
        { executionKey },
        { status: 'failed', completedAt: new Date(), error: err.message }
      );
      Logger.error('JOB_FAILED', { jobName: 'attendance', executionKey, error: err.message });
    }
    console.error('❌ Error sending weekly checkup notifications:', err);
    throw err;
  }
};

module.exports = { runWeeklyReminderJob };
