
const cron = require('node-cron');
const moment = require('moment-timezone');
const ScheduledJob = require('../models/ScheduledJob');
const MessageTemplate = require('../models/MessageTemplate');
const RecipientGroup = require('../models/RecipientGroup');
const User = require('../models/User');
const Student = require('../models/Student');
const { queueNotification, hasBeenNotifiedToday } = require('./notificationService');

const runningCronTasks = {};

async function seedDefaultJobs() {
  try {
    
    let birthdayTemplate = await MessageTemplate.findOne({ name: 'Default Birthday Template' });
    if (!birthdayTemplate) {
      birthdayTemplate = new MessageTemplate({
        name: 'Default Birthday Template',
        description: 'Default greeting message for birthdays',
        type: 'birthday',
        content: '🎉 كل سنة وحضرتك طيب بمناسبة عيد ميلادك! نتمنى لك سنة مباركة وسعيدة. 🎈'
      });
      await birthdayTemplate.save();
    }

    let fridayTemplate = await MessageTemplate.findOne({ name: 'Default Friday Follow-up Template' });
    if (!fridayTemplate) {
      fridayTemplate = new MessageTemplate({
        name: 'Default Friday Follow-up Template',
        description: 'Default follow-up / absence check message for Fridays',
        type: 'weekly_followup',
        content: '🕊️ سلام ونعمة. نفتقدكم في الخدمة ونتمنى الاطمئنان عليكم. نراكم الأحد القادم إن شاء الله. 📋'
      });
      await fridayTemplate.save();
    }

    let defaultStaffGroup = await RecipientGroup.findOne({ name: 'All Staff' });
    if (!defaultStaffGroup) {
      defaultStaffGroup = new RecipientGroup({
        name: 'All Staff',
        description: 'All active teachers and co-principals',
        criteria: {
          role: 'teacher' 
        }
      });
      await defaultStaffGroup.save();
    }

    const birthdayJobCount = await ScheduledJob.countDocuments({ notificationType: 'birthday' });
    if (birthdayJobCount === 0) {
      const birthdayJob = new ScheduledJob({
        name: 'Daily Birthday Greeting',
        description: 'Sends automated birthday greetings at 11:00 AM Egypt Time',
        cronExpression: '0 11 * * *', 
        timezone: 'Africa/Cairo',
        isActive: true,
        notificationType: 'birthday',
        templateId: birthdayTemplate._id,
        recipientGroupId: defaultStaffGroup._id
      });
      await birthdayJob.save();
    }

    const fridayJobCount = await ScheduledJob.countDocuments({ notificationType: 'weekly_followup' });
    if (fridayJobCount === 0) {
      const fridayJob = new ScheduledJob({
        name: 'Weekly Friday Follow-up (افتقاد)',
        description: 'Sends weekly follow-up / absence check messages on Fridays at 11:00 AM Egypt Time',
        cronExpression: '0 11 * * 5', 
        timezone: 'Africa/Cairo',
        isActive: true,
        notificationType: 'weekly_followup',
        templateId: fridayTemplate._id,
        recipientGroupId: defaultStaffGroup._id
      });
      await fridayJob.save();
    }

  } catch (err) {
    console.error('❌ Error seeding default jobs and templates:', err);
  }
}

async function initializeScheduler() {
  await seedDefaultJobs();
  
  if (process.env.PAUSE_SCHEDULER === 'true') {
    
    for (const jobName of Object.keys(runningCronTasks)) {
      runningCronTasks[jobName].stop();
      delete runningCronTasks[jobName];
    }
    return;
  }
  
  try {
    const activeJobs = await ScheduledJob.find({ isActive: true });

    for (const jobName of Object.keys(runningCronTasks)) {
      runningCronTasks[jobName].stop();
      delete runningCronTasks[jobName];
    }
    
    for (const job of activeJobs) {
      scheduleJob(job);
    }
  } catch (err) {
    console.error('❌ [Scheduler] Error loading active scheduled jobs:', err);
  }
}

function scheduleJob(job) {
  const jobName = job.name;
  const cronExpr = job.cronExpression;
  const tz = job.timezone || 'Africa/Cairo';

  const task = cron.schedule(
    cronExpr,
    async () => {
      await runJobHandler(job._id);
    },
    {
      scheduled: true,
      timezone: tz
    }
  );

  runningCronTasks[job.id || job._id.toString()] = task;
}

async function runJobHandler(jobId) {
  try {
    const job = await ScheduledJob.findById(jobId).populate('templateId').populate('recipientGroupId');
    if (!job || !job.isActive) {
      console.warn(`[Scheduler] Job ${jobId} not found or inactive. Skipping execution.`);
      return;
    }

    job.lastRunTime = new Date();
    await job.save();

    if (job.notificationType === 'birthday') {
      await handleBirthdayJob(job);
    } else if (job.notificationType === 'weekly_followup') {
      await handleWeeklyFollowupJob(job);
    } else {
      console.warn(`[Scheduler] Unknown notification type: "${job.notificationType}" for job: "${job.name}"`);
    }

  } catch (err) {
    console.error(`❌ [Scheduler] Error running job handler ${jobId}:`, err);
  }
}

