require('dotenv').config();
const mongoose = require('mongoose');
const Log = require('./models/Log');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const logs = await Log.find({ action: /login/i }).sort({ _id: -1 }).limit(10);
    mongoose.disconnect();
  })
  .catch(console.error);
