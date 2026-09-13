const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Class = require('./models/Class');
  const cls = await Class.collection.findOne({});
  console.log('Raw class:', cls);
  process.exit(0);
});
