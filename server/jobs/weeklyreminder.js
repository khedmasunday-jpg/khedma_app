const cron = require('node-cron');
const cron = require('node-cron');
const User = require('../models/User');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Notification = require('../models/Notification');
const { queueNotification } = require('../services/notificationService');

const runWeeklyReminderJob = async () => {
  try {
    
    const coPrincipals = await User.find({ role: 'co-principal', isActive: true });

    for (const cp of coPrincipals) {
      
      const teachers = await User.find({ role: 'teacher', assignedlevel: cp.assignedlevel });

      for (const teacher of teachers) {
        const studentIds = teacher.studentsassigned;
        const students = await Student.find({ studentId: { $in: studentIds } });

        let msg = `📋 الرجاء متابعة حالة المخدومين التالية:
`;

        for (const s of students) {
          
          const lastSunday = new Date();
          lastSunday.setDate(lastSunday.getDate() - ((lastSunday.getDay() + 7 - 0) % 7));

          const record = await Attendance.findOne({ studentId: s.studentId, date: { $gte: lastSunday } });

          const status = record && record.status === 'present' ? '✅ حضر' : '❌ غائب';
          msg += `• ${s.fullName} (${status})
`;
        }

        await Notification.create({
          recipient: teacher._id,
          message: msg.trim(),
        });

        if (teacher.phonenumber) {
          await queueNotification({
            recipient: teacher.phonenumber,
            message: msg.trim(),
            notificationType: 'reminder',
            recipientId: teacher._id,
            recipientType: 'User'
          });
        }
      }
    }  } catch (err) {
    console.error('❌ Error sending weekly checkup notifications:', err);
  }
};

cron.schedule('0 14 * * 3', runWeeklyReminderJob, { timezone: 'Africa/Cairo' });

module.exports = { runWeeklyReminderJob };
