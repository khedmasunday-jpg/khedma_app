const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 
const User = require('../models/User');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const Log = require('../models/Log');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const BlacklistedToken = require('../models/BlacklistedToken');

const DUMMY_HASH = '$2a$10$e8N8p2D30.F.g91vU5G1o.5R5wW9oW9oW9oW9oW9oW9oW9oW9oW9o';

async function createEnhancedLog(action, actor, targetUser = null, additionalDetails = '', ip = '', userAgent = '', deviceId = '') {
  try {
    
    const sanitize = (v) => {
      if (v === undefined || v === null) return '';
      return String(v).replace(/^\s+|\s+$/g, '');
    };

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

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5, 
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: 'Too many login attempts. Try again later.' }
});

router.post('/login', loginLimiter, [
  body('username').isString().trim().notEmpty(),
  body('password').isString().notEmpty()
], async (req, res) => { 
  const { username, password } = req.body; 

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(401).json({ msg: 'Invalid credentials' });
  }

  try { 
    const user = await User.findOne({ username }); 
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const deviceId = req.body.deviceId || 'Unknown';

    if (!user) {
      
      await bcrypt.compare(password || '', DUMMY_HASH);
      await createEnhancedLog('Failed login', { fullName: 'Unknown', role: 'unknown', _id: null }, null, `IP: ${req.headers['x-forwarded-for'] || req.ip} | Username attempted: ${username} | Reason: user not found | Device: ${deviceId}`, req.headers['x-forwarded-for'] || req.ip, userAgent, deviceId);
      return res.status(401).json({ msg: 'Invalid credentials' });
    }

    if (!user.isActive) {
      
      await bcrypt.compare(password || '', DUMMY_HASH);
      await createEnhancedLog('Failed login', user, null, `Reason: deactivated | Device: ${deviceId} | User-Agent: ${userAgent}`, req.headers['x-forwarded-for'] || req.ip, userAgent, deviceId);
      return res.status(401).json({ msg: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await createEnhancedLog('Failed login', user, null, `Reason: wrong password | Device: ${deviceId} | User-Agent: ${userAgent}`, req.headers['x-forwarded-for'] || req.ip, userAgent, deviceId);
      return res.status(401).json({ msg: 'Invalid credentials' });
    }

    const tokenPayload = {
      id: user._id,
      role: user.role,
      isActive: user.isActive,
      assignedlevel: user.assignedlevel,
      assignedclass: user.assignedclass,
      isClassLeader: user.isClassLeader || false
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '1h' });

    await createEnhancedLog('User login', user, null, `IP: ${req.headers['x-forwarded-for'] || req.ip} | Device: ${deviceId} | User-Agent: ${userAgent}`, req.headers['x-forwarded-for'] || req.ip, userAgent, deviceId);

    res.json({
      token,
      user: {
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        telegramChatId: user.telegramChatId,
        ISactive: user.isActive,
        assignedlevel: user.assignedlevel,
        assignedclass: user.assignedclass,
        isClassLeader: user.isClassLeader || false
      }
    });
  } catch (error) { 
    console.error('Login error:', error.message); 
    res.status(500).json({ msg: 'Server error', error: error.message, stack: error.stack }); 
  } 
});

router.get('/list-users', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const users = await User.find({}, 'username fullName role');
    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

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

router.post('/logout', verifyToken, async (req, res) => {
  try {
    let token = req.headers['authorization'];
    if (token && token.startsWith('Bearer ')) token = token.slice(7);
    if (!token) return res.status(400).json({ msg: 'No token to invalidate' });

    const decoded = jwt.decode(token);
    const expiresAt = decoded && decoded.exp
      ? new Date(decoded.exp * 1000)
      : new Date(Date.now() + 60 * 60 * 1000); 

    await BlacklistedToken.updateOne(
      { token },
      { token, expiresAt },
      { upsert: true }
    );

    res.json({ msg: 'Logged out successfully. Token revoked.' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
