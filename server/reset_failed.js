require('dotenv').config();
const mongoose = require('mongoose');
const NotificationLog = require('./models/NotificationLog');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Connected to DB. Resetting failed notifications to pending...');
    await NotificationLog.updateMany({ status: 'failed', notificationType: 'birthday' }, { $set: { status: 'pending', retryCount: 0 } });
    console.log('Reset complete.');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
