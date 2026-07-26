require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function createAdminUser() {
  try {    await mongoose.connect(process.env.MONGO_URI);

    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {      return;
    }

    const username = process.env.ADMIN_USERNAME;
    const rawPassword = process.env.ADMIN_PASSWORD;
    if (!username || !rawPassword) {
      throw new Error('Missing ADMIN_USERNAME or ADMIN_PASSWORD in server environment (.env)');
    }
    
    const hashedPassword = await bcrypt.hash(rawPassword, 12);
    const adminUser = new User({
      fullName: 'System Administrator',
      username: username,
      password: hashedPassword,
      role: 'admin',
      isActive: true
    });

    await adminUser.save();
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  } finally {
    await mongoose.disconnect();  }
}

createAdminUser();
