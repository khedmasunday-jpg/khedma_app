

const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function run() {  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const result = await Notification.updateMany(
    { type: 'birthday', $or: [ { message_enc: null }, { message_enc: { $exists: false } } ] },
    { $set: { message: '🎉 عيد ميلاد أحد الخدام أو الطلاب النهاردة!' } }
  );  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
