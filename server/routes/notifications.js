const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { verifyToken, authorizeRoles } = require('../middleware/auth');

router.get('/all', verifyToken, authorizeRoles('admin', 'principal', 'co-principal'), async (req, res) => {
  try {
    const notifications = await Notification.find({})
      .populate('recipient', 'fullName username')
      .sort({ createdAt: -1 })
      .limit(500); // Prevent massive payloads
    res.json(notifications);
  } catch (err) {
    console.error('Failed to fetch all notifications:', err);
    res.status(500).json({ msg: 'Failed to fetch all notifications' });
  }
});

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