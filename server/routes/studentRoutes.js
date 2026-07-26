const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentcontroller');
const { verifyToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const Student = require('../models/Student');
const Class = require('../models/Class');
const Attendance = require('../models/Attendance');
const AvailableIds = require('../models/AvailableIds');
const Log = require('../models/Log');
const Notification = require('../models/Notification');
const NotificationLog = require('../models/NotificationLog');
const TayoLog = require('../models/TayoLog');
const JobLog = require('../models/JobLog');
const User = require('../models/User');
const { authorizeRoles } = require('../middleware/auth');

router.post('/reset-attendance', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {  
  const result = await Student.updateMany({}, { $set: { totalAttendance: 0, lastAbsentDate: null, lastAttendanceDate: null } });
    const modifiedCount = (result && (result.modifiedCount || result.nModified || result.modified)) || 0;

    await Log.create({
      action: 'Reset attendance counters and lastAbsentDate_and_lastAttendanceDate',
      performedBy: req.user.id,
      actorName: req.user.fullName,
      actorRole: req.user.role,
      details: `Reset ${modifiedCount} student counters to 0 and cleared lastAbsentDate and lastAttendanceDate`,
      actionDescription: `${req.user.role} "${req.user.fullName}" reset attendance counters and lastAbsentDate and lastAttendanceDate for students`
    });  res.json({ msg: 'Attendance counters, lastAbsentDate and lastAttendanceDate reset', modifiedCount });
  } catch (err) {
    console.error('Error resetting attendance counters:', err && err.stack ? err.stack : err);
    res.status(500).json({ msg: 'Server error resetting attendance counters' });
  }
});

router.post('/reset-all', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {    
    
    let attDeletedCount = 0;
    try {
      const attResult = await Attendance.deleteMany({});
      attDeletedCount = attResult.deletedCount || 0;
    } catch (e) { console.warn('Attendance delete warning:', e.message); }

    const stuResult = await Student.deleteMany({});

    const classResult = await Class.updateMany({}, { $set: { students: [] } });

    let notifDeletedCount = 0;
    try {
      const n1 = await Notification.deleteMany({});
      const n2 = await NotificationLog.deleteMany({});
      notifDeletedCount = (n1.deletedCount || 0) + (n2.deletedCount || 0);
    } catch (e) { console.warn('Notification delete warning:', e.message); }

    let usersDeletedCount = 0;
    try {
      const uResult = await User.deleteMany({ role: { $ne: 'admin' } });
      usersDeletedCount = uResult.deletedCount || 0;
    } catch (e) { console.warn('Users delete warning:', e.message); }

    let logsDeletedCount = 0;
    try {
      await TayoLog.deleteMany({});
      await JobLog.deleteMany({});
      const lResult = await Log.deleteMany({});
      logsDeletedCount = lResult.deletedCount || 0;
    } catch (e) { console.warn('Logs delete warning:', e.message); }

    try {
      await AvailableIds.deleteMany({});
    } catch (e) { console.warn('AvailableIds reset warning:', e.message); }

    try {
      await Log.create({
        action: 'MASTER_RESET_ALL',
        performedBy: req.user.id,
        actorName: req.user.fullName || req.user.username,
        actorRole: req.user.role,
        details: `Master reset: deleted ${stuResult.deletedCount || 0} students, ${attDeletedCount} attendance records, ${notifDeletedCount} notifications, ${usersDeletedCount} non-admin accounts, and ${logsDeletedCount} logs.`,
        actionDescription: `${req.user.role} "${req.user.fullName || req.user.username}" performed a full database master reset (retained Admin account).`
      });
    } catch (e) {}

    res.json({
      success: true,
      msg: 'Master reset complete: All students, notifications, logs, and non-admin accounts cleared.',
      deletedStudents: stuResult.deletedCount || 0,
      deletedAttendance: attDeletedCount,
      deletedNotifications: notifDeletedCount,
      deletedUsers: usersDeletedCount,
      deletedLogs: logsDeletedCount,
      updatedClasses: classResult.modifiedCount || 0
    });
  } catch (err) {
    console.error('Error performing master reset:', err);
    res.status(500).json({ success: false, msg: 'Server error performing master reset' });
  }
});

router.post('/', verifyToken, [
  body().isArray().withMessage('Expected an array of students for bulk add')
], (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ msg: 'Invalid input', errors: errors.array() });
  return studentController.bulkAddStudents(req, res, next);
});

router.delete('/:id', verifyToken, authorizeRoles('admin', 'principal', 'co-principal'), studentController.deleteStudent);
router.delete('/', verifyToken, authorizeRoles('admin', 'principal', 'co-principal'), studentController.bulkDeleteStudents);

router.post('/add', verifyToken, authorizeRoles('admin', 'principal', 'co-principal'), [ body('student').exists() ], (req, res, next) => {
  const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ msg: 'Invalid input', errors: errors.array() });
  return studentController.addStudent(req, res, next);
});
router.post('/promote', verifyToken, authorizeRoles('admin', 'principal', 'co-principal'), studentController.promoteTeacher);
router.post('/assign', verifyToken, authorizeRoles('admin', 'principal', 'co-principal'), studentController.assignStudents);
router.post('/change-assignment', verifyToken, authorizeRoles('admin', 'principal', 'co-principal'), studentController.changeAssignment);

router.get('/export-graduates', verifyToken, authorizeRoles('admin', 'principal', 'co-principal'), studentController.exportGraduates);
router.delete('/delete-graduates', verifyToken, authorizeRoles('admin', 'principal', 'co-principal'), studentController.deleteGraduates);

router.get('/data', verifyToken, studentController.getStudentData);
router.get('/search', verifyToken, studentController.searchStudents);

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
router.put('/edit', verifyToken, studentController.editStudentData);
router.get('/debug', verifyToken, async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments({});
    const sampleStudents = await Student.find({}).limit(5);
    const classes = await Class.find({});

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
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/search', verifyToken, studentController.searchStudents);
router.put('/edit', verifyToken, studentController.editStudentData);

module.exports = router;