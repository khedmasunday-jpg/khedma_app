const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const mary = await User.findOne({ username: 'MaryGamal77' });
  console.log('Mary:', mary ? mary.toJSON() : null);
  process.exit(0);
});
