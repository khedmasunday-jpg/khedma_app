// controllers/classController.js
const Class = require('../models/Class');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const express = require('express');
const router = express.Router();
const Log = require('../models/Log');
const { verifyToken, authorizeRoles } = require('../middleware/auth');

// Helper to get student data with attendance by class ID
async function getClassDataWithAttendance(classId) {
  const classObj = await Class.findById(classId).populate('students');
  let students = [];
  if (classObj && Array.isArray(classObj.students) && classObj.students.length) {
    students = classObj.students;
  } else if (classObj && classObj.name) {
    // fallback to classname lookup if students array isn't populated
    students = await Student.find({ classname: classObj.name });
  }

  const results = await Promise.all(students.map(async (student) => {
    const presentCount = await Attendance.countDocuments({ student: student._id, status: 'present' });
    const totalRecords = await Attendance.countDocuments({ student: student._id });
    const lastAbsent = await Attendance.findOne({ student: student._id, status: 'absent' }).sort({ date: -1 });
    const lastPresent = await Attendance.findOne({ student: student._id, status: 'present' }).sort({ date: -1 });
    return {
      _id: student._id,
      id: student.id,
      fullName: student.fullName,
      studentId: student.studentId,
      classLevel: typeof student.getClassLevel === 'function' ? student.getClassLevel() : student.classLevel,
      classname: typeof student.getClassname === 'function' ? student.getClassname() : student.classname,
      address: student.address,
      mother_phonenumber: student.mother_phonenumber,
      father_phonenumber: student.father_phonenumber,
      birthdate: student.birthdate,
      totalAttendance: presentCount,
      totalRecords,
      attendancePercentage: totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0,
      lastAbsentDate: lastAbsent ? lastAbsent.date : null,
      lastAttendanceDate: lastPresent ? lastPresent.date : null,
    };
  }));

  return results;
}

// Get classes available to the user (filtered by role)
// GET / - list classes available to requester (role-filtered)
router.get('/', verifyToken, async (req, res) => {
  try {
    let classes;
    if (req.user.role === 'principal') {
      classes = await Class.find().sort({ level: 1 });
    } else if (req.user.role === 'co-principal') {
      // Co-principal can manage classes in their assigned year
      const year = Math.ceil((req.user.assignedlevel || 1) / 2); // Convert level to year
      classes = await Class.find({ year }).sort({ level: 1 });
    } else if (req.user.role === 'teacher') {
      // If teacher has an assignedclass string, return only that class name; otherwise find by teacher id
      if (req.user.assignedclass) {
        classes = await Class.find({ name: req.user.assignedclass });
      } else {
        classes = await Class.find({ teacher: req.user.id });
      }
    } else {
      return res.status(403).json({ msg: 'Unauthorized' });
    }
    res.json(classes || []);
  } catch (err) {
    console.error('Error listing classes:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get students in a class with detailed attendance stats and percentage
router.get('/:classId/students-detailed', verifyToken, async (req, res) => {
  try {
    const classId = req.params.classId;
    const classObj = await Class.findById(classId).populate('students');
    if (!classObj) return res.status(404).json({ msg: 'Class not found' });

    const students = await getClassDataWithAttendance(classId);

    res.json({
      className: classObj.name,
      classLevel: classObj.level,
      students,
    });
  } catch (err) {
    console.error('Error fetching students-detailed:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// 🧑‍🏫 Teacher: view own class data
router.get('/teacher-class', verifyToken, authorizeRoles('teacher'), async (req, res) => {
  try {
    const teacherClass = await Class.findOne({ teacher: req.user.id });
    if (!teacherClass) return res.status(404).json({ msg: 'لا توجد بيانات لفصلك' });
    const data = await getClassDataWithAttendance(teacherClass._id);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'خطأ في السيرفر' });
  }
});

// 👨‍💼 Co-Principal: view assigned classes data
router.get('/co-classes', verifyToken, authorizeRoles('co-principal'), async (req, res) => {
  try {
    // Co-principal manages classes in their assigned year
    const year = Math.ceil(req.user.assignedlevel / 2);
    const assignedClasses = await Class.find({ year: year }).sort({ level: 1 });
    const result = [];
    for (const classItem of assignedClasses) {
      const data = await getClassDataWithAttendance(classItem._id);
      result.push({ 
        class: classItem.name, 
        level: classItem.level,
        year: classItem.year,
        students: data 
      });
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'خطأ في السيرفر' });
  }
});

// 🧑‍💼 Principal: view all classes
router.get('/all-classes', verifyToken, authorizeRoles('principal'), async (req, res) => {
  try {
    const allClasses = await Class.find();
    const result = [];
    for (const classItem of allClasses) {
      const data = await getClassDataWithAttendance(classItem._id);
      result.push({ class: classItem.name, students: data });
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'خطأ في السيرفر' });
  }
});

// Get teachers under co-principal's authority
router.get('/co-principal/teachers', verifyToken, authorizeRoles('co-principal'), async (req, res) => {
  try {
    // Co-principal manages teachers in their assigned year
    const year = Math.ceil(req.user.assignedlevel / 2);
    const classes = await Class.find({ year: year }).populate('teacher');
    // Get unique teachers
    const teachers = [];
    const teacherIds = new Set();
    for (const cls of classes) {
      if (cls.teacher && !teacherIds.has(cls.teacher._id.toString())) {
        teachers.push({ 
          _id: cls.teacher._id, 
          fullName: cls.teacher.fullName,
          assignedClass: cls.name,
          classLevel: cls.level
        });
        teacherIds.add(cls.teacher._id.toString());
      }
    }
    res.json(teachers);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get students in co-principal's year
router.get('/co-principal/students', verifyToken, authorizeRoles('co-principal'), async (req, res) => {
  try {
    // Co-principal manages students in their assigned year
    const year = Math.ceil(req.user.assignedlevel / 2);
    const yearLevels = year === 1 ? [1, 2] : year === 2 ? [3, 4] : [5, 6];
    const all = await Student.find({});
    const students = all.filter(s => yearLevels.includes(typeof s.getClassLevel === 'function' ? s.getClassLevel() : s.classLevel));
    res.json(students);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
