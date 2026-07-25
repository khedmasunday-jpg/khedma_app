require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    // 1. Reset georgehany123
    let george = await User.findOne({ username: 'georgehany123' });
    if (george) {
      george.password = 'password123';
      await george.save();
      console.log('✅ User "georgehany123" password reset to: password123');
    }

    // 2. Create a friendly admin user if it doesn't exist, or reset it
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
      console.log('✅ Created user "admin" with password: password123');
    } else {
      admin.password = 'password123';
      await admin.save();
      console.log('✅ User "admin" password reset to: password123');
    }
    
    mongoose.disconnect();
  })
  .catch(console.error);
