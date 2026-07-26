require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    
    let george = await User.findOne({ username: 'georgehany123' });
    if (george) {
      george.password = 'password123';
      await george.save();
    }

    let admin = await User.findOne({ username: 'admin' });
    if (!admin) {
      admin = new User({
        username: 'admin',
        password: 'password123',
        role: 'admin',
        isActive: true,
        fullName: 'Easy Admin'
      });
      await admin.save();
    } else {
      admin.password = 'password123';
      await admin.save();
    }
    
    mongoose.disconnect();
  })
  .catch(console.error);
