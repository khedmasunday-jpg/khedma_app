// services/schedulerService.js
const cron = require('node-cron');
const moment = require('moment-timezone');
const ScheduledJob = require('../models/ScheduledJob');
const MessageTemplate = require('../models/MessageTemplate');
const RecipientGroup = require('../models/RecipientGroup');
const User = require('../models/User');
const Student = require('../models/Student');
const { queueNotification, hasBeenNotifiedToday } = require('./notificationService');

// Keep track of active running cron tasks so we can clear/reload them dynamically
const runningCronTasks = {};

/**
 * Seed default jobs in the database if they do not exist
 */
async function seedDefaultJobs() {
  try {
    // 1. Seed Message Templates
    let birthdayTemplate = await MessageTemplate.findOne({ name: 'Default Birthday Template' });
    if (!birthdayTemplate) {
      birthdayTemplate = new MessageTemplate({
        name: 'Default Birthday Template',
        description: 'Default greeting message for birthdays',
        type: 'birthday',
        content: '🎉 كل سنة وحضرتك طيب بمناسبة عيد ميلادك! نتمنى لك سنة مباركة وسعيدة. 🎈'
      });
      await birthdayTemplate.save();
      console.log('✅ Seeded Default Birthday Message Template.');
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
      console.log('✅ Seeded Default Friday Follow-up Message Template.');
    }

    // 2. Seed Recipient Groups
    let defaultStaffGroup = await RecipientGroup.findOne({ name: 'All Staff' });
    if (!defaultStaffGroup) {
      defaultStaffGroup = new RecipientGroup({
        name: 'All Staff',
        description: 'All active teachers and co-principals',
        criteria: {
          role: 'teacher' // can be customized/expanded later
        }
      });
      await defaultStaffGroup.save();
      console.log('✅ Seeded Default Recipient Group: All Staff.');
    }

    // 3. Seed Scheduled Jobs
    const birthdayJobCount = await ScheduledJob.countDocuments({ notificationType: 'birthday' });
    if (birthdayJobCount === 0) {
      const birthdayJob = new ScheduledJob({
        name: 'Daily Birthday Greeting',
        description: 'Sends automated birthday greetings at 11:00 AM Egypt Time',
        cronExpression: '0 11 * * *', // 11:00 AM daily
        timezone: 'Africa/Cairo',
        isActive: true,
        notificationType: 'birthday',
        templateId: birthdayTemplate._id,
        recipientGroupId: defaultStaffGroup._id
      });
      await birthdayJob.save();
      console.log('✅ Seeded Daily Birthday Greeting Job in Database.');
    }

    const fridayJobCount = await ScheduledJob.countDocuments({ notificationType: 'weekly_followup' });
    if (fridayJobCount === 0) {
      const fridayJob = new ScheduledJob({
        name: 'Weekly Friday Follow-up (افتقاد)',
        description: 'Sends weekly follow-up / absence check messages on Fridays at 11:00 AM Egypt Time',
        cronExpression: '0 11 * * 5', // 11:00 AM on Fridays (5)
        timezone: 'Africa/Cairo',
        isActive: true,
        notificationType: 'weekly_followup',
        templateId: fridayTemplate._id,
        recipientGroupId: defaultStaffGroup._id
      });
      await fridayJob.save();
      console.log('✅ Seeded Weekly Friday Follow-up Job in Database.');
    }

  } catch (err) {
    console.error('❌ Error seeding default jobs and templates:', err);
  }
}

/**
 * Initialize and load all active scheduled jobs from the database
 */
