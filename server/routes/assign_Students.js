
const express = require('express');
const router = express.Router();
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const User = require('../models/User');
const Student = require('../models/Student');

router.post('/assign', verifyToken, authorizeRoles('co-principal'), async (req, res) => {
  const { teacherId, studentIds } = req.body;
  try {
    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({ msg: 'لم يتم العثور على المعلم' });
    }
    teacher.studentsassigned = studentIds;
    await teacher.save();
    res.json({ msg: '✅ تم تعيين المخدومين للمعلم' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'حدث خطأ في الخادم' });
  }
});

router.put('/assign/:teacherId', verifyToken, authorizeRoles('co-principal'), async (req, res) => {
  const { studentIds } = req.body;
  try {
    const teacher = await User.findById(req.params.teacherId);
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({ msg: 'لم يتم العثور على المعلم' });
    }
    teacher.studentsassigned = studentIds;
    await teacher.save();
    res.json({ msg: '✅ تم تحديث قائمة المخدومين' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'خطأ في التحديث' });
  }
});

router.delete('/assign/:teacherId', verifyToken, authorizeRoles('co-principal'), async (req, res) => {
  try {
    const teacher = await User.findById(req.params.teacherId);
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({ msg: 'المعلم غير موجود' });
    }
    teacher.studentsassigned = [];
    await teacher.save();
    res.json({ msg: '✅ تم حذف جميع المخدومين المعينين' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'حدث خطأ أثناء الحذف' });
  }
});

module.exports = router;
