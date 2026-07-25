const express = require('express');
const router = express.Router();
const Class = require('../models/Class');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const verifyDevice = require('../middleware/verifyDevice');

// Get all classes (filtered by role)
router.get('/', verifyToken, async (req, res) => {
  try {
    console.log('Fetching classes for role:', req.user.role);
    let classes;
    
    // Allow principals and admins to list all classes
    if (req.user.role === 'principal' || req.user.role === 'admin') {
      const all = await Class.find();
      classes = all.sort((a, b) => (a.level || 0) - (b.level || 0));
    } else if (req.user.role === 'co-principal') {
      // Map co-principal assignedlevel to the year grouping.
      // New desired mapping:
      //  assignedlevel 1 -> year 1 (classes 1 & 2)
      //  assignedlevel 2 -> year 2 (classes 3 & 4)
      //  assignedlevel 3 -> year 3 (classes 5 & 6)
      // Keep backward-compatible behavior for assignedlevel values 4-6
      // by falling back to the previous Math.ceil(.../2) mapping.
      let year;
      if (req.user.assignedlevel && [1, 2, 3].includes(req.user.assignedlevel)) {
        year = req.user.assignedlevel;
      } else {
        year = Math.ceil((req.user.assignedlevel || 1) / 2);
      }
      const all = await Class.find();
      classes = all.filter(c => c.year === year).sort((a, b) => (a.level || 0) - (b.level || 0));
    } else if (req.user.role === 'teacher') {
      // If the teacher has an assignedclass (string name), we cannot query by
      // plaintext name directly because it's stored encrypted as name_enc.
      // Fetch relevant classes and filter using the decrypted virtual 'name'.
        if (req.user.assignedclass) {
          const all = await Class.find();
          const cleanUserClass = (req.user.assignedclass || '').replace(/^فصل\s+/, '').trim();
          classes = all.filter(c => (c.name || '').replace(/^فصل\s+/, '').trim() === cleanUserClass);
        // If none matched by name (e.g., assignment by reference), also include classes taught by the user
        if (classes.length === 0) {
          classes = await Class.find({ teacher: req.user._id });
        }
      } else {
        classes = await Class.find({ teacher: req.user._id });
      }
    } else {
      return res.status(403).json({ msg: 'Unauthorized' });
    }
    
    console.log('Found', classes.length, 'classes');
    res.json(classes);
  } catch (err) {
    console.error('Error fetching classes:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Get teachers under co-principal's authority
router.get('/co-principal/teachers', verifyToken, authorizeRoles('co-principal'), async (req, res) => {
  try {
    const User = require('../models/User');

    console.log('Co-principal fetching teachers:', {
      userId: req.user._id,
      role: req.user.role,
      assignedlevel: req.user.assignedlevel
    });
    
    // Determine which class levels this co-principal should manage.
    // Mapping: assignedlevel 1 => levels [1,2], 2 => [3,4], 3 => [5,6].
    // For backward compatibility, if assignedlevel is >3 use the previous year mapping.
    let targetLevels;
    if (req.user.assignedlevel === 1) targetLevels = [1, 2];
    else if (req.user.assignedlevel === 2) targetLevels = [3, 4];
    else if (req.user.assignedlevel === 3) targetLevels = [5, 6];
    else {
      const year = Math.ceil((req.user.assignedlevel || 1) / 2);
      targetLevels = year === 1 ? [1, 2] : year === 2 ? [3, 4] : [5, 6];
    }

    // First, get all active teachers
    const allTeachers = await User.find({ 
      role: 'teacher', 
      isActive: true 
    }).select('_id fullName assignedclass');
    
    console.log('All active teachers:', allTeachers.map(t => ({
      id: t._id,
      name: t.fullName,
      assignedClass: t.assignedclass
    })));
    
    // Get all classes, then filter by decrypted virtual 'level' to match targetLevels.
    const allClasses = await Class.find().populate({
      path: 'teacher',
      select: 'fullName _id role assignedclass'
    });

    console.log('All classes in system:', allClasses.map(c => ({ name: c.name, level: c.level, year: c.year })));

    const yearClasses = allClasses.filter(c => targetLevels.includes(c.level));
    console.log('Classes matching target levels', targetLevels, ':', yearClasses.map(c => ({
      name: c.name,
      level: c.level,
      teacherId: c.teacher?._id,
      teacherName: c.teacher?.fullName
    })));
    
    // Collect teachers through both class assignments and assignedclass field
    const teachers = [];
    const seen = new Set();
    
    // First, add teachers explicitly assigned to classes
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
    
    // Then check for teachers with matching assignedclass
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
    
    // Enrich teachers with decrypted fullName if missing. Collect all teacher ids and fetch full names in one query.
    const teacherIds = teachers.map(t => t._id);
    if (teacherIds.length) {
      // include raw encrypted field in case virtual getter isn't returning value
      const users = await User.find({ _id: { $in: teacherIds } }).select('fullName fullName_enc username');
      const { decrypt } = require('../utils/crypto');
      const nameMap = new Map();
      users.forEach(u => {
        let name = '';
        try {
          if (u.fullName && String(u.fullName).trim().length) name = u.fullName;
          // fallback: try decrypting the raw encrypted object if available
          else if (u.fullName_enc && u.fullName_enc.data) {
            const dec = decrypt(u.fullName_enc);
            if (dec && String(dec).trim().length) name = dec;
          }
        } catch (e) {
          // ignore and fallback to username
        }
        if (!name || !String(name).trim()) name = u.username || '';
        nameMap.set(u._id.toString(), name);
      });
      teachers.forEach(t => {
        const n = nameMap.get(t._id.toString());
        if (n) t.fullName = n;
      });
    }

    console.log('Final teachers list:', teachers.map(t => ({
      id: t._id,
      name: t.fullName,
      class: t.assignedClass
    })));
    
    res.json(teachers);
  } catch (err) {
    console.error('Error fetching teachers for co-principal:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get all students available for co-principal to assign
router.get('/co-principal/students', verifyToken, authorizeRoles('co-principal'), async (req, res) => {
  try {
    console.log('Fetching available students for co-principal level:', req.user.assignedlevel);
    
    // Determine which class levels this co-principal should manage.
    let targetLevels;
    if (req.user.assignedlevel === 1) targetLevels = [1, 2];
    else if (req.user.assignedlevel === 2) targetLevels = [3, 4];
    else if (req.user.assignedlevel === 3) targetLevels = [5, 6];
    else {
      const year = Math.ceil((req.user.assignedlevel || 1) / 2);
      targetLevels = year === 1 ? [1, 2] : year === 2 ? [3, 4] : [5, 6];
    }

    // Get students in the co-principal's assigned level range that aren't assigned to any class.
    // Because Student.classLevel is stored encrypted, query by 'class: null' then filter
    // in application code by decrypted classLevel virtual or helper.
    const rawUnassigned = await Student.find({ $or: [{ class: { $exists: false } }, { class: null }] });
    const students = rawUnassigned.filter(s => {
      const level = typeof s.getClassLevel === 'function' ? s.getClassLevel() : s.classLevel;
      return level && targetLevels.includes(level);
    });

    console.log('Found', students.length, 'available unassigned students for levels', targetLevels);
    res.json(students);
  } catch (err) {
    console.error('Error fetching available students:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get students assigned to a specific teacher
router.get('/teacher/:teacherId/students', verifyToken, authorizeRoles('co-principal'), async (req, res) => {
  try {
    console.log('Fetching students for teacher:', req.params.teacherId);

    // First get the teacher's classes
    const classes = await Class.find({ teacher: req.params.teacherId });
    console.log('Teacher classes:', classes.map(c => c.name));

    if (!classes.length) {
      console.log('No classes found for teacher');
      return res.json([]);
    }

    // Get students in those classes
    // Fetch full student documents so encrypted fields are available for decryption
    const students = await Student.find({ class: { $in: classes.map(c => c._id) } });

    console.log('Found', students.length, 'students assigned to teacher');
    res.json(students);
  } catch (err) {
    console.error('Error fetching teacher students:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get both assigned and available (unassigned) students for a teacher's class group
// Returns { assigned: [...], available: [...] }
router.get('/teacher/:teacherId/available', verifyToken, authorizeRoles('co-principal','teacher'), async (req, res) => {
  try {
    const teacherId = req.params.teacherId;

    // If the requester is a teacher, ensure they only request their own data
    if (req.user.role === 'teacher' && String(req.user._id) !== String(teacherId)) {
      return res.status(403).json({ msg: 'Forbidden' });
    }

    // Find classes for the teacher
    let teacherClasses = await Class.find({ teacher: teacherId });
    console.log('DEBUG /teacher/:teacherId/available - teacherId:', teacherId, 'found classes:', teacherClasses.length);

    // Fallback: if the teacher record stores an `assignedclass` string (plaintext)
    // but the Class documents hold encrypted names, try loading all classes and
    // matching by the decrypted virtual `name` property.
    if (!teacherClasses.length) {
      try {
        const teacherUser = await User.findById(teacherId).select('assignedclass fullName');
        if (teacherUser && teacherUser.assignedclass) {
          const all = await Class.find();
          const cleanTeacherClass = (teacherUser.assignedclass || '').replace(/^فصل\s+/, '').trim();
          teacherClasses = all.filter(c => (c.name || '').replace(/^فصل\s+/, '').trim() === cleanTeacherClass);
          console.log('DEBUG /teacher/:teacherId/available - fallback matched classes by teacher.assignedclass', teacherUser.assignedclass, 'count:', teacherClasses.length);
        }
      } catch (e) {
        console.error('DEBUG /teacher/:teacherId/available - fallback lookup error:', e && e.message);
      }
    }

    if (!teacherClasses.length) {
      console.log('DEBUG /teacher/:teacherId/available - no classes for teacher after fallback, returning empty sets');
      // No classes -> return empty sets
      return res.json({ assigned: [], available: [] });
    }

    const classIds = teacherClasses.map(c => c._id);

    // Assigned students: those specifically assigned to THIS teacher
    const assigned = await Student.find({ teacher: teacherId });
    console.log('DEBUG assigned students count for teacher', teacherId, ':', assigned.length);

    // Determine target levels (collect distinct levels from teacherClasses)
    const targetLevels = [...new Set(teacherClasses.map(c => c.level).filter(Boolean))];

    // Available students: those not assigned to any teacher (teacher field is null/undefined) AND matching targetLevels
    const rawUnassigned = await Student.find({ $or: [{ teacher: { $exists: false } }, { teacher: null }] });
    console.log('DEBUG raw unassigned students count:', rawUnassigned.length);
    // Try to match unassigned students by either decrypted classLevel OR decrypted classname
    const targetNames = teacherClasses.map(c => c.name).filter(Boolean);
    let available = rawUnassigned.filter(s => {
      const level = typeof s.getClassLevel === 'function' ? s.getClassLevel() : s.classLevel;
      const name = typeof s.getClassname === 'function' ? s.getClassname() : s.classname;
      return (level && targetLevels.includes(level)) || (name && targetNames.includes(name));
    });
    console.log('DEBUG available after filtering by targetLevels OR classname', { targetLevels, targetNames, count: available.length });

    res.json({ assigned, available });
  } catch (err) {
    console.error('Error fetching available students for teacher:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get students in a class with attendance stats
router.get('/:classId/students', verifyToken, async (req, res) => {
  try {
    console.log('Fetching students for class:', req.params.classId);

    // Find the class first
    const classObj = await Class.findById(req.params.classId);
    if (!classObj) {
      console.log('Class not found:', req.params.classId);
      return res.status(404).json({ msg: 'Class not found' });
    }

    // Find students in this class using decrypted classname fallback
    const allStudents = await Student.find({});
    const students = allStudents.filter(s => (typeof s.getClassname === 'function' ? s.getClassname() : s.classname) === classObj.name);
    console.log('Found', students.length, 'students in class', classObj.name);

    // Get attendance for each student
    const studentsWithDetails = await Promise.all(students.map(async (student) => {
      const attendance = await Attendance.find({ student: student._id })
        .sort({ date: -1 })
        .limit(10); // Get last 10 attendance records

      // Use toJSON to inject decrypted fallbacks from Student model
      const s = student.toJSON();

      // Compute attendance stats for UI expectations
      const totalRecords = attendance.length;
      const presentCount = attendance.filter(a => {
        const status = (typeof a.status === 'function') ? a.status() : a.status; // fallback
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
          // new: most recent date student was marked present
          lastAttendanceDate: s.lastAttendanceDate,
        attendance,
        totalRecords,
        attendancePercentage
      };
    }));

    console.log('Successfully processed', studentsWithDetails.length, 'students');
      res.json({
        className: classObj.name,
        classLevel: classObj.level,
        students: studentsWithDetails
      });
  } catch (err) {
    console.error('Error fetching class students:', err);
    res.status(500).json({ 
      msg: 'Error fetching students',
      error: err.message 
    });
  }
});

// Assign students to teacher
router.post('/co-principal/assign', verifyToken, verifyDevice, authorizeRoles('co-principal'), async (req, res) => {
  try {
    const { teacherId, studentIds } = req.body;
    console.log('Assign students request payload:', { teacherId, studentIds, performedBy: req.user && req.user.id });
    const Notification = require('../models/Notification');
    const Log = require('../models/Log');
    
    // Get teacher details first (include assignedclass for fallback mapping)
    const teacher = await User.findById(teacherId).select('fullName assignedclass');
    if (!teacher) {
      return res.status(400).json({ msg: 'Teacher not found' });
    }

    // Find teacher's classes. If none, try a fallback: match classes by the
    // teacher's assignedclass string (decrypted virtual) because classes are
    // stored with encrypted names.
    let teacherClasses = await Class.find({ teacher: teacherId });
    console.log('Teacher classes count:', teacherClasses.length, 'for teacherId:', teacherId);
    if (!teacherClasses.length && teacher.assignedclass) {
      // Load all classes and filter by decrypted virtual 'name'
      const all = await Class.find();
      teacherClasses = all.filter(c => c.name === teacher.assignedclass);
      console.log('Fallback: classes matching teacher.assignedclass', teacher.assignedclass, ':', teacherClasses.map(c => c.name));
    }

    if (!teacherClasses.length) {
      return res.status(400).json({ msg: 'Teacher has no assigned classes' });
    }

    // Get student details for notification and logging. First try matching by _id.
    let studentsToAssign = await Student.find({ _id: { $in: studentIds } }).select('fullName _id');
    console.log('Students found for assignment by _id:', studentsToAssign.map(s => ({ id: s._id, fullName: s.fullName })));

    // If none found, try matching by the studentId (school id like ST123) as a
    // fallback in case the client sent student codes instead of DB _ids.
    if (studentsToAssign.length === 0) {
      const fallback = await Student.find({ studentId: { $in: studentIds } }).select('fullName _id studentId');
      if (fallback.length) {
        console.log('Fallback: matched students by studentId codes:', fallback.map(f => ({ id: f._id, studentId: f.studentId })));
        // replace the studentIds array with the actual DB _id values we found
        studentIds = fallback.map(f => f._id);
        studentsToAssign = fallback;
      }
    }

    if (studentsToAssign.length === 0) {
      return res.status(400).json({ msg: 'No valid students to assign' });
    }

    // First do the assignment
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
    
    // Create notification for the teacher
    const studentNames = studentsToAssign.map(s => s.fullName).join(', ');
    const notificationMessage = `You have been assigned ${studentsToAssign.length} new student${studentsToAssign.length > 1 ? 's' : ''}: ${studentNames}`;
    
    await Notification.create({
      recipient: teacherId,
      type: 'other',
      message: notificationMessage
    });

    // Create detailed log entry
    const logEntry = {
      action: 'ASSIGN_STUDENTS',
      actor: teacherId,  // The teacher
      performedBy: req.user._id,  // The co-principal
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

// Remove students from teacher
router.post('/co-principal/remove-students', verifyToken, verifyDevice, authorizeRoles('co-principal'), async (req, res) => {
  try {
    const { teacherId, allClasses, studentIds } = req.body;
    const Notification = require('../models/Notification');
    const Log = require('../models/Log');

    console.log('Remove students request:', { teacherId, allClasses, studentIds: studentIds?.length });

    // Get teacher details first
    const teacher = await User.findById(teacherId).select('fullName assignedclass');
    if (!teacher) {
      return res.status(400).json({ msg: 'Teacher not found' });
    }

    // Get the teacher's classes
    let teacherClasses = await Class.find({ teacher: teacherId });
    
    // Fallback: if no classes found by teacher reference, try matching by assignedclass
    if (!teacherClasses.length && teacher.assignedclass) {
      const all = await Class.find();
      teacherClasses = all.filter(c => c.name === teacher.assignedclass);
      console.log('Fallback: found', teacherClasses.length, 'classes by assignedclass:', teacher.assignedclass);
    }
    
    if (!teacherClasses.length) {
      return res.status(400).json({ msg: 'Teacher has no assigned classes' });
    }
    console.log('Found', teacherClasses.length, 'classes for teacher', teacherId);

    // If studentIds provided, remove only those students (selective removal)
    let affectedStudents = [];
    if (Array.isArray(studentIds) && studentIds.length) {
      // Try to find students by teacher field first (new system)
      let students = await Student.find({ _id: { $in: studentIds }, teacher: teacherId }).select('fullName _id');
      
      // Fallback: if no students found via teacher field, try finding them in teacher's classes
      if (students.length === 0) {
        const classIds = teacherClasses.map(c => c._id);
        students = await Student.find({ _id: { $in: studentIds }, class: { $in: classIds } }).select('fullName _id');
      }
      
      if (students.length === 0) {
        return res.status(400).json({ msg: 'No matching students found for removal' });
      }
      affectedStudents = students;
      // Update by both teacher and class to handle mixed old/new data
      // NOTE: Keep classname - it's metadata about the student's original class, not assignment status
      await Student.updateMany(
        { _id: { $in: students.map(s => s._id) } },
        { $set: { teacher: null, class: null } }
      );
    } else if (allClasses) {
      const year = teacherClasses[0].year;
      const yearClasses = await Class.find({ year });
      // Try to find students assigned via 'teacher' field first (new system)
      affectedStudents = await Student.find({ teacher: teacherId }).select('fullName _id');
      
      // Fallback: if no students found via teacher field, try finding them via class field
      // This handles cases where students were assigned before the teacher field was added
      if (affectedStudents.length === 0) {
        const classIds = yearClasses.map(c => c._id);
        affectedStudents = await Student.find({ class: { $in: classIds } }).select('fullName _id');
        console.log('Fallback: found', affectedStudents.length, 'students via class field');
      }

      // Remove using either teacher or class field
      if (affectedStudents.length > 0) {
        // Try removing by teacher first, then by class as fallback
        // NOTE: Keep classname - it's metadata about the student's original class, not assignment status
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
      // Remove from teacher's specific classes only
      affectedStudents = await Student.find({ teacher: teacherId }).select('fullName _id');
      
      // Fallback: try finding by class field
      if (affectedStudents.length === 0) {
        const classIds = teacherClasses.map(c => c._id);
        affectedStudents = await Student.find({ class: { $in: classIds } }).select('fullName _id');
        console.log('Fallback: found', affectedStudents.length, 'students via class field');
      }

      // Remove using either teacher or class field
      if (affectedStudents.length > 0) {
        // Try removing by teacher first, then by class as fallback
        // NOTE: Keep classname - it's metadata about the student's original class, not assignment status
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
      // Create notification for the teacher
      const studentNames = affectedStudents.map(s => s.fullName).join(', ');
      const notificationMessage = `${affectedStudents.length} student${affectedStudents.length > 1 ? 's have' : ' has'} been removed from your class${allClasses ? 'es' : ''}: ${studentNames}`;
      
      await Notification.create({
        recipient: teacherId,
        type: 'other',
        message: notificationMessage
      });

      // Create log entry
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

// Reset all students from a specific teacher's classes back to unassigned
router.post('/co-principal/reset-class', verifyToken, verifyDevice, authorizeRoles('co-principal'), async (req, res) => {
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

    // Notify the teacher
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

// Reset all students for a class group (all teachers in the same class)
// The client should pass { teacherId } and this will reset students for the
// class name that the teacher is associated with (or fall back to teacher's classes' year).
router.post('/co-principal/reset-class-group', verifyToken, verifyDevice, authorizeRoles('co-principal'), async (req, res) => {
  try {
    const { teacherId } = req.body;
    const Notification = require('../models/Notification');
    const Log = require('../models/Log');

    console.log('=== RESET CLASS GROUP START ===');
    console.log('Request body:', { teacherId });
    console.log('Co-principal user:', req.user._id);

    const teacher = await User.findById(teacherId).select('fullName assignedclass');
    if (!teacher) {
      console.log('Teacher not found:', teacherId);
      return res.status(400).json({ msg: 'Teacher not found' });
    }
    console.log('Teacher found:', { id: teacher._id, name: teacher.fullName, assignedclass: teacher.assignedclass });

    let targetClasses = [];

    // If teacher.assignedclass is set, reset by class name (matching decrypted virtual)
    if (teacher.assignedclass) {
      const all = await Class.find();
      targetClasses = all.filter(c => c.name === teacher.assignedclass);
      console.log('Matched classes by assignedclass:', targetClasses.map(c => ({ id: c._id, name: c.name })));
    }

    // Fallback: if no classes matched by name, use teacher's assigned classes
    if (!targetClasses.length) {
      const teacherClasses = await Class.find({ teacher: teacherId });
      console.log('Classes by teacher field:', teacherClasses.length);
      if (!teacherClasses.length) {
        console.log('No classes found for teacher - returning error');
        return res.status(400).json({ msg: 'No classes found for teacher' });
      }
      // Use year of the teacher classes to reset all classes in that year
      const year = teacherClasses[0].year;
      targetClasses = await Class.find({ year });
      console.log('Matched classes by year:', targetClasses.map(c => ({ id: c._id, name: c.name, year: c.year })));
    }

    if (!targetClasses.length) {
      console.log('No target classes found');
      return res.json({ msg: 'No classes found to reset', count: 0 });
    }

    const classIds = targetClasses.map(c => c._id);
    console.log('Target class IDs:', classIds.map(String));
    
    // Get the classnames for the target classes to find ALL students in those classes
    const targetClassNames = targetClasses.map(c => c.name);
    console.log('Target class names:', targetClassNames);

    // Primary: Find all students in the target classes by encrypted classname
    // This will find ALL students in the class, not just those assigned to a specific teacher
    let affectedStudents = await Student.find({ 
      classname_enc: { $in: targetClasses.map(c => c.name_enc).filter(Boolean) }
    }).select('fullName _id');
    console.log('DEBUG reset-class-group - affected by classname_enc lookup:', affectedStudents.length);
    
    // Fallback: try finding by class ObjectId (older data structure)
    if (affectedStudents.length === 0) {
      affectedStudents = await Student.find({ class: { $in: classIds } }).select('fullName _id');
      console.log('DEBUG reset-class-group - fallback: affected by class field lookup:', affectedStudents.length);
    }

    // Additional fallback: if no students matched by ObjectId (data inconsistency), attempt
    // to match by decrypted classname or classLevel by loading students and filtering
    // in application code. This covers cases where some student docs store classname
    // plaintext or class mapping wasn't normalized.
    if (affectedStudents.length === 0) {
      console.log('DEBUG reset-class-group - fallback: scanning students and matching by classname/classLevel');
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
      console.log('DEBUG reset-class-group - fallback matched students count:', fallbackMatched.length);
      affectedStudents = fallbackMatched;
    }

    if (affectedStudents.length === 0) {
      console.log('No students found to reset');
      return res.json({ msg: 'No students to reset', count: 0 });
    }
    
    console.log('Affected students:', affectedStudents.length, affectedStudents.map(s => ({ id: String(s._id), name: s.fullName })));

    // Update student docs to clear class assignment using their _id list
    // NOTE: Keep classname - it's metadata about the student's original class, not assignment status
    const updateResult = await Student.updateMany(
      { _id: { $in: affectedStudents.map(s => s._id) } }, 
      { $set: { teacher: null, class: null } }
    );
    console.log('Update result:', { matched: updateResult.matchedCount, modified: updateResult.modifiedCount });

    // Notify all teachers who own these classes
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
    });

    console.log('=== RESET CLASS GROUP SUCCESS ===');
    console.log('Reset complete. Affected students count:', affectedStudents.length);
    res.json({ msg: 'Class group reset complete', count: affectedStudents.length });
  } catch (err) {
    console.error('=== RESET CLASS GROUP ERROR ===');
    console.error('Error resetting class group:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Reset all students from all teachers (master reset)
router.post('/co-principal/reset-all', verifyToken, verifyDevice, authorizeRoles('co-principal'), async (req, res) => {
  try {
    const Notification = require('../models/Notification');
    const Log = require('../models/Log');

    console.log('=== RESET ALL TEACHERS START ===');
    console.log('Co-principal user:', req.user._id, 'assignedlevel:', req.user.assignedlevel);

    // Determine which class levels this co-principal manages
    let targetLevels;
    if (req.user.assignedlevel === 1) targetLevels = [1, 2];
    else if (req.user.assignedlevel === 2) targetLevels = [3, 4];
    else if (req.user.assignedlevel === 3) targetLevels = [5, 6];
    else {
      const year = Math.ceil((req.user.assignedlevel || 1) / 2);
      targetLevels = year === 1 ? [1, 2] : year === 2 ? [3, 4] : [5, 6];
    }
    console.log('Target levels for this co-principal:', targetLevels);

    // Get all classes at those levels
    const targetClasses = await Class.find();
    const relevantClasses = targetClasses.filter(c => targetLevels.includes(c.level));
    console.log('Relevant classes:', relevantClasses.map(c => ({ id: String(c._id), name: c.name, level: c.level })));

    if (!relevantClasses.length) {
      console.log('No relevant classes found');
      return res.json({ msg: 'No relevant classes found to reset', count: 0 });
    }

    // Find all students in these classes by encrypted classname
    const targetClassNames = relevantClasses.map(c => c.name);
    const classNameEncs = relevantClasses.map(c => c.name_enc).filter(Boolean);
    console.log('Target classname_encs count:', classNameEncs.length);

    let assignedStudents = [];
    
    // Primary: Find by encrypted classname
    if (classNameEncs.length > 0) {
      assignedStudents = await Student.find({ classname_enc: { $in: classNameEncs } }).select('fullName _id teacher');
      console.log('Found students by classname_enc:', assignedStudents.length);
    }
    
    // Fallback: Find by class ObjectId
    if (assignedStudents.length === 0) {
      const classIds = relevantClasses.map(c => c._id);
      assignedStudents = await Student.find({ class: { $in: classIds } }).select('fullName _id teacher');
      console.log('Found students by class field:', assignedStudents.length);
    }
    
    // Additional fallback: Search by classname decryption
    if (assignedStudents.length === 0) {
      console.log('Fallback: scanning all students by decrypted classname');
      const allStudents = await Student.find();
      assignedStudents = allStudents.filter(s => {
        try {
          const name = typeof s.getClassname === 'function' ? s.getClassname() : s.classname;
          return name && targetClassNames.includes(name);
        } catch (e) {
          return false;
        }
      }).map(s => ({ _id: s._id, fullName: s.fullName, teacher: s.teacher }));
      console.log('Found students by classname decryption:', assignedStudents.length);
    }

    if (!assignedStudents.length) {
      console.log('No assigned students found in co-principal\'s classes');
      return res.json({ msg: 'No assigned students to reset', count: 0 });
    }

    console.log('Total students to reset:', assignedStudents.length);

    // Collect affected teacher ids
    const teacherIds = [...new Set(assignedStudents.map(s => String(s.teacher)).filter(Boolean))];
    console.log('Affected teachers:', teacherIds);

    // Reset: clear teacher and class assignments but keep classname metadata
    const updateResult = await Student.updateMany(
      { _id: { $in: assignedStudents.map(s => s._id) } },
      { $set: { teacher: null, class: null } }
    );
    console.log('Update result:', { matched: updateResult.matchedCount, modified: updateResult.modifiedCount });

    // Notify affected teachers
    for (const tId of teacherIds) {
      await Notification.create({ 
        recipient: tId, 
        type: 'other', 
        message: 'All students in your class(es) have been reset by co-principal.' 
      });
    }

    // Log the action
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
    });

    console.log('=== RESET ALL TEACHERS COMPLETE ===');
    res.json({ msg: `Reset ${assignedStudents.length} students from ${teacherIds.length} teachers`, count: assignedStudents.length });
  } catch (err) {
    console.error('Error performing master reset:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