async function initializeScheduler() {
  await seedDefaultJobs();
  
  if (process.env.PAUSE_SCHEDULER === 'true') {
    console.log('⏸️ [Scheduler] All jobs are paused via environment variable (PAUSE_SCHEDULER=true).');
    // Stop any existing running cron tasks before returning
    for (const jobName of Object.keys(runningCronTasks)) {
      runningCronTasks[jobName].stop();
      delete runningCronTasks[jobName];
    }
    return;
  }
  
  try {
    const activeJobs = await ScheduledJob.find({ isActive: true });
    console.log(`⏰ [Scheduler] Found ${activeJobs.length} active scheduled jobs to register.`);
    
    // Stop any existing running cron tasks before reloading
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

/**
 * Schedule a job in node-cron
 * @param {object} job ScheduledJob Mongoose Document
 */
function scheduleJob(job) {
  const jobName = job.name;
  const cronExpr = job.cronExpression;
  const tz = job.timezone || 'Africa/Cairo';

  console.log(`📅 [Scheduler] Registering job "${jobName}" with cron [${cronExpr}] in timezone [${tz}]`);

  // Schedule using node-cron with timezone option
  const task = cron.schedule(
    cronExpr,
    async () => {
      console.log(`🔔 [Scheduler] Executing scheduled job: "${jobName}"`);
      await runJobHandler(job._id);
    },
    {
      scheduled: true,
      timezone: tz
    }
  );

  runningCronTasks[job.id || job._id.toString()] = task;
}

/**
 * Run a specific job handler by its Database ID
 * @param {string} jobId 
 */
async function runJobHandler(jobId) {
  try {
    const job = await ScheduledJob.findById(jobId).populate('templateId').populate('recipientGroupId');
    if (!job || !job.isActive) {
      console.warn(`[Scheduler] Job ${jobId} not found or inactive. Skipping execution.`);
      return;
    }

    console.log(`⚙️ [Scheduler] Running handler for job: "${job.name}" (${job.notificationType})`);
    
    // Update last run time
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

/**
 * Birthday Job Handler
 */
async function handleBirthdayJob(job) {
  const todayKey = moment().tz(job.timezone || 'Africa/Cairo').format('MM-DD');
  console.log(`[BirthdayHandler] Checking birthdays for Egypt date key: ${todayKey}`);

  const templateContent = job.templateId ? job.templateId.content : '🎉 كل سنة وأنت طيب! 🎈';

  // 1. Process Staff Birthdays
  const staff = await User.find({ isActive: true });
  for (const u of staff) {
    if (u.birthdate) {
      const uBirthday = moment(u.birthdate).format('MM-DD');
      if (uBirthday === todayKey) {
        const phone = u.phonenumber; // virtual getter decrypts
        if (!phone) {
          console.warn(`[BirthdayHandler] Staff member ${u.fullName} has birthday today but no phone number.`);
          continue;
        }

        const alreadySent = await hasBeenNotifiedToday(u._id, phone);
        if (alreadySent) {
          console.log(`[BirthdayHandler] Staff ${u.fullName} already notified for today's birthday. Skipping.`);
          continue;
        }

        // Infrastructure is ready for placeholders (e.g. replacing {name}), but placeholder logic not requested
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

  // 2. Process Student Birthdays
  const students = await Student.find({});
  for (const s of students) {
    if (s.birthdate) {
      const sBirthday = moment(s.birthdate).format('MM-DD');
      if (sBirthday === todayKey) {
        const fatherPhone = s.father_phonenumber; // virtual getter decrypts
        const motherPhone = s.mother_phonenumber; // virtual getter decrypts
        const sName = s.getFullName() || '';
        
        if (!fatherPhone && !motherPhone) {
          console.warn(`[BirthdayHandler] Student ${sName} has birthday today but no parent phone number.`);
          continue;
        }

        const messageText = templateContent.replace(/{name}/g, sName);

        // Queue for father
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
            console.log(`[BirthdayHandler] Student ${sName} father already notified. Skipping.`);
          }
        }

        // Queue for mother
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
            console.log(`[BirthdayHandler] Student ${sName} mother already notified. Skipping.`);
          }
        }
      }
    }
  }
}

/**
 * Friday Follow-up Job Handler
 */
async function handleWeeklyFollowupJob(job) {
  console.log('[WeeklyFollowupHandler] Executing weekly follow-up notification dispatch...');

  const templateContent = job.templateId ? job.templateId.content : '🕊️ سلام ونعمة. نفتقدكم في الخدمة. 📋';
  const group = job.recipientGroupId;
  
  if (!group) {
    console.warn(`[WeeklyFollowupHandler] Job "${job.name}" has no recipient group associated. Skipping.`);
    return;
  }

  // Resolve recipients list
  let recipients = [];

  // 1. Static list
  if (group.recipients && group.recipients.length > 0) {
    recipients = group.recipients.map(r => ({
      id: r.recipientId,
      type: r.recipientType,
      name: r.name,
      phone: r.phoneNumber
    }));
  } 
  // 2. Dynamic criteria
  else if (group.criteria) {
    const { role, classLevel, assignedclass } = group.criteria;
    
    if (role) {
      // Find staff matching criteria
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
      // Find students matching criteria.
      // Load all students and filter in memory using decrypted getters because classname and classLevel are GCM-encrypted in the database
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

  console.log(`[WeeklyFollowupHandler] Dispatching to ${recipients.length} resolved recipients.`);

  for (const recipient of recipients) {
    if (!recipient.phone) continue;

    // Build message (placeholders ready if needed)
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

/**
 * Dynamically trigger a job execution manually
 */
async function runJobManually(jobId) {
  await runJobHandler(jobId);
}

module.exports = {
  initializeScheduler,
  runJobManually
};
