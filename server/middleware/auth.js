const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function verifyToken(req, res, next) {
  let token = req.headers['authorization'];
  
  console.log('🔐 Auth Middleware - Token verification started');
  
  if (token && token.startsWith('Bearer ')) {
    token = token.slice(7);
  }
  
  if (!token) {
    console.error('❌ Auth Middleware - No token provided');
    return res.status(403).json({ msg: 'No token provided' });
  }
  
  try {
    console.log('🔐 Auth Middleware - Verifying JWT token');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('🔐 Auth Middleware - Token decoded successfully:', { id: decoded.id });
    
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      console.error('❌ Auth Middleware - User not found for ID:', decoded.id);
      return res.status(401).json({ msg: 'User not found' });
    }

    if (!user.isActive) {
      console.error('❌ Auth Middleware - User account is deactivated');
      return res.status(401).json({ msg: 'Account is deactivated' });
    }

    // --- THIS IS THE FIX ---
    // The line below was triggering the bug in the old User.js file.
    // We are commenting it out to prevent the server crash.
    /*
    console.log('🔐 Auth Middleware - User found:', {
      id: user._id,
      username: user.username,
      role: user.role, // Let virtual field handle this
      fullName: user.fullName, // Let virtual field handle this
      isActive: user.isActive
    });
    */
    
    // Attach user data to request
    req.user = {
      id: user._id,
      _id: user._id,
      role: user.role, // Virtual field
      isActive: user.isActive,
      assignedlevel: user.assignedlevel, // Virtual field
      assignedclass: user.assignedclass, // Virtual field
      fullName: user.fullName, // Virtual field
      username: user.username,
      isClassLeader: user.isClassLeader || false
    };

    console.log('✅ Auth Middleware - User attached to request:', {
      id: req.user.id,
      role: req.user.role,
      fullName: req.user.fullName
    });
    
    next();
  } catch (err) {
    // Check for stack overflow
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
    
    console.log('🔐 Role Authorization - Checking roles:', {
      userRole: req.user.role,
      requiredRoles: roles
    });
    
    const isClassLeaderBypass = req.user.role === 'teacher' && req.user.isClassLeader && roles.includes('co-principal');
    
    if (!roles.includes(req.user.role) && !isClassLeaderBypass) {
      console.error('❌ Role Authorization - Access denied for role:', req.user.role);
      return res.status(403).json({ msg: 'Access denied' });
    }
    
    console.log('✅ Role Authorization - Access granted for role:', req.user.role);
    next();
  };
}

// ... (rest of your file is fine) ...

module.exports = { verifyToken, authorizeRoles };