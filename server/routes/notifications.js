
const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { verifyToken } = require('../middleware/auth');
const verifyDevice = require('../middleware/verifyDevice');

// Mark all notifications as read for the logged-in user
router.patch('/mark-read', verifyToken, verifyDevice, async (req, res) => {
  await Notification.updateMany({ recipient: req.user.id, read: false }, { $set: { read: true } });
  res.json({ msg: 'Notifications marked as read' });
});

// Get all notifications for the logged-in users
router.get('/', verifyToken, async (req, res) => {
  const notifications = await Notification.find({ recipient: req.user.id }).sort({ createdAt: -1 });
  res.json(notifications);
});

// Clear all notifications for the logged-in user
router.delete('/clear', verifyToken, verifyDevice, async (req, res) => {
  await Notification.deleteMany({ recipient: req.user.id });
  res.json({ msg: 'Notifications cleared' });
});

module.exports = router;