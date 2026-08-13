const jwt = require('jsonwebtoken');
const User = require('../models/User');

const verifyCronAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  // 1. Check for Vercel CRON_SECRET (Automated requests)
  if (process.env.CRON_SECRET) {
    if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
      return next(); // Valid Vercel cron request
    }
  } else {
    console.warn('⚠️ CRON_SECRET is not set in environment variables.');
  }

  // 2. Check for Admin/Principal JWT (Manual triggered requests)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role === 'admin' || decoded.role === 'principal') {
        req.user = decoded; // Attach user for logging if needed
        return next();
      }
    } catch (err) {
      // Token invalid, fall through to 401
    }
  }

  return res.status(401).json({ msg: 'Unauthorized to execute cron jobs.' });
};

module.exports = { verifyCronAuth };