async function handleBirthdayJob(job) {
  const todayKey = moment().tz(job.timezone || 'Africa/Cairo').format('MM-DD');

  const allUsers = await User.find({ isActive: true });
  const allStudents = await Student.find({});

  // 1. Principal: Get sent the birthdays of the teachers and co-principals today
  const staffWithBirthdays = allUsers.filter(u => {
    if ((u.role === 'teacher' || u.role === 'co-principal') && u.birthdate) {
      return moment.utc(u.birthdate).tz(job.timezone || 'Africa/Cairo').format('MM-DD') === todayKey;
    }
    return false;
  });

  if (staffWithBirthdays.length > 0) {
    const principals = allUsers.filter(u => u.role === 'principal' || u.role === 'admin');
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
        recipientType: 'User',
        jobId: job._id
      });
    }
  }

  // 2. Co-Principal: Student birthdays of the same level they are assigned to
  const studentsWithBirthdays = allStudents.filter(s => {
    if (s.birthdate) {
      return moment.utc(s.birthdate).tz(job.timezone || 'Africa/Cairo').format('MM-DD') === todayKey;
    }
    return false;
  });

  if (studentsWithBirthdays.length > 0) {
    const coPrincipals = allUsers.filter(u => u.role === 'co-principal' && u.assignedlevel);
    for (const cp of coPrincipals) {
      if (!cp.telegramChatId) continue;

      const myLevelStudents = studentsWithBirthdays.filter(s => s.getClassLevel() === Number(cp.assignedlevel));
      if (myLevelStudents.length === 0) continue;

      let msg = `ميس ${cp.fullName}\nاليوم يوافق عيد ميلاد هؤلاء المخدومين في مرحلتك (سنة ${cp.assignedlevel}):\n\n`;
      myLevelStudents.forEach(s => {
        msg += `🎈 ${s.getFullName()} - فصل ${s.getClassname() || 'غير محدد'}\n`;
      });
      msg += `\nبرجاء تهنئتهم وكل عام وأنتم بخير! 🎂`;

      await queueNotification({
        recipient: cp.telegramChatId,
        message: msg,
        notificationType: 'birthday',
        recipientId: cp._id,
        recipientType: 'User',
        jobId: job._id
      });
    }
  }

  // Also send the default greeting to the students and teachers directly if templates are active.
  const templateContent = job.templateId ? job.templateId.content : '🎉 كل سنة وأنت طيب! 🎈';
  // (We keep the original direct messages as well just in case)
  for (const u of staffWithBirthdays) {
    const phone = u.phonenumber;
    if (phone && !(await hasBeenNotifiedToday(u._id, phone))) {
      await queueNotification({
        recipient: phone,
        message: templateContent.replace(/{name}/g, u.fullName || ''),
        notificationType: 'birthday',
        recipientId: u._id,
        recipientType: 'User',
        jobId: job._id
      });
    }
  }

  for (const s of studentsWithBirthdays) {
    const sName = s.getFullName() || '';
    const msg = templateContent.replace(/{name}/g, sName);
    if (s.father_phonenumber && !(await hasBeenNotifiedToday(s._id, s.father_phonenumber))) {
      await queueNotification({ recipient: s.father_phonenumber, message: msg, notificationType: 'birthday', recipientId: s._id, recipientType: 'Student', jobId: job._id });
    }
    if (s.mother_phonenumber && !(await hasBeenNotifiedToday(s._id, s.mother_phonenumber))) {
      await queueNotification({ recipient: s.mother_phonenumber, message: msg, notificationType: 'birthday', recipientId: s._id, recipientType: 'Student', jobId: job._id });
    }
  }
}

async function handleWeeklyFollowupJob(job) {
  // Weekly Follow-up logic for teachers
  // Check students assigned to each teacher, if they missed last Sunday and it's been >= 2 weeks, send the teacher a summary.
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
      myStudents = allStudents.filter(s => 
        s.getClassLevel() === Number(teacher.assignedlevel) && 
        s.getClassname() === teacher.assignedclass
      );
    }

    if (myStudents.length === 0) continue;

    const absentees = myStudents.filter(s => {
      if (!s.lastAttendanceDate) return true; // never attended
      const lastAttended = moment(s.lastAttendanceDate);
      return lastAttended.isBefore(fourteenDaysAgo);
    });

    if (absentees.length > 0) {
      let messageText = `🕊️ سلام ونعمة أستاذ(ة) ${teacher.fullName}\n\n`;
      messageText += `نذكرك بافتقاد مخدوميك الذين تغيبوا لأكثر من أسبوعين:\n\n`;
      absentees.forEach(s => {
        messageText += `👤 ${s.getFullName() || 'بدون اسم'}\n`;
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
        recipientType: 'User',
        jobId: job._id
      });
    }
  }
}

async function runJobManually(jobId) {
  await runJobHandler(jobId);
}

module.exports = {
  initializeScheduler,
  runJobManually
};
