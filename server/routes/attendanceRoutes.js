const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const verifyDevice = require('../middleware/verifyDevice');
const { body, validationResult } = require('express-validator');

// Admin-only: reset attendance records for a specific class and date
// IMPORTANT: define this specific route before the param route so Express doesn't
// mistakenly treat 'reset' as a classId and forward the request to markAttendance.
router.post('/reset', verifyToken, verifyDevice, authorizeRoles('admin'), async (req, res) => {
  try {
    return await attendanceController.resetClassDate(req, res);
  } catch (err) {
    console.error('Error in attendance reset route:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Map controller methods to routes
router.post('/:classId', verifyToken, verifyDevice, [
  body('records').isArray().withMessage('records array required')
], async (req, res) => {
  const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ msg: 'Invalid input', errors: errors.array() });
  try {
    return await attendanceController.markAttendance(req, res);
  } catch (err) {
    console.error('Error in attendance route:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/', verifyToken, verifyDevice, async (req, res) => {
  try {
    return await attendanceController.getAttendance(req, res);
  } catch (err) {
    console.error('Error in get attendance:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/stats', verifyToken, async (req, res) => {
  try {
    return await attendanceController.getStats(req, res);
  } catch (err) {
    console.error('Error in stats:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/history', verifyToken, verifyDevice, async (req, res) => {
  try {
    return await attendanceController.getHistory(req, res);
  } catch (err) {
    console.error('Error in history:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/today', verifyToken, verifyDevice, async (req, res) => {
  try {
    return await attendanceController.getToday(req, res);
  } catch (err) {
    console.error('Error in today:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
