// weeklyCheckupJob.js
const cron = require('node-cron');
const User = require('../models/User');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Notification = require('../models/Notification');

// Every Friday at 10AM
cron.schedule('0 10 * * 5', async () => {
  try {
    // Get all co-principals who assigned students to teachers
    const coPrincipals = await User.find({ role: 'co-principal', isActive: true });

    for (const cp of coPrincipals) {
      // Teachers under their classes
      const teachers = await User.find({ role: 'teacher', assignedlevel: cp.assignedlevel });

      for (const teacher of teachers) {
        const studentIds = teacher.studentsassigned;
        const students = await Student.find({ studentId: { $in: studentIds } });

        let msg = `📋 الرجاء متابعة حالة المخدومين التالية:
`;

        for (const s of students) {
          // Get last Sunday attendance (from current date)
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
      }
    }

    console.log('✅ Weekly checkup notifications sent.');
  } catch (err) {
    console.error('❌ Error sending weekly checkup notifications:', err);
  }
});

