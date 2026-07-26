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

    const job = await ScheduledJob.findOne({ notificationType: 'birthday' });
    if (!job) {
      process.exit(1);
    }
    
    await runJobManually(job._id);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
