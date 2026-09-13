const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Student = require('./models/Student');
  const student = await Student.findOne({ classname_enc: { $ne: null } });
  console.log('Student classname decrypted:', student.getClassname());
  process.exit(0);
});
