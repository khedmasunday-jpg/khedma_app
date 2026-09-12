const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const admin = await User.findOne({ username: 'georgehany123' });
  console.log('Admin:', admin ? admin.toJSON() : null);
  process.exit(0);
});
