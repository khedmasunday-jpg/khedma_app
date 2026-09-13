const mongoose = require('mongoose');
const Class = require('./models/Class');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const classes = await Class.find({});
  console.log(JSON.stringify(classes.map(c => c.toJSON()), null, 2));
  process.exit(0);
});
