const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Log = require('../models/Log');
const Class = require('../models/Class');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const userController = require('../controllers/userController');
const Student = require('../models/Student');

router.get('/', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    
    const users = await User.find().select('-password -fullName_enc -address_enc -googleCode_enc -phonenumber_enc -telegramChatId_enc');

    res.json(users);
  } catch (err) {
    console.error('Error fetching all users:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/', verifyToken, [
  body('fullName').isString().trim().notEmpty(),
  body('username').isString().trim().notEmpty(),
  body('password').isString().notEmpty(),
  body('role').isString().notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ msg: 'Invalid input', errors: errors.array() });
  try {
    const { fullName, username, password, role } = req.body;
    
    if (!fullName || !username || !password || !role) {
      return res.status(400).json({ msg: 'All fields are required' });
    }
    
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ msg: 'Username already exists' });

    const newUser = new User({
      fullName: fullName,
      username: username,
      password: password, 
      role: role,
      isActive: true
    });

    await newUser.save();

    await Log.create({ 
      action: 'Add user', 
      performedBy: req.user.id, 
      targetUser: newUser._id,
      actorName: req.user.fullName,
      actorRole: req.user.role,
      targetUserName: newUser.fullName, 
      targetUserRole: newUser.role,     
      actionDescription: `${req.user.role} "${req.user.fullName}" added ${newUser.role} "${newUser.fullName}"`
    });

    res.status(201).json({ 
      msg: 'User created successfully',
      user: newUser 
    });
  } catch (err) {
    console.error('❌ Error adding user:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.delete('/', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    await User.deleteMany({});
    await Log.create({ 
        action: 'Reset all users', 
        performedBy: req.user.id,
        actorName: req.user.fullName,
        actorRole: req.user.role,
        actionDescription: `${req.user.role} "${req.user.fullName}" reset all users`
    });
    res.json({ msg: 'All users deleted' });
  } catch (err) {
    console.error('Error resetting users:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/staff-safe', verifyToken, userController.getStaffSafeData);
router.get('/staff', verifyToken, authorizeRoles('admin', 'principal'), userController.getStaffFullData);
router.post('/staff', verifyToken, authorizeRoles('admin', 'principal'), userController.addStaff);
router.get('/staff-stats', verifyToken, userController.getStaffStats);

router.get('/me', verifyToken, async (req, res) => {
  try {
    if (!req.user.id || !mongoose.Types.ObjectId.isValid(req.user.id)) {
      return res.status(401).json({ msg: 'Invalid token' });
    }
    
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    res.json(user);
  } catch (err) {
    console.error('❌ /me route error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/logs/all', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const isAll = req.query.limit === 'all';
    const limit = isAll ? 0 : Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
    const cursor = req.query.cursor;

    const query = {};
    if (cursor) {
      const cursorDate = new Date(cursor);
      if (!isNaN(cursorDate.getTime())) {
        query.timestamp = { $lt: cursorDate };
      }
    }

    const total = await Log.countDocuments({});
    const skip = cursor ? 0 : (page - 1) * limit;

    const logs = await Log.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const userCache = new Map();
    const fetchUser = async (id) => {
      if (!id) return null;
      if (userCache.has(id.toString())) return userCache.get(id.toString());
      const user = await User.findById(id).select('fullName fullName_enc role username');
      userCache.set(id.toString(), user);
      return user;
    };

    const populatedLogs = [];
    for (const log of logs) {
      const logObj = log.toJSON();
      const actor = await fetchUser(logObj.performedBy);
      if (actor) {
        logObj.performedBy = actor;
        logObj.performedByName = logObj.performedByName || actor.fullName || actor.username;
        logObj.performedByRole = logObj.performedByRole || actor.role;
      } else {
        logObj.performedBy = logObj.performedBy || null;
        logObj.performedByName = logObj.performedByName || logObj.actorName || 'Unknown';
        logObj.performedByRole = logObj.performedByRole || logObj.actorRole || 'Unknown';
      }

      const target = await fetchUser(logObj.targetUser);
      logObj.targetUser = target ? target : logObj.targetUser ? logObj.targetUser : null;
      logObj.targetUserName = logObj.targetUserName || (target ? (target.fullName || target.username) : null);

      if (logObj.targetClass) {
        try {
          const cls = await Class.findById(logObj.targetClass).select('name');
          if (cls) {
            logObj.targetClassName = logObj.targetClassName || cls.name;
          }
        } catch (e) {}
      }

      populatedLogs.push(logObj);
    }

    const nextCursor = logs.length > 0 ? logs[logs.length - 1].timestamp : null;
    const totalPages = limit > 0 ? Math.ceil(total / limit) : 1;
    const hasMore = limit > 0 ? page < totalPages : false;

    if (req.query.page || req.query.limit || req.query.cursor) {
      res.json({
        logs: populatedLogs,
        total,
        page,
        limit,
        totalPages,
        nextCursor,
        hasMore
      });
    } else {
      res.json(populatedLogs);
    }
  } catch (err) {
    console.error('Error fetching logs:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.delete('/:id', verifyToken, authorizeRoles('admin', 'principal'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const userRole = user.role;
    const userFullName = user.fullName || 'Unknown User';

    if (req.user.role === 'admin') {
      if (userRole === 'admin') {
        return res.status(403).json({ msg: 'Admins cannot delete other admins' });
      }
    } else if (req.user.role === 'principal') {
        if (!['teacher', 'co-principal'].includes(userRole)) {
            return res.status(403).json({ msg: 'Principals can only delete teachers or co-principals' });
        }
    }
    
    await User.findByIdAndDelete(req.params.id);
    
    await Log.create({ 
      action: 'Delete user', 
      performedBy: req.user.id, 
      targetUser: req.params.id,
      actorName: req.user.fullName,
      actorRole: req.user.role,
      targetUserName: userFullName,
      targetUserRole: userRole,
      actionDescription: `${req.user.role} "${req.user.fullName}" deleted ${userRole} "${userFullName}"`
    });
    res.json({ msg: 'User deleted' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.patch('/:id', verifyToken, userController.updateUser);

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (req.user.role === 'principal' && user.role === 'admin') {
      return res.status(403).json({ msg: 'Unauthorized' });
    }

    res.json(user);
  } catch (err) {
    console.error('Error fetching individual user:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.patch('/:id/role', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    
    const allUsers = await User.find().select('role');
    if (role === 'principal') {
      const principalCount = allUsers.filter(u => u.role === 'principal').length;
      if (principalCount >= 1) return res.status(400).json({ msg: 'A principal already exists' });
    }
    if (role === 'co-principal') {
        const coPrincipalCount = allUsers.filter(u => u.role === 'co-principal').length;
        if (coPrincipalCount >= 3) return res.status(400).json({ msg: 'Maximum number of co-principals reached' });
    }
    
    const user = await User.findByIdAndUpdate(req.params.id, { role: role }, { new: true });
    
    await Log.create({ 
      action: 'Change role', 
      performedBy: req.user.id,
      targetUser: req.params.id,
      actorName: req.user.fullName,
      actorRole: req.user.role,
      targetUserName: user.fullName,
      targetUserRole: user.role,
      actionDescription: `${req.user.role} "${req.user.fullName}" changed role of ${user.fullName} to ${role}`
    });
    res.json({ msg: 'Role updated', user });
  } catch (err) {
    console.error('Error changing role:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.patch('/me/update-credentials', verifyToken, async (req, res) => {
  try {
    const { username, password, telegramChatId } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ msg: 'Username is already taken' });
      }
      user.username = username;
    }
    
    if (password) {
      user.password = password; 
    }

    if (telegramChatId !== undefined) {
      user.telegramChatId = telegramChatId;
    }
    
    await user.save();
    
    await Log.create({ 
      action: 'Self update credentials', 
      performedBy: req.user.id,
      targetUser: req.user.id,
      actorName: req.user.fullName,
      actorRole: req.user.role,
      targetUserName: user.fullName,
      targetUserRole: user.role,
      actionDescription: `${req.user.role} "${req.user.fullName}" updated their own login credentials`
    });
    
    res.json({ msg: 'Credentials updated successfully' });
  } catch (err) {
    console.error('Error in self update credentials:', err);
    res.status(500).json({ msg: 'Server error updating credentials' });
  }
});

router.patch('/:id/credentials', verifyToken, authorizeRoles('admin', 'principal'), async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (req.user.role === 'principal' && (user.role === 'admin' || user.role === 'principal')) {      return res.status(403).json({ msg: 'Principals cannot change credentials of admins or principals' });
    }

    if (username) user.username = username;
    if (password) user.password = password; 

    await user.save(); 
    
    await Log.create({ 
      action: 'Update credentials', 
      performedBy: req.user.id,
      targetUser: req.params.id,
      actorName: req.user.fullName,
      actorRole: req.user.role,
      targetUserName: user.fullName,
      targetUserRole: user.role,
      actionDescription: `${req.user.role} "${req.user.fullName}" updated credentials for ${user.fullName}`
    });
    res.json({ msg: 'Credentials updated', user });
  } catch (err) {
    console.error('Error updating credentials:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.patch('/:id/deactivate', verifyToken, authorizeRoles('admin', 'principal'), async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ msg: 'User not found' });

    if (req.user.role === 'principal' && (target.role === 'admin' || target.role === 'principal')) {
       return res.status(403).json({ msg: 'Unauthorized' });
    }
    
    target.isActive = false;
    await target.save();
    
    await Log.create({ 
      action: 'Deactivate user', 
      performedBy: req.user.id,
      targetUser: req.params.id,
      actorName: req.user.fullName,
      actorRole: req.user.role,
      targetUserName: target.fullName,
      targetUserRole: target.role,
      actionDescription: `${req.user.role} "${req.user.fullName}" deactivated ${target.role} "${target.fullName}"`
    });
    res.json({ msg: 'User deactivated', user: target });
  } catch (err) {
    console.error('Error deactivating user:', err);
    res.status(500).json({ msg: 'Server error' }); 
  }
});

router.patch('/:id/activate', verifyToken, authorizeRoles('admin', 'principal'), async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ msg: 'User not found' });

    if (req.user.role === 'principal' && (target.role === 'admin' || target.role === 'principal')) {
        return res.status(403).json({ msg: 'Unauthorized' });
    }
    
    target.isActive = true;
    await target.save();
    
    await Log.create({ 
      action: 'Activate user', 
      performedBy: req.user.id,
      targetUser: req.params.id,
      actorName: req.user.fullName,
      actorRole: req.user.role,
      targetUserName: target.fullName,
      targetUserRole: target.role,
      actionDescription: `${req.user.role} "${req.user.fullName}" activated ${target.role} "${target.fullName}"`
    });
    res.json({ msg: 'User activated', user: target });
  } catch (err) {
    console.error('Error activating user:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;