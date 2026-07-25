require('dotenv').config();
const mongoose = require('mongoose');
const { runJobManually } = require('./services/schedulerService');
const ScheduledJob = require('./models/ScheduledJob');

async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    const job = await ScheduledJob.findOne({ notificationType: 'birthday' });
    if (!job) {
      console.log('Birthday job not found!');
      process.exit(1);
    }
    
    console.log(`Found job: ${job.name} (${job._id})`);
    console.log('Triggering job manually...');
    
    await runJobManually(job._id);
    
    console.log('Job completed. Check server logs to see if notifications were queued.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
