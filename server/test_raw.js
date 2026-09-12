const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const users = await User.find({ fullName_enc: { $ne: null } }).lean().limit(1);
  console.log(users[0].fullName_enc);
  process.exit(0);
});
