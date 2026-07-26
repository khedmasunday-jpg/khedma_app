require('dotenv').config();
const mongoose = require('mongoose');
const NotificationLog = require('./models/NotificationLog');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    await NotificationLog.updateMany({ status: 'failed', notificationType: 'birthday' }, { $set: { status: 'pending', retryCount: 0 } });
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
