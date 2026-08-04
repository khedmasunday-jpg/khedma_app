const mongoose = require('mongoose');
const Log = require('./models/Log');
require('dotenv').config({path: './.env'});

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    await Log.create({
      action: 'Test login',
      ip: '192.168.1.99',
      actorName: 'TestUser',
      details: 'Test details'
    });
    const logs = await Log.find({ action: 'Test login' }).sort({timestamp: -1}).limit(1);
    console.log('Test log:');
    for(let l of logs) {
      console.log('Action:', l.action, 'IP:', l.ip, 'ActorName:', l.actorName, 'Details:', l.details);
    }
    process.exit(0);
  });
