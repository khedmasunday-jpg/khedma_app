
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

  const templateContent = job.templateId ? job.templateId.content : '🎉 كل سنة وأنت طيب! 🎈';

  const staff = await User.find({ isActive: true });
  for (const u of staff) {
    if (u.birthdate) {
      const uBirthday = moment(u.birthdate).format('MM-DD');
      if (uBirthday === todayKey) {
        const phone = u.phonenumber; 
        if (!phone) {
          console.warn(`[BirthdayHandler] Staff member (ID: ${u._id}) has birthday today but no phone number.`);
          continue;
        }

        const alreadySent = await hasBeenNotifiedToday(u._id, phone);
        if (alreadySent) {
          continue;
        }

        const messageText = templateContent.replace(/{name}/g, u.fullName || '');

        await queueNotification({
          recipient: phone,
          message: messageText,
          notificationType: 'birthday',
          recipientId: u._id,
          recipientType: 'User',
          jobId: job._id
        });
      }
    }
  }

  const students = await Student.find({});
  for (const s of students) {
    if (s.birthdate) {
      const sBirthday = moment(s.birthdate).format('MM-DD');
      if (sBirthday === todayKey) {
        const fatherPhone = s.father_phonenumber; 
        const motherPhone = s.mother_phonenumber; 
        const sName = s.getFullName() || '';
        
        if (!fatherPhone && !motherPhone) {
          console.warn(`[BirthdayHandler] Student (ID: ${s._id}) has birthday today but no parent phone number.`);
          continue;
        }

        const messageText = templateContent.replace(/{name}/g, sName);

        if (fatherPhone) {
          const alreadySentFather = await hasBeenNotifiedToday(s._id, fatherPhone);
          if (!alreadySentFather) {
            await queueNotification({
              recipient: fatherPhone,
              message: messageText,
              notificationType: 'birthday',
              recipientId: s._id,
              recipientType: 'Student',
              jobId: job._id
            });
          } else {
          }
        }

        if (motherPhone) {
          const alreadySentMother = await hasBeenNotifiedToday(s._id, motherPhone);
          if (!alreadySentMother) {
            await queueNotification({
              recipient: motherPhone,
              message: messageText,
              notificationType: 'birthday',
              recipientId: s._id,
              recipientType: 'Student',
              jobId: job._id
            });
          } else {
          }
        }
      }
    }
  }
}

async function handleWeeklyFollowupJob(job) {

  const templateContent = job.templateId ? job.templateId.content : '🕊️ سلام ونعمة. نفتقدكم في الخدمة. 📋';
  const group = job.recipientGroupId;
  
  if (!group) {
    console.warn(`[WeeklyFollowupHandler] Job "${job.name}" has no recipient group associated. Skipping.`);
    return;
  }

  let recipients = [];

  if (group.recipients && group.recipients.length > 0) {
    recipients = group.recipients.map(r => ({
      id: r.recipientId,
      type: r.recipientType,
      name: r.name,
      phone: r.phoneNumber
    }));
  } 
  
  else if (group.criteria) {
    const { role, classLevel, assignedclass } = group.criteria;
    
    if (role) {
      
      const query = { isActive: true, role };
      if (assignedclass) query.assignedclass = assignedclass;
      if (classLevel) query.assignedlevel = classLevel;

      const matchedUsers = await User.find(query);
      recipients = matchedUsers.map(u => ({
        id: u._id,
        type: 'User',
        name: u.fullName,
        phone: u.phonenumber
      }));
    } else {

      const allStudents = await Student.find({});
      const matchedStudents = allStudents.filter(s => {
        if (classLevel && s.getClassLevel() !== Number(classLevel)) return false;
        if (assignedclass && s.getClassname() !== assignedclass) return false;
        return true;
      });

      for (const s of matchedStudents) {
        const sName = s.getFullName() || '';
        if (s.father_phonenumber) {
          recipients.push({
            id: s._id,
            type: 'Student',
            name: sName,
            phone: s.father_phonenumber
          });
        }
        if (s.mother_phonenumber) {
          recipients.push({
            id: s._id,
            type: 'Student',
            name: sName,
            phone: s.mother_phonenumber
          });
        }
      }
    }
  }

  for (const recipient of recipients) {
    if (!recipient.phone) continue;

    const messageText = templateContent.replace(/{name}/g, recipient.name || '');

    await queueNotification({
      recipient: recipient.phone,
      message: messageText,
      notificationType: 'weekly_followup',
      recipientId: recipient.id,
      recipientType: recipient.type,
      jobId: job._id
    });
  }
}

async function runJobManually(jobId) {
  await runJobHandler(jobId);
}

module.exports = {
  initializeScheduler,
  runJobManually
};
