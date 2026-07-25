// scripts/repairBirthdayNotifications.js
// Adds a default message to birthday notifications missing a message

const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const path = require('path');
// Load the project .env (server/.env) explicitly so script works when run from scripts/ folder
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function run() {
  console.log('Using MONGO_URI:', !!process.env.MONGO_URI);
  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const result = await Notification.updateMany(
    { type: 'birthday', $or: [ { message_enc: null }, { message_enc: { $exists: false } } ] },
    { $set: { message: '🎉 عيد ميلاد أحد الخدام أو الطلاب النهاردة!' } }
  );
  console.log(`Updated ${result.modifiedCount ?? result.nModified ?? 0} birthday notifications.`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
