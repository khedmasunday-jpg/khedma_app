const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Student = require('./models/Student');
  const stu = await Student.collection.findOne({});
  console.log('Raw Student:', stu);
  process.exit(0);
});
