const User = require('../models/User');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Log = require('../models/Log');

// -----------------------------------------------------------------
// ALL MANUAL DECRYPTION FUNCTIONS HAVE BEEN REMOVED.
// The Mongoose model will handle this automatically
// by removing `.lean()` from our queries.
// -----------------------------------------------------------------

// Helper function to create enhanced logs
async function createEnhancedLog(action, actor, targetUser = null, additionalDetails = '', ip = '', userAgent = '', deviceId = '') {
  try {
    
    const sanitize = (v) => {
      if (v === undefined || v === null) return '';
      return String(v).replace(/^\s+|\s+$/g, '');
    };

    // If actor is a lightweight object (e.g. req.user with id), fetch full user doc to get fullName/role
    let actorDoc = actor;
    if (actor && !(actor.fullName) && (actor._id || actor.id)) {
      try {
        actorDoc = await User.findById(actor._id || actor.id).select('fullName role username');
      } catch (e) {
        actorDoc = actor;
      }
    }

    const actorName = sanitize(actorDoc && (actorDoc.fullName || actorDoc.username) || 'Unknown');
    const actorRole = sanitize(actorDoc && actorDoc.role || 'Unknown');
    const targetName = sanitize(targetUser && (targetUser.fullName || targetUser.username) || '');
    const targetRole = sanitize(targetUser && targetUser.role || '');

    const logData = {
      action,
      performedBy: actor && actor._id ? actor._id : undefined,
      actorName,
      actorRole,
      actionDescription: `Action: ${sanitize(action)} | By: ${actorName} (${actorRole}) | IP: ${sanitize(ip)}`,
      details: sanitize(additionalDetails) || '',
      ip: sanitize(ip) || '',
      userAgent: sanitize(userAgent) || '',
      deviceId: sanitize(deviceId) || '',
    };

    if (targetUser) {
      logData.targetUser = targetUser._id;
      logData.targetUserName = targetName || 'N/A';
      logData.targetUserRole = targetRole || '';
      logData.actionDescription = `${actorRole} ${actorName} ${sanitize(action)} ${targetRole} ${targetName}`.trim();
    }

    await Log.create(logData);
  } catch (err) {
    console.error('Error creating enhanced log:', err);
  }
}

// helper: generate username
async function generateUniqueUsername(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  let base = parts[0] || 'user';
  base = base.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  for (let i = 0; i < 10; i++) {
    const suffix = Math.floor(Math.random() * 9000 + 1000);
    const candidate = `${base}${suffix}`;
    const exists = await User.findOne({ username: candidate });
    if (!exists) return candidate;
  }
  return `${base}${Date.now().toString().slice(-4)}`;
}

