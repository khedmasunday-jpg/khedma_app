require('dotenv').config();
const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');

async function run() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI not set in .env');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  try {
    const students = await Student.find({}).select('_id');
    console.log(`Found ${students.length} students`);
    let updated = 0;
    for (const s of students) {
      const lastPresent = await Attendance.findOne({ student: s._id, status: 'present' }).sort({ date: -1 }).lean();
      const lastDate = lastPresent ? lastPresent.date : null;
      const res = await Student.updateOne({ _id: s._id }, { $set: { lastAttendanceDate: lastDate } });
      if (res.modifiedCount && res.modifiedCount > 0) updated++;
    }
    console.log(`Migration complete. Updated ${updated} students`);
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
