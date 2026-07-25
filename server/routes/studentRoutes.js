const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentcontroller');
const { verifyToken } = require('../middleware/auth');
const verifyDevice = require('../middleware/verifyDevice');
const { body, validationResult } = require('express-validator');
const Student = require('../models/Student');
const Class = require('../models/Class');
const Log = require('../models/Log');
const { authorizeRoles } = require('../middleware/auth');

// Admin-only: reset attendance counters for all students
router.post('/reset-attendance', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    console.log('POST /api/students/reset-attendance called by', req.user && req.user.id);
  // Reset totalAttendance to 0 and clear lastAbsentDate and lastAttendanceDate for all students
  const result = await Student.updateMany({}, { $set: { totalAttendance: 0, lastAbsentDate: null, lastAttendanceDate: null } });
    const modifiedCount = (result && (result.modifiedCount || result.nModified || result.modified)) || 0;

    await Log.create({
      action: 'Reset attendance counters and lastAbsentDate_and_lastAttendanceDate',
      performedBy: req.user.id,
      actorName: req.user.fullName,
      actorRole: req.user.role,
      details: `Reset ${modifiedCount} student counters to 0 and cleared lastAbsentDate and lastAttendanceDate`,
      actionDescription: `${req.user.role} "${req.user.fullName}" reset attendance counters and lastAbsentDate and lastAttendanceDate for students`
    });

    console.log(`Reset attendance completed, modifiedCount=${modifiedCount}`);
  res.json({ msg: 'Attendance counters, lastAbsentDate and lastAttendanceDate reset', modifiedCount });
  } catch (err) {
    console.error('Error resetting attendance counters:', err && err.stack ? err.stack : err);
    res.status(500).json({ msg: 'Server error resetting attendance counters', error: err.message });
  }
});

// Add students (single or bulk)
router.post('/', verifyToken, verifyDevice, [
  body().isArray().withMessage('Expected an array of students for bulk add')
], (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ msg: 'Invalid input', errors: errors.array() });
  return studentController.bulkAddStudents(req, res, next);
});

// Delete student by ID
router.delete('/:id', verifyToken, verifyDevice, studentController.deleteStudent);
router.delete('/', verifyToken, verifyDevice, studentController.bulkDeleteStudents);

// Student management routes
router.post('/add', verifyToken, verifyDevice, [ body('student').exists() ], (req, res, next) => {
  const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ msg: 'Invalid input', errors: errors.array() });
  return studentController.addStudent(req, res, next);
});
router.post('/promote', verifyToken, verifyDevice, studentController.promoteTeacher);
router.post('/assign', verifyToken, verifyDevice, studentController.assignStudents);
router.post('/change-assignment', verifyToken, verifyDevice, studentController.changeAssignment);

// Graduate management routes
router.get('/export-graduates', verifyToken, studentController.exportGraduates);
router.delete('/delete-graduates', verifyToken, studentController.deleteGraduates);

// Data retrieval routes
router.get('/data', verifyToken, studentController.getStudentData);
router.get('/search', verifyToken, studentController.searchStudents);
// Get single student by MongoDB _id for the edit screen
router.get('/edit', verifyToken, async (req, res) => {
  try {
    const id = req.query.id;
    if (!id) return res.status(400).json({ msg: 'Missing id parameter' });
    const doc = await Student.findById(id);
    if (!doc) return res.status(404).json({ msg: 'Student not found' });
    res.json(doc.toJSON());
  } catch (err) {
    console.error('Error fetching student for edit:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});
router.put('/edit', verifyToken, verifyDevice, studentController.editStudentData);
// Debug endpoint for checking database state
router.get('/debug', verifyToken, async (req, res) => {
  try {
    console.log('=== DEBUG: Checking Database State ===');
    
    const totalStudents = await Student.countDocuments({});
    console.log('Total students in database:', totalStudents);

    const sampleStudents = await Student.find({}).limit(5);
    console.log('Sample students:', sampleStudents.map(s => ({
      id: s.id,
      name: typeof s.getFullName === 'function' ? s.getFullName() : (s.fullName || ''),
      class: typeof s.getClassname === 'function' ? s.getClassname() : (s.classname || ''),
      level: typeof s.getClassLevel === 'function' ? s.getClassLevel() : (s.classLevel || '')
    })));

    const classes = await Class.find({});
    console.log('Classes with students:', classes.map(c => ({
      name: c.name,
      studentCount: c.students.length
    })));

    res.json({
      totalStudents,
      sampleStudents: sampleStudents.map(s => ({
        id: s.id,
        name: typeof s.getFullName === 'function' ? s.getFullName() : (s.fullName || ''),
        class: typeof s.getClassname === 'function' ? s.getClassname() : (s.classname || ''),
        level: typeof s.getClassLevel === 'function' ? s.getClassLevel() : (s.classLevel || '')
      })),
      classes: classes.map(c => ({
        name: c.name,
        studentCount: c.students.length
      }))
    });
  } catch (err) {
    console.error('Debug endpoint error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Search and edit routes
router.get('/search', verifyToken, studentController.searchStudents);
router.put('/edit', verifyToken, verifyDevice, studentController.editStudentData);

module.exports = router;