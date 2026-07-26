
const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { verifyToken } = require('../middleware/auth');

router.patch('/mark-read', verifyToken, async (req, res) => {
  await Notification.updateMany({ recipient: req.user.id, read: false }, { $set: { read: true } });
  res.json({ msg: 'Notifications marked as read' });
});

router.get('/', verifyToken, async (req, res) => {
  const notifications = await Notification.find({ recipient: req.user.id }).sort({ createdAt: -1 });
  res.json(notifications);
});

router.delete('/clear', verifyToken, async (req, res) => {
  await Notification.deleteMany({ recipient: req.user.id });
  res.json({ msg: 'Notifications cleared' });
});

module.exports = router;