const mongoose = require('mongoose');
const TayoLog = require('./models/TayoLog');
const Student = require('./models/Student');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const logs = await TayoLog.find({});
  let deleted = 0;
  for (const log of logs) {
    const student = await Student.findById(log.student);
    if (!student) {
      await TayoLog.findByIdAndDelete(log._id);
      deleted++;
    }
  }
  console.log(`Deleted ${deleted} orphaned Tayo logs.`);
  process.exit(0);
});
