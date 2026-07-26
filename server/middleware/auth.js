const jwt = require('jsonwebtoken');
const User = require('../models/User');
const BlacklistedToken = require('../models/BlacklistedToken');

async function verifyToken(req, res, next) {
  let token = req.headers['authorization'];  
  if (token && token.startsWith('Bearer ')) {
    token = token.slice(7);
  }
  
  if (!token) {
    console.error('❌ Auth Middleware - No token provided');
    return res.status(403).json({ msg: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const isBlacklisted = await BlacklistedToken.findOne({ token });
    if (isBlacklisted) {
      return res.status(401).json({ msg: 'Token has been revoked. Please log in again.' });
    }
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      console.error('❌ Auth Middleware - User not found for ID:', decoded.id);
      return res.status(401).json({ msg: 'User not found' });
    }

    if (!user.isActive) {
      console.error('❌ Auth Middleware - User account is deactivated');
      return res.status(401).json({ msg: 'Account is deactivated' });
    }

    req.user = {
      id: user._id,
      _id: user._id,
      role: user.role, 
      isActive: user.isActive,
      assignedlevel: user.assignedlevel, 
      assignedclass: user.assignedclass, 
      fullName: user.fullName, 
      username: user.username,
      isClassLeader: user.isClassLeader || false
    };    
    next();
  } catch (err) {
    
    if (err.message === 'Maximum call stack size exceeded') {
        console.error('❌ Auth Middleware - RECURSIVE BUG DETECTED. User.js model is likely buggy.');
        return res.status(500).json({ msg: 'Server error: Recursive loop' });
    }
    
    console.error('❌ Auth Middleware - Token verification failed:', err.message);
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: 'Token expired' });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ msg: 'Invalid token' });
    } else {
      return res.status(401).json({ msg: 'Token verification failed' });
    }
  }
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      console.error('❌ Role Authorization - No user in request');
      return res.status(403).json({ msg: 'User authentication required' });
    }
    
    if (!req.user.role) {
      console.error('❌ Role Authorization - No role found for user:', req.user.id);
      return res.status(403).json({ msg: 'User role not available' });
    }    
    const isClassLeaderBypass = req.user.role === 'teacher' && req.user.isClassLeader && roles.includes('co-principal');
    
    if (!roles.includes(req.user.role) && !isClassLeaderBypass) {
      console.error('❌ Role Authorization - Access denied for role:', req.user.role);
      return res.status(403).json({ msg: 'Access denied' });
    }    next();
  };
}

module.exports = { verifyToken, authorizeRoles };