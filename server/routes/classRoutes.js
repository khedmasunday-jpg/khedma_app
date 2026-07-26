const express = require('express');
const router = express.Router();
const Class = require('../models/Class');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { verifyToken, authorizeRoles } = require('../middleware/auth');

router.get('/', verifyToken, async (req, res) => {
  try {    let classes;

    if (req.user.role === 'principal' || req.user.role === 'admin') {
      const all = await Class.find();
      classes = all.sort((a, b) => (a.level || 0) - (b.level || 0));
    } else if (req.user.role === 'co-principal') {

      let year;
      if (req.user.assignedlevel && [1, 2, 3].includes(req.user.assignedlevel)) {
        year = req.user.assignedlevel;
      } else {
        year = Math.ceil((req.user.assignedlevel || 1) / 2);
      }
      const all = await Class.find();
      classes = all.filter(c => c.year === year).sort((a, b) => (a.level || 0) - (b.level || 0));
    } else if (req.user.role === 'teacher') {

        if (req.user.assignedclass) {
          const all = await Class.find();
          const cleanUserClass = (req.user.assignedclass || '').replace(/^فصل\s+/, '').trim();
          classes = all.filter(c => (c.name || '').replace(/^فصل\s+/, '').trim() === cleanUserClass);
        
        if (classes.length === 0) {
          classes = await Class.find({ teacher: req.user._id });
        }
      } else {
        classes = await Class.find({ teacher: req.user._id });
      }
    } else {
      return res.status(403).json({ msg: 'Unauthorized' });
    }    res.json(classes);
  } catch (err) {
    console.error('Error fetching classes:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/co-principal/teachers', verifyToken, authorizeRoles('co-principal'), async (req, res) => {
  try {
    const User = require('../models/User');    

    let targetLevels;
    if (req.user.assignedlevel === 1) targetLevels = [1, 2];
    else if (req.user.assignedlevel === 2) targetLevels = [3, 4];
    else if (req.user.assignedlevel === 3) targetLevels = [5, 6];
    else {
      const year = Math.ceil((req.user.assignedlevel || 1) / 2);
      targetLevels = year === 1 ? [1, 2] : year === 2 ? [3, 4] : [5, 6];
    }

    const allTeachers = await User.find({ 
      role: 'teacher', 
      isActive: true 
    }).select('_id fullName assignedclass');    
    
    const allClasses = await Class.find().populate({
      path: 'teacher',
      select: 'fullName _id role assignedclass'
    });
    const yearClasses = allClasses.filter(c => targetLevels.includes(c.level));    
    
    const teachers = [];
    const seen = new Set();

    for (const cls of yearClasses) {
      if (cls.teacher && !seen.has(cls.teacher._id.toString())) {
        teachers.push({
          _id: cls.teacher._id,
          fullName: cls.teacher.fullName,
          assignedClass: cls.name,
          classLevel: cls.level
        });
        seen.add(cls.teacher._id.toString());
      }
    }

    for (const teacher of allTeachers) {
      if (!seen.has(teacher._id.toString()) && teacher.assignedclass) {
        const cleanTeacherClass = (teacher.assignedclass || '').replace(/^فصل\s+/, '').trim();
        const matchingClass = yearClasses.find(c => (c.name || '').replace(/^فصل\s+/, '').trim() === cleanTeacherClass);
        if (matchingClass) {
          teachers.push({
            _id: teacher._id,
            fullName: teacher.fullName,
            assignedClass: teacher.assignedclass,
            classLevel: matchingClass.level
          });
          seen.add(teacher._id.toString());
        }
      }
    }

    const teacherIds = teachers.map(t => t._id);
    if (teacherIds.length) {
      
      const users = await User.find({ _id: { $in: teacherIds } }).select('fullName fullName_enc username');
      const { decrypt } = require('../utils/crypto');
      const nameMap = new Map();
      users.forEach(u => {
        let name = '';
        try {
          if (u.fullName && String(u.fullName).trim().length) name = u.fullName;
          
          else if (u.fullName_enc && u.fullName_enc.data) {
            const dec = decrypt(u.fullName_enc);
            if (dec && String(dec).trim().length) name = dec;
          }
        } catch (e) {
          
        }
        if (!name || !String(name).trim()) name = u.username || '';
        nameMap.set(u._id.toString(), name);
      });
      teachers.forEach(t => {
        const n = nameMap.get(t._id.toString());
        if (n) t.fullName = n;
      });
    }    
    res.json(teachers);
  } catch (err) {
    console.error('Error fetching teachers for co-principal:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/co-principal/students', verifyToken, authorizeRoles('co-principal'), async (req, res) => {
  try {    
    
    let targetLevels;
    if (req.user.assignedlevel === 1) targetLevels = [1, 2];
    else if (req.user.assignedlevel === 2) targetLevels = [3, 4];
    else if (req.user.assignedlevel === 3) targetLevels = [5, 6];
    else {
      const year = Math.ceil((req.user.assignedlevel || 1) / 2);
      targetLevels = year === 1 ? [1, 2] : year === 2 ? [3, 4] : [5, 6];
    }

    const rawUnassigned = await Student.find({ $or: [{ class: { $exists: false } }, { class: null }] });
    const students = rawUnassigned.filter(s => {
      const level = typeof s.getClassLevel === 'function' ? s.getClassLevel() : s.classLevel;
      return level && targetLevels.includes(level);
    });    res.json(students);
  } catch (err) {
    console.error('Error fetching available students:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/teacher/:teacherId/students', verifyToken, authorizeRoles('co-principal'), async (req, res) => {
  try {
    
    const classes = await Class.find({ teacher: req.params.teacherId });
    if (!classes.length) {      return res.json([]);
    }

    const students = await Student.find({ class: { $in: classes.map(c => c._id) } });    res.json(students);
  } catch (err) {
    console.error('Error fetching teacher students:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/teacher/:teacherId/available', verifyToken, authorizeRoles('co-principal','teacher'), async (req, res) => {
  try {
    const teacherId = req.params.teacherId;

    if (req.user.role === 'teacher' && String(req.user._id) !== String(teacherId)) {
      return res.status(403).json({ msg: 'Forbidden' });
    }

    let teacherClasses = await Class.find({ teacher: teacherId });

    if (!teacherClasses.length) {
      try {
        const teacherUser = await User.findById(teacherId).select('assignedclass fullName');
        if (teacherUser && teacherUser.assignedclass) {
          const all = await Class.find();
          const cleanTeacherClass = (teacherUser.assignedclass || '').replace(/^فصل\s+/, '').trim();
          teacherClasses = all.filter(c => (c.name || '').replace(/^فصل\s+/, '').trim() === cleanTeacherClass);
        }
      } catch (e) {
        console.error('Fallback lookup error:', e && e.message);
      }
    }

    if (!teacherClasses.length) {
      
      return res.json({ assigned: [], available: [] });
    }

    const classIds = teacherClasses.map(c => c._id);

    const assigned = await Student.find({ teacher: teacherId });

    const targetLevels = [...new Set(teacherClasses.map(c => c.level).filter(Boolean))];

    const rawUnassigned = await Student.find({ $or: [{ teacher: { $exists: false } }, { teacher: null }] });
    
    const targetNames = teacherClasses.map(c => c.name).filter(Boolean);
    let available = rawUnassigned.filter(s => {
      const level = typeof s.getClassLevel === 'function' ? s.getClassLevel() : s.classLevel;
      const name = typeof s.getClassname === 'function' ? s.getClassname() : s.classname;
      return (level && targetLevels.includes(level)) || (name && targetNames.includes(name));
    });

    res.json({ assigned, available });
  } catch (err) {
    console.error('Error fetching available students for teacher:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/:classId/students', verifyToken, async (req, res) => {
  try {
    
    const classObj = await Class.findById(req.params.classId);
    if (!classObj) {      return res.status(404).json({ msg: 'Class not found' });
    }

    const allStudents = await Student.find({});
    const students = allStudents.filter(s => (typeof s.getClassname === 'function' ? s.getClassname() : s.classname) === classObj.name);
    
    const studentsWithDetails = await Promise.all(students.map(async (student) => {
      const attendance = await Attendance.find({ student: student._id })
        .sort({ date: -1 })
        .limit(10); 

      const s = student.toJSON();

      const totalRecords = attendance.length;
      const presentCount = attendance.filter(a => {
        const status = (typeof a.status === 'function') ? a.status() : a.status; 
        return (status === 'present' || status === true || status === '1');
      }).length;
      const attendancePercentage = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

        return {
        _id: student._id,
        id: s.id,
        fullName: s.fullName,
        classLevel: s.classLevel,
        classname: s.classname,
        studentId: s.studentId,
        address: s.address,
        mother_phonenumber: s.mother_phonenumber,
        father_phonenumber: s.father_phonenumber,
        birthdate: s.birthdate,
        totalAttendance: s.totalAttendance,
          lastAbsentDate: s.lastAbsentDate,
          
          lastAttendanceDate: s.lastAttendanceDate,
        attendance,
        totalRecords,
        attendancePercentage
      };
    }));      res.json({
        className: classObj.name,
        classLevel: classObj.level,
        students: studentsWithDetails
      });
  } catch (err) {
    console.error('Error fetching class students:', err);
    res.status(500).json({ 
      msg: 'Error fetching students',
      msg: 'Server error'
    });
  }
});

router.post('/co-principal/assign', verifyToken, authorizeRoles('co-principal'), async (req, res) => {
  try {
    const { teacherId, studentIds } = req.body;    const Notification = require('../models/Notification');
    const Log = require('../models/Log');

    const teacher = await User.findById(teacherId).select('fullName assignedclass');
    if (!teacher) {
      return res.status(400).json({ msg: 'Teacher not found' });
    }

    let teacherClasses = await Class.find({ teacher: teacherId });    if (!teacherClasses.length && teacher.assignedclass) {
      
      const all = await Class.find();
      teacherClasses = all.filter(c => c.name === teacher.assignedclass);    }

    if (!teacherClasses.length) {
      return res.status(400).json({ msg: 'Teacher has no assigned classes' });
    }

    let studentsToAssign = await Student.find({ _id: { $in: studentIds } }).select('fullName _id');

    if (studentsToAssign.length === 0) {
      const fallback = await Student.find({ studentId: { $in: studentIds } }).select('fullName _id studentId');
      if (fallback.length) {        
        studentIds = fallback.map(f => f._id);
        studentsToAssign = fallback;
      }
    }

    if (studentsToAssign.length === 0) {
      return res.status(400).json({ msg: 'No valid students to assign' });
    }

    await Student.updateMany(
      { _id: { $in: studentIds } },
      { 
        $set: { 
          class: teacherClasses[0]._id,
          teacher: teacherId,
          classLevel: teacherClasses[0].level,
          classname: teacherClasses[0].name
        } 
      }
    );

    const studentNames = studentsToAssign.map(s => s.fullName).join(', ');
    const notificationMessage = `You have been assigned ${studentsToAssign.length} new student${studentsToAssign.length > 1 ? 's' : ''}: ${studentNames}`;
    
    await Notification.create({
      recipient: teacherId,
      type: 'other',
      message: notificationMessage
    });

    const logEntry = {
      action: 'ASSIGN_STUDENTS',
      actor: teacherId,  
      performedBy: req.user._id,  
      timestamp: new Date(),
      details: `Co-principal assigned ${studentsToAssign.length} student(s) to ${teacher.fullName} in class ${teacherClasses[0].name}. Students: ${studentNames}`,
      ip: req.ip || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
      actorName: teacher.fullName,
      actorRole: 'teacher',
      targetUserName: req.user.fullName
    };

    await Log.create(logEntry);

    res.json({ 
      msg: 'Students assigned successfully',
      count: studentsToAssign.length
    });
  } catch (err) {
    console.error('Error assigning students:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/co-principal/remove-students', verifyToken, authorizeRoles('co-principal'), async (req, res) => {
  try {
    const { teacherId, allClasses, studentIds } = req.body;
    const Notification = require('../models/Notification');
    const Log = require('../models/Log');
    
    const teacher = await User.findById(teacherId).select('fullName assignedclass');
    if (!teacher) {
      return res.status(400).json({ msg: 'Teacher not found' });
    }

    let teacherClasses = await Class.find({ teacher: teacherId });

    if (!teacherClasses.length && teacher.assignedclass) {
      const all = await Class.find();
      teacherClasses = all.filter(c => c.name === teacher.assignedclass);    }
    
    if (!teacherClasses.length) {
      return res.status(400).json({ msg: 'Teacher has no assigned classes' });
    }
    
    let affectedStudents = [];
    if (Array.isArray(studentIds) && studentIds.length) {
      
      let students = await Student.find({ _id: { $in: studentIds }, teacher: teacherId }).select('fullName _id');

      if (students.length === 0) {
        const classIds = teacherClasses.map(c => c._id);
        students = await Student.find({ _id: { $in: studentIds }, class: { $in: classIds } }).select('fullName _id');
      }
      
      if (students.length === 0) {
        return res.status(400).json({ msg: 'No matching students found for removal' });
      }
      affectedStudents = students;

      await Student.updateMany(
        { _id: { $in: students.map(s => s._id) } },
        { $set: { teacher: null, class: null } }
      );
    } else if (allClasses) {
      const year = teacherClasses[0].year;
      const yearClasses = await Class.find({ year });
      
      affectedStudents = await Student.find({ teacher: teacherId }).select('fullName _id');

      if (affectedStudents.length === 0) {
        const classIds = yearClasses.map(c => c._id);
        affectedStudents = await Student.find({ class: { $in: classIds } }).select('fullName _id');      }

      if (affectedStudents.length > 0) {

        await Student.updateMany(
          { teacher: teacherId },
          { $set: { teacher: null, class: null } }
        );
        const classIds = yearClasses.map(c => c._id);
        await Student.updateMany(
          { class: { $in: classIds } },
          { $set: { teacher: null, class: null } }
        );
      }
    } else {
      
      affectedStudents = await Student.find({ teacher: teacherId }).select('fullName _id');

      if (affectedStudents.length === 0) {
        const classIds = teacherClasses.map(c => c._id);
        affectedStudents = await Student.find({ class: { $in: classIds } }).select('fullName _id');      }

      if (affectedStudents.length > 0) {

        await Student.updateMany(
          { teacher: teacherId },
          { $set: { teacher: null, class: null } }
        );
        const classIds = teacherClasses.map(c => c._id);
        await Student.updateMany(
          { class: { $in: classIds } },
          { $set: { teacher: null, class: null } }
        );
      }
    }

    if (affectedStudents.length > 0) {
      
      const studentNames = affectedStudents.map(s => s.fullName).join(', ');
      const notificationMessage = `${affectedStudents.length} student${affectedStudents.length > 1 ? 's have' : ' has'} been removed from your class${allClasses ? 'es' : ''}: ${studentNames}`;
      
      await Notification.create({
        recipient: teacherId,
        type: 'other',
        message: notificationMessage
      });

      const logEntry = {
        action: 'REMOVE_STUDENTS',
        actor: teacherId,
        performedBy: req.user._id,
        timestamp: new Date(),
        details: `Co-principal removed ${affectedStudents.length} student(s) from ${allClasses ? 'all classes' : 'teacher\'s class'}. Students: ${studentNames}`,
        ip: req.ip || 'unknown',
        userAgent: req.get('user-agent') || 'unknown',
        actorName: teacher.fullName,
        actorRole: 'teacher',
        targetUserName: req.user.fullName
      };

      await Log.create(logEntry);
    }
    
    res.json({ 
      msg: 'Students removed successfully',
      count: affectedStudents.length
    });
  } catch (err) {
    console.error('Error removing students:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/co-principal/reset-class', verifyToken, authorizeRoles('co-principal'), async (req, res) => {
  try {
    const { teacherId } = req.body;
    const Notification = require('../models/Notification');
    const Log = require('../models/Log');

    const teacher = await User.findById(teacherId).select('fullName');
    if (!teacher) return res.status(400).json({ msg: 'Teacher not found' });

    const teacherClasses = await Class.find({ teacher: teacherId });
    if (!teacherClasses.length) return res.status(400).json({ msg: 'Teacher has no assigned classes' });

    const classIds = teacherClasses.map(c => c._id);
    const affectedStudents = await Student.find({ class: { $in: classIds } }).select('fullName _id');

    if (affectedStudents.length === 0) return res.json({ msg: 'No students to reset', count: 0 });

    await Student.updateMany({ class: { $in: classIds } }, { $set: { class: null, classname: null } });

    const studentNames = affectedStudents.map(s => s.fullName).join(', ');
    await Notification.create({ recipient: teacherId, type: 'other', message: `Your students have been reset by co-principal: ${studentNames}` });

    await Log.create({
      action: 'RESET_CLASS',
      actor: teacherId,
      performedBy: req.user._id,
      timestamp: new Date(),
      details: `Co-principal reset ${affectedStudents.length} students from ${teacher.fullName}'s classes. Students: ${studentNames}`,
      ip: req.ip || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
      actorName: teacher.fullName,
      actorRole: 'teacher',
      targetUserName: req.user.fullName
    });

    res.json({ msg: 'Class reset complete', count: affectedStudents.length });
  } catch (err) {
    console.error('Error resetting class:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/co-principal/reset-class-group', verifyToken, authorizeRoles('co-principal'), async (req, res) => {
  try {
    const { teacherId } = req.body;
    const Notification = require('../models/Notification');
    const Log = require('../models/Log');
    const teacher = await User.findById(teacherId).select('fullName assignedclass');
    if (!teacher) {      return res.status(400).json({ msg: 'Teacher not found' });
    }
    let targetClasses = [];

    if (teacher.assignedclass) {
      const all = await Class.find();
      targetClasses = all.filter(c => c.name === teacher.assignedclass);    }

    if (!targetClasses.length) {
      const teacherClasses = await Class.find({ teacher: teacherId });      if (!teacherClasses.length) {        return res.status(400).json({ msg: 'No classes found for teacher' });
      }
      
      const year = teacherClasses[0].year;
      targetClasses = await Class.find({ year });    }

    if (!targetClasses.length) {      return res.json({ msg: 'No classes found to reset', count: 0 });
    }

    const classIds = targetClasses.map(c => c._id);

    const targetClassNames = targetClasses.map(c => c.name);

    let affectedStudents = await Student.find({ 
      classname_enc: { $in: targetClasses.map(c => c.name_enc).filter(Boolean) }
    }).select('fullName _id');

    if (affectedStudents.length === 0) {
      affectedStudents = await Student.find({ class: { $in: classIds } }).select('fullName _id');
    }

    if (affectedStudents.length === 0) {
      const allStudents = await Student.find();
      const targetLevels = targetClasses.map(c => c.level).filter(Boolean);
      const fallbackMatched = allStudents.filter(s => {
        try {
          const name = typeof s.getClassname === 'function' ? s.getClassname() : s.classname;
          const level = typeof s.getClassLevel === 'function' ? s.getClassLevel() : s.classLevel;
          return (name && targetClassNames.includes(name)) || (level && targetLevels.includes(level));
        } catch (e) {
          return false;
        }
      }).map(s => ({ _id: s._id, fullName: s.fullName }));
      affectedStudents = fallbackMatched;
    }

    if (affectedStudents.length === 0) {
      return res.json({ msg: 'No students to reset', count: 0 });
    }

    const updateResult = await Student.updateMany(
      { _id: { $in: affectedStudents.map(s => s._id) } }, 
      { $set: { teacher: null, class: null } }
    );
    
    const teachers = targetClasses.map(c => c.teacher).filter(Boolean);
    const teacherIds = [...new Set(teachers.map(t => String(t)))];
    for (const tId of teacherIds) {
      await Notification.create({ recipient: tId, type: 'other', message: `Students in your class have been reset by co-principal.` });
    }

    const studentNames = affectedStudents.map(s => s.fullName).join(', ');
    await Log.create({
      action: 'RESET_CLASS_GROUP',
      actor: null,
      performedBy: req.user._id,
      timestamp: new Date(),
      details: `Co-principal reset ${affectedStudents.length} students from classes: ${targetClasses.map(c => c.name).join(', ')}. Students: ${studentNames}`,
      ip: req.ip || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
      actorName: 'system',
      actorRole: 'system',
      targetUserName: req.user.fullName
    });    res.json({ msg: 'Class group reset complete', count: affectedStudents.length });
  } catch (err) {
    console.error('=== RESET CLASS GROUP ERROR ===');
    console.error('Error resetting class group:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/co-principal/reset-all', verifyToken, authorizeRoles('co-principal'), async (req, res) => {
  try {
    const Notification = require('../models/Notification');
    const Log = require('../models/Log');
    
    let targetLevels;
    if (req.user.assignedlevel === 1) targetLevels = [1, 2];
    else if (req.user.assignedlevel === 2) targetLevels = [3, 4];
    else if (req.user.assignedlevel === 3) targetLevels = [5, 6];
    else {
      const year = Math.ceil((req.user.assignedlevel || 1) / 2);
      targetLevels = year === 1 ? [1, 2] : year === 2 ? [3, 4] : [5, 6];
    }
    
    const targetClasses = await Class.find();
    const relevantClasses = targetClasses.filter(c => targetLevels.includes(c.level));
    if (!relevantClasses.length) {      return res.json({ msg: 'No relevant classes found to reset', count: 0 });
    }

    const targetClassNames = relevantClasses.map(c => c.name);
    const classNameEncs = relevantClasses.map(c => c.name_enc).filter(Boolean);
    let assignedStudents = [];

    if (classNameEncs.length > 0) {
      assignedStudents = await Student.find({ classname_enc: { $in: classNameEncs } }).select('fullName _id teacher');    }

    if (assignedStudents.length === 0) {
      const classIds = relevantClasses.map(c => c._id);
      assignedStudents = await Student.find({ class: { $in: classIds } }).select('fullName _id teacher');    }

    if (assignedStudents.length === 0) {      const allStudents = await Student.find();
      assignedStudents = allStudents.filter(s => {
        try {
          const name = typeof s.getClassname === 'function' ? s.getClassname() : s.classname;
          return name && targetClassNames.includes(name);
        } catch (e) {
          return false;
        }
      }).map(s => ({ _id: s._id, fullName: s.fullName, teacher: s.teacher }));    }

    if (!assignedStudents.length) {      return res.json({ msg: 'No assigned students to reset', count: 0 });
    }
    
    const teacherIds = [...new Set(assignedStudents.map(s => String(s.teacher)).filter(Boolean))];
    
    const updateResult = await Student.updateMany(
      { _id: { $in: assignedStudents.map(s => s._id) } },
      { $set: { teacher: null, class: null } }
    );
    
    for (const tId of teacherIds) {
      await Notification.create({ 
        recipient: tId, 
        type: 'other', 
        message: 'All students in your class(es) have been reset by co-principal.' 
      });
    }

    await Log.create({
      action: 'RESET_ALL',
      actor: null,
      performedBy: req.user._id,
      timestamp: new Date(),
      details: `Co-principal reset all teachers (${teacherIds.length} teachers, ${assignedStudents.length} students) under their authority at levels ${targetLevels.join(', ')}.`,
      ip: req.ip || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
      actorName: 'system',
      actorRole: 'system',
      targetUserName: req.user.fullName
    });    res.json({ msg: `Reset ${assignedStudents.length} students from ${teacherIds.length} teachers`, count: assignedStudents.length });
  } catch (err) {
    console.error('Error performing master reset:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
