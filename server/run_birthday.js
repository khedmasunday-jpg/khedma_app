require('dotenv').config();
const mongoose = require('mongoose');
const { runBirthdayJob } = require('./jobs/birthdayJob');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Connected to DB. Running birthday job...');
    await runBirthdayJob(true);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
