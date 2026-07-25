const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Log = require('../models/Log');
const Class = require('../models/Class');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const verifyDevice = require('../middleware/verifyDevice');
const { body, validationResult } = require('express-validator');
const userController = require('../controllers/userController');
const Student = require('../models/Student');

// -----------------------------------------------------------------
// ALL MANUAL DECRYPTION FUNCTIONS HAVE BEEN REMOVED.
// The Mongoose model will handle this automatically.
// -----------------------------------------------------------------

// Get all users (admin only) - FIXED
router.get('/', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    // 1. Remove .lean()
    const users = await User.find();
    
    // 2. res.json() handles all decryption and cleanup
    res.json(users);
  } catch (err) {
    console.error('Error fetching all users:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Add user (admin and principal only) - FIXED
router.post('/', verifyToken, verifyDevice, [
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
    
    // 1. Create new user with plain-text
    const newUser = new User({
      fullName: fullName,
      username: username,
      password: password, // pre('save') hook will hash this
      role: role,
      isActive: true
    });
    
    // 2. .save() triggers pre('save') hook, which encrypts
    await newUser.save();
    
    // 3. newUser object has decrypted virtuals
    await Log.create({ 
      action: 'Add user', 
      performedBy: req.user.id, 
      targetUser: newUser._id,
      actorName: req.user.fullName,
      actorRole: req.user.role,
      targetUserName: newUser.fullName, // From virtual
      targetUserRole: newUser.role,     // From virtual
      actionDescription: `${req.user.role} "${req.user.fullName}" added ${newUser.role} "${newUser.fullName}"`
    });
    
    // 4. res.json() sends clean, decrypted data
    res.status(201).json({ 
      msg: 'User created successfully',
      user: newUser 
    });
  } catch (err) {
    console.error('❌ Error adding user:', err);
    res.status(500).json({ msg: 'Server error: ' + err.message });
  }
});

// Reset users (admin only)
router.delete('/', verifyToken, verifyDevice, authorizeRoles('admin'), async (req, res) => {
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

// --- Controller Routes ---
router.get('/staff-safe', verifyToken, userController.getStaffSafeData);
router.get('/staff', verifyToken, authorizeRoles('admin', 'principal'), userController.getStaffFullData);
router.post('/staff', verifyToken, verifyDevice, userController.addStaff);
router.get('/staff-stats', verifyToken, userController.getStaffStats);

// Get current user data - FIXED (and much simpler)
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
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Get logs (admin only) - FIXED
router.get('/logs/all', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const logs = await Log.find().sort({ timestamp: -1 });
    
    const userCache = new Map();
    const fetchUser = async (id) => {
      if (!id) return null;
      if (userCache.has(id.toString())) return userCache.get(id.toString());
      const user = await User.findById(id).select('fullName role username');
      userCache.set(id.toString(), user);
      return user;
    };

    const populatedLogs = [];
    for (const log of logs) {
      // Use the model's toJSON() so virtuals are applied and encrypted fields are hidden
      const logObj = log.toJSON();

      // Try to resolve performedBy to a user object if possible
      const actor = await fetchUser(logObj.performedBy);
      if (actor) {
        // keep performedBy as a user-like object for the client
        logObj.performedBy = actor;
        // prefer explicit performedByName/performedByRole from the log virtuals if present
        logObj.performedByName = logObj.performedByName || actor.fullName || actor.username;
        logObj.performedByRole = logObj.performedByRole || actor.role;
      } else {
        // leave performedBy as-is (could be null) and fallback to actorName
        logObj.performedBy = logObj.performedBy || null;
        logObj.performedByName = logObj.performedByName || logObj.actorName || 'Unknown';
        logObj.performedByRole = logObj.performedByRole || logObj.actorRole || 'Unknown';
      }

      // Resolve target user if present
      const target = await fetchUser(logObj.targetUser);
      logObj.targetUser = target ? target : logObj.targetUser ? logObj.targetUser : null;
      logObj.targetUserName = logObj.targetUserName || (target ? (target.fullName || target.username) : null);

      // If the log references a class, resolve its name
      if (logObj.targetClass) {
        try {
          const cls = await Class.findById(logObj.targetClass).select('name');
          if (cls) {
            logObj.targetClassName = logObj.targetClassName || cls.name;
          }
        } catch (e) {
          // ignore
        }
      }

      populatedLogs.push(logObj);
    }

    res.json(populatedLogs);
  } catch (err) {
    console.error('Error fetching logs:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Delete user (admin only) - FIXED
router.delete('/:id', verifyToken, verifyDevice, authorizeRoles('admin', 'principal'), async (req, res) => {
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

// Update user non-credential fields
router.patch('/:id', verifyToken, verifyDevice, userController.updateUser);

// Get a single user by id - FIXED (and much simpler)
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

// Change user role (admin only) - FIXED
router.patch('/:id/role', verifyToken, verifyDevice, authorizeRoles('admin'), async (req, res) => {
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

// Update self credentials (any logged-in user can update their own credentials)
router.patch('/me/update-credentials', verifyToken, verifyDevice, async (req, res) => {
  try {
    const { username, password } = req.body;
    
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
      user.password = password; // pre('save') will hash this
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

// Update user credentials (admin and principal) - principals are limited
router.patch('/:id/credentials', verifyToken, verifyDevice, authorizeRoles('admin', 'principal'), async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    
    // Principals may not change credentials for admins or other principals
    if (req.user.role === 'principal' && (user.role === 'admin' || user.role === 'principal')) {
      console.log('🔐 Principal attempted to change credentials of protected role:', user.role);
      return res.status(403).json({ msg: 'Principals cannot change credentials of admins or principals' });
    }

    if (username) user.username = username;
    if (password) user.password = password; // pre('save') will hash this

    await user.save(); // Use .save() to trigger password hash
    
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

// Deactivate user (admin only) - FIXED
router.patch('/:id/deactivate', verifyToken, verifyDevice, async (req, res) => {
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
    res.status(500).json({ msg: 'Server error' }); // <--- THIS IS NOW FIXED
  }
});

// Activate user (admin only) - FIXED
router.patch('/:id/activate', verifyToken, verifyDevice, async (req, res) => {
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

// All other routes (debug, etc.) are fine.
module.exports = router;