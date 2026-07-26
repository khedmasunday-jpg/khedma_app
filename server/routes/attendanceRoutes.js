const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

router.post('/reset', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    return await attendanceController.resetClassDate(req, res);
  } catch (err) {
    console.error('Error in attendance reset route:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/:classId', verifyToken, [
  body('students').isArray().withMessage('students array required')
], async (req, res) => {
  const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ msg: 'Invalid input', errors: errors.array() });
  try {
    return await attendanceController.markAttendance(req, res);
  } catch (err) {
    console.error('Error in attendance route:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/', verifyToken, async (req, res) => {
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

router.get('/history', verifyToken, async (req, res) => {
  try {
    return await attendanceController.getHistory(req, res);
  } catch (err) {
    console.error('Error in history:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/today', verifyToken, async (req, res) => {
  try {
    return await attendanceController.getToday(req, res);
  } catch (err) {
    console.error('Error in today:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
