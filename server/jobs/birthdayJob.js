

const cron = require('node-cron');
const moment = require('moment');
const User = require('../models/User');
const Student = require('../models/Student');
const Notification = require('../models/Notification');
const { queueNotification } = require('../services/notificationService');

let notifiedToday = new Set();

const runBirthdayJob = async (isManual = false) => {
  try {
    const todayKey = moment.utc().format('MM-DD');
    
    if (moment.utc().format('HH:mm') === '00:00') notifiedToday.clear();

    const staff = await User.find({
      birthdate: { $exists: true }, 
      role: { $in: ['teacher', 'co-principal'] }
    });

    const staffBirthdays = staff.filter(u => moment.utc(u.birthdate).format('MM-DD') === todayKey);

    if (staffBirthdays.length > 0) {
      const names = staffBirthdays.map(u => u.fullName).filter(Boolean).join('، ');
      const principals = await User.find({ role: 'principal' });
      const msg = names
        ? `🎉 النهاردة عيد ميلاد ${names}`
        : '🎉 النهاردة عيد ميلاد أحد الخدام';
      for (const principal of principals) {
        const key = `staff-${principal._id}-${todayKey}`;
        if (!notifiedToday.has(key)) {
          await Notification.create({
            recipient: principal._id,
            type: 'birthday',
            message: msg,
          });
          
          if (principal.phonenumber) {
            await queueNotification({
              recipient: principal.phonenumber,
              message: msg,
              notificationType: 'birthday',
              recipientId: principal._id,
              recipientType: 'User'
            });
          }          notifiedToday.add(key);
        }
      }
    } else {    }

    const coPrincipals = await User.find({ role: 'co-principal' });
    
    const students = await Student.find({});

    for (const cp of coPrincipals) {
      const assignedLevel = cp.assignedlevel;
      const levelBirthdays = students.filter(s => {
        try {
          const b = (typeof s.birthdate !== 'undefined') ? s.birthdate : (typeof s.getBirthdate === 'function' ? s.getBirthdate() : null);
          const lvl = (typeof s.getClassLevel === 'function' ? s.getClassLevel() : s.classLevel);
          if (!b) return false;
          return moment.utc(b).format('MM-DD') === todayKey && lvl === assignedLevel;
        } catch (e) {
          return false;
        }
      });

      if (levelBirthdays.length > 0) {
        const names = levelBirthdays.map(s => (typeof s.getFullName === 'function' ? s.getFullName() : (s.fullName || ''))).filter(Boolean).join(', ');
        const key = `students-${cp._id}-${todayKey}`;
        const msg = names
          ? `🎈 عيد ميلاد ${names} النهاردة!`
          : '🎈 عيد ميلاد أحد الطلاب النهاردة!';
        if (!notifiedToday.has(key)) {
          await Notification.create({
            recipient: cp._id,
            type: 'birthday',
            message: msg,
          });
          
          if (cp.phonenumber) {
            await queueNotification({
              recipient: cp.phonenumber,
              message: msg,
              notificationType: 'birthday',
              recipientId: cp._id,
              recipientType: 'User'
            });
          }          notifiedToday.add(key);
        }
      }
    }  } catch (err) {
    console.error('[BirthdayJob] Error:', err);
  }
};

cron.schedule('0 10 * * *', runBirthdayJob, { timezone: 'Africa/Cairo' });

module.exports = { runBirthdayJob };
