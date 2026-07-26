const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

function parseArgs() {
  const args = {};
  const raw = process.argv.slice(2);
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = raw[i + 1] && !raw[i + 1].startsWith('--') ? raw[i + 1] : true;
      args[key] = val;
      if (val !== true) i++;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const username = args.username || process.env.ADMIN_USERNAME;
  const password = args.password || process.env.ADMIN_PASSWORD;
  const createIfMissing = args.createIfMissing !== undefined ? args.createIfMissing : (process.env.ADMIN_CREATE_IF_MISSING || 'true');

  if (!username || !password) {
    console.error('Usage: node change-admin-credentials.js --username <newUsername> --password <newPassword> [--createIfMissing true|false] [--assignedlevel 1|2|3]');
    console.error('       Or set ADMIN_USERNAME and ADMIN_PASSWORD (and optional ADMIN_ASSIGNED_LEVEL) in server/.env and run without args.');
    process.exit(1);
  }

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('Error: MONGO_URI not set in environment (.env).');
    process.exit(1);
  }

  try {    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });

    const assignedLevelArg = args.assignedlevel || process.env.ADMIN_ASSIGNED_LEVEL;
    let assignedlevel = undefined;
    if (assignedLevelArg !== undefined) {
      assignedlevel = parseInt(assignedLevelArg, 10);
      if (![1, 2, 3].includes(assignedlevel)) {
        console.error('Invalid assignedlevel. Allowed values: 1, 2, 3');
        process.exit(1);
      }
    }

    let admin = await User.findOne({ role: 'admin' });

    if (!admin) {
      if (createIfMissing === 'false') {
        console.error('No admin user found and --createIfMissing is false. Aborting.');
        process.exit(1);
      }
      
      const conflict = await User.findOne({ username });
      if (conflict) {
        console.error('Username already exists for another user. Choose a different username.');
        process.exit(1);
      }

      admin = new User({
        fullName: 'System Administrator',
        username,
        password,
        role: 'admin',
        isActive: true,
        
        assignedlevel: assignedlevel !== undefined ? assignedlevel : 1
      });

      await admin.save();    } else {
      
      const conflict = await User.findOne({ username });
      if (conflict && conflict._id.toString() !== admin._id.toString()) {
        console.error('Username already taken by another user. Choose a different username.');
        process.exit(1);
      }

      admin.username = username;
      admin.password = password; 
      
      if ((admin.assignedlevel === undefined || admin.assignedlevel === null) && assignedlevel !== undefined) {
        admin.assignedlevel = assignedlevel;
      } else if (admin.assignedlevel === undefined || admin.assignedlevel === null) {
        
        admin.assignedlevel = 1;
        console.warn('Warning: admin had no assignedlevel — defaulting to 1 to satisfy validation.');
      }
      await admin.save();    }  } catch (err) {
    console.error('Error updating admin credentials:', err.message || err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();  }
}

main();
