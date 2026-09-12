const mongoose = require('mongoose');
const TayoLog = require('./models/TayoLog');
const User = require('./models/User'); // required to register schema
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const log = await TayoLog.findOne().populate('givenBy', 'fullName_enc role username');
  console.log(JSON.stringify(log.toJSON(), null, 2));
  process.exit(0);
});
