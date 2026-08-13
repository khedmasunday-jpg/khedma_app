const moment = require('moment-timezone');
const User = require('../models/User');
const Student = require('../models/Student');
const CronJobRun = require('../models/CronJobRun');
const MessageTemplate = require('../models/MessageTemplate');
const { queueNotification } = require('../services/notificationService');
const Logger = require('../utils/logger');

const runBirthdayJob = async (isManual = false) => {
  const timezone = 'Africa/Cairo';
  const todayKey = moment().tz(timezone).format('YYYY-MM-DD');
  const executionKey = `birthday:${todayKey}`;

  if (!isManual) {
    try {
      await CronJobRun.create({
        jobName: 'birthday',
        executionKey,
        status: 'running'
      });
      Logger.info('JOB_STARTED', { jobName: 'birthday', executionKey });
    } catch (err) {
      if (err.code === 11000) {
        Logger.info('JOB_SKIPPED', { jobName: 'birthday', executionKey, reason: 'Already running or completed' });
        return { msg: 'Job already executed or running today.' };
      }
      throw err;
    }
  }

  let recordsProcessed = 0;
  try {
    const todayMMDD = moment().tz(timezone).format('MM-DD');
    const allUsers = await User.find({ isActive: true });
    const allStudents = await Student.find({});

    let birthdayTemplate = await MessageTemplate.findOne({ name: 'Default Birthday Template' });
    const templateContent = birthdayTemplate ? birthdayTemplate.content : '🎉 كل سنة وأنت طيب بمناسبة عيد ميلادك! 🎈';

    const staffWithBirthdays = allUsers.filter(u => {
      if ((u.role === 'teacher' || u.role === 'co-principal') && u.birthdate) {
        return moment.utc(u.birthdate).tz(timezone).format('MM-DD') === todayMMDD;
      }
      return false;
    });

    const principals = allUsers.filter(u => u.role === 'principal' || u.role === 'admin');
    if (staffWithBirthdays.length > 0) {
      for (const principal of principals) {
        if (!principal.telegramChatId) continue;
        
        let msg = `ميس ${principal.fullName}\nاليوم يوافق عيد ميلاد هؤلاء الخدام المباركين:\n\n`;
        staffWithBirthdays.forEach(t => {
          msg += `🎁 ${t.fullName} (${t.assignedclass || t.role}) - 📞 ${t.phonenumber || 'لا يوجد'}\n`;
        });
        msg += `\nلا تنسَ تهنئتهم وكل عام وأنتم بخير! 🎂`;

        await queueNotification({
          recipient: principal.telegramChatId,
          message: msg,
          notificationType: 'birthday',
          recipientId: principal._id,
          recipientType: 'User'
        });
        recordsProcessed++;
      }
    }

    const studentsWithBirthdays = allStudents.filter(s => {
      if (s.birthdate) {
        return moment.utc(s.birthdate).tz(timezone).format('MM-DD') === todayMMDD;
      }
      return false;
    });

    if (studentsWithBirthdays.length > 0) {
      const coPrincipals = allUsers.filter(u => u.role === 'co-principal' && u.assignedlevel);
      for (const cp of coPrincipals) {
        if (!cp.telegramChatId) continue;

        const myLevelStudents = studentsWithBirthdays.filter(s => (typeof s.getClassLevel === 'function' ? s.getClassLevel() : s.classLevel) === Number(cp.assignedlevel));
        if (myLevelStudents.length === 0) continue;

        let msg = `ميس ${cp.fullName}\nاليوم يوافق عيد ميلاد هؤلاء المخدومين في مرحلتك (سنة ${cp.assignedlevel}):\n\n`;
        myLevelStudents.forEach(s => {
          msg += `🎈 ${typeof s.getFullName === 'function' ? s.getFullName() : (s.fullName || '')} - فصل ${typeof s.getClassname === 'function' ? s.getClassname() : (s.classname || 'غير محدد')}\n`;
        });
        msg += `\nبرجاء تهنئتهم وكل عام وأنتم بخير! 🎂`;

        await queueNotification({
          recipient: cp.telegramChatId,
          message: msg,
          notificationType: 'birthday',
          recipientId: cp._id,
          recipientType: 'User'
        });
        recordsProcessed++;
      }
    }

    for (const u of staffWithBirthdays) {
      const phone = u.phonenumber;
      if (phone) {
        await queueNotification({
          recipient: phone,
          message: templateContent.replace(/{name}/g, u.fullName || ''),
          notificationType: 'birthday',
          recipientId: u._id,
          recipientType: 'User'
        });
        recordsProcessed++;
      }
    }

    for (const s of studentsWithBirthdays) {
      const sName = (typeof s.getFullName === 'function' ? s.getFullName() : s.fullName) || '';
      const msg = templateContent.replace(/{name}/g, sName);
      if (s.father_phonenumber) {
        await queueNotification({ recipient: s.father_phonenumber, message: msg, notificationType: 'birthday', recipientId: s._id, recipientType: 'Student' });
        recordsProcessed++;
      }
      if (s.mother_phonenumber) {
        await queueNotification({ recipient: s.mother_phonenumber, message: msg, notificationType: 'birthday', recipientId: s._id, recipientType: 'Student' });
        recordsProcessed++;
      }
    }

    if (!isManual) {
      await CronJobRun.findOneAndUpdate(
        { executionKey },
        { status: 'completed', completedAt: new Date(), recordsProcessed }
      );
      Logger.info('JOB_COMPLETED', { jobName: 'birthday', executionKey, recordsProcessed });
    }
    
    return { success: true, recordsProcessed };
  } catch (err) {
    if (!isManual) {
      await CronJobRun.findOneAndUpdate(
        { executionKey },
        { status: 'failed', completedAt: new Date(), error: err.message }
      );
      Logger.error('JOB_FAILED', { jobName: 'birthday', executionKey, error: err.message });
    }
    console.error('[BirthdayJob] Error:', err);
    throw err;
  }
};

module.exports = { runBirthdayJob };
