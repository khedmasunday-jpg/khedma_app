const express = require('express');
const router = express.Router();
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const Student = require('../models/Student');
const TayoLog = require('../models/TayoLog');

router.get('/students', verifyToken, authorizeRoles('admin', 'principal', 'co-principal', 'teacher'), async (req, res) => {
  try {
    const docs = await Student.find({});
    const result = docs.map(doc => {
      const d = doc.toJSON();
      return {
        _id: d._id,
        id: d.id,
        fullName: d.fullName,
        classname: d.classname,
        classLevel: d.classLevel,
        tayoBalance: d.tayoBalance || 0
      };
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

router.post('/transaction', verifyToken, authorizeRoles('admin', 'principal', 'co-principal', 'teacher'), async (req, res) => {
  try {
    const { studentId, amount, reason } = req.body;
    if (!studentId || amount === undefined) {
      return res.status(400).json({ msg: 'Please provide student and amount' });
    }
    
    const parsedAmount = parseInt(amount);
    if (isNaN(parsedAmount) || parsedAmount === 0) {
      return res.status(400).json({ msg: 'Invalid amount' });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ msg: 'Student not found' });
    }

    student.tayoBalance = (student.tayoBalance || 0) + parsedAmount;
    await student.save();

    const log = new TayoLog({
      student: student._id,
      givenBy: req.user.id,
      amount: parsedAmount,
      reason: reason || ''
    });
    await log.save();

    res.json({ msg: 'Transaction successful', balance: student.tayoBalance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

router.get('/logs', verifyToken, authorizeRoles('admin', 'principal', 'co-principal'), async (req, res) => {
  try {
    const logs = await TayoLog.find({})
      .populate('givenBy', 'fullName role')
      .populate('student', 'fullName classname classLevel')
      .sort({ date: -1 })
      .limit(100); // limit to recent 100 for performance
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

router.get('/logs/:id', verifyToken, async (req, res) => {
  try {
    const logs = await TayoLog.find({ student: req.params.id })
      .populate('givenBy', 'name rank')
      .sort({ date: -1 });
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

router.post('/reset', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    await Student.updateMany({}, { $set: { tayoBalance: 0 } });
    const result = await TayoLog.deleteMany({});
    res.json({ msg: 'All Tayo balances and logs have been reset successfully', deletedCount: result.deletedCount });
  } catch (err) {
    console.error('Error resetting Tayo:', err);
    res.status(500).json({ msg: 'Server error while resetting Tayo' });
  }
});

module.exports = router;
