const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const users = await User.find({ fullName_enc: { $ne: null } }).select('username fullName_enc');
  console.log(`Found ${users.length} users with fullName_enc`);
  for (let i = 0; i < Math.min(5, users.length); i++) {
    console.log(users[i].username, '->', users[i].fullName);
  }
  process.exit(0);
});