// helper: generate password
function generateRandomPassword(length = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=';
  let out = '';
  for (let i = 0; i < length; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

// Return counts/flags for staff creation UI
exports.getStaffStats = async (req, res) => {
  try {
    if (!['admin', 'principal'].includes(req.user.role)) return res.status(403).json({ msg: 'Access denied' });
    
    const allUsers = await User.find({});
    const pCount = allUsers.filter(u => u.role === 'principal').length;
    const activeCoPrincipals = allUsers.filter(u => u.role === 'co-principal' && u.isActive);
    const coCount = activeCoPrincipals.length;
    const assignedLevels = activeCoPrincipals.map(u => u.assignedlevel).filter(val => val !== undefined && val !== null);

    res.json({ 
      principalCount: pCount, 
      coPrincipalCount: coCount,
      assignedCoPrincipalLevels: assignedLevels
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Get all teachers and co-principals (safe data)
exports.getStaffSafeData = async (req, res) => {
  try {
    if (req.user.role !== 'principal') {
      return res.status(403).json({ msg: 'Unauthorized' });
    }

    const allStaff = await User.find({ isActive: true });
    const safeStaff = allStaff.filter(user => 
      user.role === 'teacher' || user.role === 'co-principal'
    );

    res.json(safeStaff);
  } catch (err) {
    console.error('❌ getStaffSafeData error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Get all teachers and co-principals (full data)
exports.getStaffFullData = async (req, res) => {
  try {
    if (!['admin', 'principal'].includes(req.user.role)) {
      return res.status(403).json({ msg: 'Unauthorized' });
    }

    let query = {};
    if (req.user.role === 'principal') {
      query = { isActive: true };
    }

    const staffDocs = await User.find(query);

    let staff = staffDocs;
    if (req.user.role === 'principal') {
      staff = staffDocs.filter(user => 
        user.role === 'teacher' || user.role === 'co-principal'
      );
    } else {
      staff = staffDocs.filter(user => user.role !== 'admin' || user.username === req.user.username);
    }

    res.json(staff);
  } catch (err) {
    console.error('❌ getStaffFullData error:', err);
    res.status(500).json({ msg: err.message });
  }
};

// Add staff - FIXED VERSION
exports.addStaff = async (req, res) => {
  try {
    const requesterRole = req.user.role;
    const {
      fullName,
      username,
      password,
      role,
      assignedclass,
      assignedlevel,
      phonenumber,
      birthdate,
      address,
      googleCode,
      isActive,
    } = req.body;

    if (!fullName || !role) {
      return res.status(400).json({ msg: 'Missing fields: fullName and role are required' });
    }

    if (requesterRole === 'admin' && role === 'principal') {
      const allUsers = await User.find({}).select('role');
      const pCount = allUsers.filter(u => u.role === 'principal').length;
      if (pCount >= 1) return res.status(400).json({ msg: 'A principal already exists' });
    }

    if (role === 'co-principal') {
      const allUsers = await User.find({}).select('role assignedlevel isActive');
      const coCount = allUsers.filter(u => u.role === 'co-principal' && u.isActive).length;
      if (coCount >= 3) {
        return res.status(400).json({ msg: 'Maximum number of co-principals reached' });
      }
      const existingCo = allUsers.find(u => u.role === 'co-principal' && u.assignedlevel === Number(assignedlevel) && u.isActive);
      if (existingCo) {
        return res.status(400).json({ msg: `A co-principal is already assigned to Year ${assignedlevel}` });
      }
    }

    let finalUsername = username;
    if (!finalUsername) {
      finalUsername = await generateUniqueUsername(fullName);
    }

    let finalPassword = password;
    let generatedPassword = false;
    if (!finalPassword) {
      finalPassword = generateRandomPassword(10);
      generatedPassword = true;
    }

    const newUserData = {
      fullName,
      username: finalUsername,
      password: finalPassword,
      role,
      assignedclass,
      assignedlevel,
      phonenumber,
      birthdate,
      address,
      googleCode,
      isActive: isActive !== undefined ? isActive : true,
      mustResetPassword: generatedPassword || req.body.mustResetPassword,
      isClassLeader: role === 'teacher' ? (req.body.isClassLeader === true || req.body.isClassLeader === 'true') : false,
    };

    const newUser = new User(newUserData);
    await newUser.save();

    if (newUser.role === 'teacher' && newUser.isClassLeader) {
      await User.updateMany(
        { 
          role: 'teacher', 
          assignedclass: newUser.assignedclass, 
          assignedlevel: newUser.assignedlevel, 
          _id: { $ne: newUser._id } 
        }, 
        { isClassLeader: false }
      );
    }

    await createEnhancedLog(
      'Added user',
      req.user,
      newUser,
      `Role: ${newUser.role}, Username: ${newUser.username}`,
      req.ip
    );

    const responsePayload = { 
      msg: 'User created', 
      user: newUser 
    };

    if (generatedPassword) {
      responsePayload.credentials = {
        username: finalUsername,
        password: finalPassword,
      };
    }

    res.status(201).json(responsePayload);
  } catch (err) {
    console.error('❌ addStaff error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const requesterRole = req.user.role;
    const targetId = req.params.id;

    const user = await User.findById(targetId);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (requesterRole === 'principal' && user.role === 'admin') {
      return res.status(403).json({ msg: 'Unauthorized' });
    }

    const allowedFields = [
      'fullName',
      'address',
      'phonenumber',
      'birthdate',
      'assignedclass',
      'assignedlevel',
      'googleCode',
      'isActive',
      'isClassLeader'
    ];

    const updates = {};
    for (const k of allowedFields) {
      if (req.body[k] !== undefined) {
        updates[k] = req.body[k];
      }
    }

    // Use document + .save() instead of findByIdAndUpdate so pre('save') hooks run (encryption/hashing)
    for (const [key, val] of Object.entries(updates)) {
      user[key] = val;
    }

    if (user.role !== 'teacher') {
      user.isClassLeader = false;
    }

    if (user.role === 'teacher' && user.isClassLeader) {
      await User.updateMany(
        { 
          role: 'teacher', 
          assignedclass: user.assignedclass, 
          assignedlevel: user.assignedlevel, 
          _id: { $ne: user._id } 
        }, 
        { isClassLeader: false }
      );
    }

    const updated = await user.save();

    await createEnhancedLog(
      'Updated user',
      req.user,
      updated,
      `Fields: ${Object.keys(updates).join(',')}`,
      req.ip
    );

    res.json({ msg: 'User updated', user: updated });
  } catch (err) {
    console.error('updateUser error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};
