const mongoose = require('mongoose');
const Log = require('./models/Log');
require('dotenv').config({path: './.env'});

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const logs = await Log.find().limit(5).sort({timestamp: -1});
    for(let l of logs) {
      console.log('Action:', l.action, 'IP:', l.ip, 'Actor:', l.actorName);
    }
    process.exit(0);
  });
