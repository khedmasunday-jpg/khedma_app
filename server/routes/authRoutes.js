const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 
const User = require('../models/User');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const Log = require('../models/Log');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

// Helper function to create enhanced logs (accepts optional client metadata)
async function createEnhancedLog(action, actor, targetUser = null, additionalDetails = '', ip = '', userAgent = '', deviceId = '') {
  try {
    // sanitize helper: turn values into plain strings and trim
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

// Use express-rate-limit for login brute-force protection
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: 'Too many login attempts. Try again later.' }
});

// POST /api/auth/login 
// POST /api/auth/login
router.post('/login', /* loginLimiter, */ [
  body('username').isString().trim().notEmpty(),
  body('password').isString().notEmpty()
], async (req, res) => { 
  const { username, password } = req.body; 

  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ msg: 'Invalid input', errors: errors.array() });
  }

  try { 
    const user = await User.findOne({ username }); 
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const deviceId = req.body.deviceId || 'Unknown';
    if (!user) {
      // Log failed login: user not found (do NOT reveal to client)
      await createEnhancedLog('Failed login', { fullName: 'Unknown', role: 'unknown', _id: null }, null, `IP: ${req.headers['x-forwarded-for'] || req.ip} | Username attempted: ${username} | Reason: user not found | Device: ${deviceId}`, req.headers['x-forwarded-for'] || req.ip, userAgent, deviceId);
      // Return a generic invalid credentials message to avoid user enumeration
      return res.status(401).json({ msg: 'Invalid credentials' });
    }

    if (!user.isActive) {
      // Log failed login: deactivated
  await createEnhancedLog('Failed login', user, null, `Reason: deactivated | Device: ${deviceId} | User-Agent: ${userAgent}`, req.headers['x-forwarded-for'] || req.ip, userAgent, deviceId);
      return res.status(403).json({ msg: 'This account is deactivated. Please contact an administrator.' });
    }

    // Compare against password or, if missing, decrypted password_enc (which should contain the bcrypt hash)
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await createEnhancedLog('Failed login', user, null, `Reason: wrong password | Device: ${deviceId} | User-Agent: ${userAgent}`, req.headers['x-forwarded-for'] || req.ip, userAgent, deviceId);
      return res.status(401).json({ msg: 'Invalid credentials' });
    }
    if (!isMatch) {
      // Log failed login: wrong password
  await createEnhancedLog('Failed login', user, null, `Reason: wrong password | Device: ${deviceId} | User-Agent: ${userAgent}`, req.headers['x-forwarded-for'] || req.ip, userAgent, deviceId);
      return res.status(401).json({ msg: 'Invalid credentials' });
    }

    // Include assignedlevel and assignedclass in token so client can
    // inspect the user's scope without an extra API call. Server still
    // relies on fresh DB values via verifyToken for authorization.
    const tokenPayload = {
      id: user._id,
      role: user.role,
      isActive: user.isActive,
      assignedlevel: user.assignedlevel,
      assignedclass: user.assignedclass,
      isClassLeader: user.isClassLeader || false
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Log successful login
    await createEnhancedLog('User login', user, null, `IP: ${req.headers['x-forwarded-for'] || req.ip} | Device: ${deviceId} | User-Agent: ${userAgent}`, req.headers['x-forwarded-for'] || req.ip, userAgent, deviceId);

    // Return token and some user metadata (include assigned fields for convenience)
    res.json({
      token,
      user: {
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        ISactive: user.isActive,
        assignedlevel: user.assignedlevel,
        assignedclass: user.assignedclass,
        isClassLeader: user.isClassLeader || false
      }
    });
  } catch (error) { 
    console.error('Login error:', error.message); 
    res.status(500).json({ msg: 'Server error' }); 
  } 
});
// Restrict listing users to authenticated admins to avoid user enumeration
router.get('/list-users', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const users = await User.find({}, 'username fullName role');
    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// GET /api/auth/me - return the current DB user (for mobile client to verify assigned fields)
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('Error in /auth/me:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
