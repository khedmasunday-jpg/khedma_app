const Student = require('../models/Student');
const User = require('../models/User');
const Log = require('../models/Log');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { releaseId, getNextId, getNextIdBatch } = require('../services/idManager');

// Helper function to create enhanced logs
async function createEnhancedLog(action, actor, targetUser = null, additionalDetails = '', req = null) {
  try {
    const sanitize = (v) => {
      if (v === undefined || v === null) return '';
      return String(v).replace(/^\s+|\s+$/g, '');
    };

    const ipVal = req ? (req.headers['x-forwarded-for'] || req.connection.remoteAddress) : 'unknown';
    const userAgentVal = req ? (req.headers['user-agent'] || 'unknown') : 'unknown';

    // If actor is a lightweight object (e.g. req.user with id), fetch full user doc to get fullName/role
    let actorDoc = actor;
    if (actor && !(actor.fullName) && (actor._id || actor.id)) {
      try {
        actorDoc = await User.findById(actor._id || actor.id).select('fullName role username');
      } catch (e) {
        actorDoc = actor;
      }
    }

    const actorName = sanitize(actorDoc && (actorDoc.fullName || actorDoc.username) || 'Unknown');
    const actorRole = sanitize(actorDoc && actorDoc.role || 'Unknown');
    const targetName = sanitize(targetUser && (targetUser.fullName || targetUser.username) || '');
    const targetRole = sanitize(targetUser && targetUser.role || '');

    const logData = {
      action,
      performedBy: actor && actor._id ? actor._id : undefined,
      actorName,
      actorRole,
      actionDescription: `${actorRole} ${actorName} performed: ${sanitize(action)} | IP: ${sanitize(ipVal)}`,
      details: sanitize(additionalDetails) || '',
      ip: sanitize(ipVal) || '',
      userAgent: sanitize(userAgentVal) || ''
    };

    if (targetUser) {
      logData.targetUser = targetUser._id;
      logData.targetUserName = targetName || 'N/A';
      logData.targetUserRole = targetRole || '';
      logData.actionDescription = `${actorRole} ${actorName} ${sanitize(action)} ${targetRole} ${targetName}`.trim();
    }

    await Log.create(logData);
  } catch (err) {
    console.error('Error creating enhanced log:', err);
  }
}

// Delete student and release their ID
exports.deleteStudent = async (req, res) => {
  try {
    // Debug: log incoming delete request context
    console.log('DELETE /students/:id called, params.id=', req.params.id, 'user=', req.user && { id: req.user.id, role: req.user.role });

    // Only principal or admin may delete students
    if (!req.user || (req.user.role !== 'principal' && req.user.role !== 'admin')) {
      console.log('Delete rejected - insufficient permissions for user', req.user && req.user.id);
      return res.status(403).json({ msg: 'Only principal or admin may delete students' });
    }

    const student = await Student.findById(req.params.id);
    if (!student) {
      console.log('Delete failed - student not found:', req.params.id);
      return res.status(404).json({ error: 'Student not found' });
    }

    // Remove student reference from any classes
    const Class = require('../models/Class');
    await Class.updateMany({ students: student._id }, { $pull: { students: student._id } });

    await Student.findByIdAndDelete(req.params.id);
    await releaseId(student.id); // Free up the ID

    // Audit log
    try {
      const name = typeof student.getFullName === 'function' ? student.getFullName() : (student.fullName || '');
      await createEnhancedLog('Deleted student', req.user, null, `Deleted student ${name}`, req);
    } catch (logErr) {
      console.error('Failed to create delete log:', logErr);
    }

    console.log('Delete successful for student', req.params.id);
    res.json({ msg: 'Student deleted' });
  } catch (err) {
    console.error('Delete student error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Bulk add students (e.g., 30/year)
// Helper to format human-friendly studentId from numeric id
const formatStudentId = (id) => `ST${String(id).padStart(3, '0')}`;

exports.bulkAddStudents = async (req, res) => {
  try {
    if (!Array.isArray(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'Request body must be a non-empty array' });
    }

    const Class = require('../models/Class');
    
    // Fetch all classes once for validation
    const allClasses = await Class.find();
    
    // Validate all students before processing
    const validatedStudents = [];
    for (const stu of req.body) {
      // Validate required fields
      if (!stu.fullName || !stu.classLevel || !stu.classname) {
        continue; // Skip invalid entries
      }
      
      // Validate class exists
      const targetClass = allClasses.find(c => c.name === stu.classname);
      if (!targetClass) {
        continue; // Skip students with invalid classes
      }
      
      // Validate classLevel matches
      if (targetClass.year !== undefined && Number(stu.classLevel) !== Number(targetClass.year)) {
        continue; // Skip students with mismatched classLevel
      }
      
      validatedStudents.push({ stu, targetClass });
    }

    if (validatedStudents.length === 0) {
      return res.status(400).json({ error: 'No valid students to add' });
    }

    // Generate all IDs atomically in one batch to avoid race conditions
    let students;
    let attempts = 0;
    const maxRetries = 3;
    
    while (attempts < maxRetries) {
      try {
        const ids = await getNextIdBatch(validatedStudents.length);
        console.log('bulkAddStudents: candidate ids=', ids);
        
        // Prepare students with assigned IDs and verify uniqueness of studentIds
        const toInsert = [];
        for (let i = 0; i < validatedStudents.length; i++) {
          const id = ids[i];
          const studentId = `ST${String(id).padStart(3, '0')}`;
          
          // Check if studentId already exists
          const exists = await Student.findOne({ studentId }).lean();
          if (exists) {
            throw new Error(`StudentId ${studentId} already exists`);
          }
          
          // Merge client fields first, then force server-generated id/studentId to win
          toInsert.push({
            ...validatedStudents[i].stu,
            id,
            studentId
          });
        }

        // Insert students one-by-one using Model.create so Mongoose middleware (pre-validate) runs
        // This avoids insertMany bypassing hooks which can lead to missing/generated fields like studentId
        students = [];
        for (const doc of toInsert) {
          try {
            const created = await Student.create(doc);
            students.push(created);
          } catch (singleErr) {
            console.error('Error creating student in bulkAddStudents for studentId=', doc.studentId || doc.id, singleErr && singleErr.stack ? singleErr.stack : singleErr);
            // rethrow to trigger retry logic
            throw singleErr;
          }
        }
        break; // Success, exit retry loop
      } catch (insertErr) {
        attempts++;
        console.error(`bulkAddStudents attempt ${attempts} error:`, insertErr && insertErr.stack ? insertErr.stack : insertErr);
        if (attempts >= maxRetries) {
          console.error('Failed to insert students after retries:', insertErr);
          // Include underlying error message for diagnostics
          return res.status(400).json({ 
            error: 'Failed to add students. Please try again or submit students in smaller batches.',
            details: insertErr && insertErr.message ? insertErr.message : String(insertErr)
          });
        }
        console.log(`Error in bulk insert, retrying (attempt ${attempts + 1}/${maxRetries})...`);
        // Wait a bit before retry to allow other operations to complete
        await new Promise(resolve => setTimeout(resolve, 100 * attempts));
        continue;
      }
    }

    // Add students to their respective classes
    const classUpdates = new Map();
    for (let i = 0; i < validatedStudents.length; i++) {
      const { targetClass } = validatedStudents[i];
      const student = students[i];
      
      if (!classUpdates.has(targetClass._id.toString())) {
        classUpdates.set(targetClass._id.toString(), {
          class: targetClass,
          studentIds: []
        });
      }
      classUpdates.get(targetClass._id.toString()).studentIds.push(student._id);
    }

    // Update all classes
    for (const { class: targetClass, studentIds } of classUpdates.values()) {
      targetClass.students.push(...studentIds);
      await targetClass.save();
    }

    // Create detailed log for bulk addition (use decrypted names)
    const studentNames = students.map(s => (typeof s.getFullName === 'function' ? s.getFullName() : (s.fullName || ''))).join(', ');
    await createEnhancedLog(
      'Bulk added students',
      req.user,
      null,
      `Added ${students.length} students: ${studentNames}`,
      req
    );

    res.status(201).json(students);
  } catch (err) {
    console.error('Bulk add students error:', err);
    res.status(400).json({ error: err.message });
  }
};

// Add student (principal/co-principal)
exports.addStudent = async (req, res) => {
  try {
    console.log('Adding new student with data:', req.body);
    
    // Validate required fields (birthdate is optional)
    const requiredFields = ['fullName', 'classLevel', 'classname', 'address'];
    const missingFields = requiredFields.filter(field => !req.body[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({ 
        msg: `Missing required fields: ${missingFields.join(', ')}`,
        missingFields 
      });
    }

    // Phone numbers are optional - validation removed

    const Class = require('../models/Class');
    
    // Check if the class exists
    // Because class fields are encrypted, we cannot query by name directly.
    // Fetch and match using decrypted virtual 'name'.
    const allClasses = await Class.find();
    const targetClass = allClasses.find(c => c.name === req.body.classname);
    if (!targetClass) {
      return res.status(400).json({
        msg: 'Class not found. Please select a valid class.',
        field: 'classname'
      });
    }
    
    // Also validate that classLevel matches the class year/level if provided
    if (req.body.classLevel !== undefined && targetClass.year !== undefined) {
      if (Number(req.body.classLevel) !== Number(targetClass.year)) {
        return res.status(400).json({
          msg: `Class level mismatch. The class "${req.body.classname}" is for year ${targetClass.year}, but you provided classLevel ${req.body.classLevel}.`,
          field: 'classLevel'
        });
      }
    }

  // Prevent clients from supplying/overriding studentId - server generates it
  // Delete the key regardless of its value (null/undefined/empty) so it cannot
  // accidentally overwrite a server-generated studentId later when we merge objects.
  if (Object.prototype.hasOwnProperty.call(req.body, 'studentId')) delete req.body.studentId;

    // Create and save the student with retry logic for duplicate studentId errors
    let student;
    let attempts = 0;
    const maxRetries = 5;
    const studentData = { ...req.body }; // Copy to avoid mutating original
    
    while (attempts < maxRetries) {
      try {
        // On retry, manually generate a new ID to avoid hook race condition
        if (attempts > 0) {
          const newId = await getNextId();
          studentData.id = newId;
          studentData.studentId = `ST${String(newId).padStart(3, '0')}`;
        }
        
        // Create new student instance
        // Pre-validate hook will skip ID generation if id is already set (on retry)
        // On first attempt, hook will generate the ID automatically
        student = new Student(studentData);
        
        console.log(`Created student object (attempt ${attempts + 1}):`, student);
        await student.save();
        console.log('Saved student successfully with ID:', student._id);
        break; // Success, exit retry loop
      } catch (saveErr) {
        // Only retry on duplicate studentId or id errors
        if (saveErr.code === 11000 && saveErr.keyPattern && 
            (saveErr.keyPattern.studentId || saveErr.keyPattern.id)) {
          attempts++;
          if (attempts >= maxRetries) {
            // Max retries reached, return error
            return res.status(400).json({ 
              msg: 'Failed to generate unique student ID after multiple attempts. Please try again.',
              field: 'studentId'
            });
          }
          const field = saveErr.keyPattern.studentId ? 'studentId' : 'id';
          console.log(`Duplicate ${field} detected, retrying (attempt ${attempts + 1}/${maxRetries})...`);
          // Small delay with exponential backoff to allow other concurrent saves to complete
          await new Promise(resolve => setTimeout(resolve, 50 * attempts));
          // On next iteration, we'll manually generate a new ID before creating the instance
          continue;
        }
        // Other errors, re-throw to be handled by outer catch
        throw saveErr;
      }
    }

    // Add student to class and update class
    targetClass.students.push(student._id);
    await targetClass.save();
    console.log('Updated class:', targetClass.name, 'with new student');

  // Create detailed log (use getters to read decrypted values)
  const logDetails = `Added student: ${typeof student.getFullName === 'function' ? student.getFullName() : (student.fullName || '')}, Class: ${typeof student.getClassname === 'function' ? student.getClassname() : (student.classname || '')}, Level: ${typeof student.getClassLevel === 'function' ? student.getClassLevel() : (student.classLevel || '')}`;
    await createEnhancedLog('Added student', req.user, null, logDetails, req);

    res.status(201).json(student);
  } catch (err) {
    // Handle duplicate key errors specifically
    if (err.code === 11000) {
      // keyPattern may contain the indexed field name(s)
      const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'unknown_field';
      // If the duplicate key is on `classname`, it's likely an accidental unique index
      // in the database (classes should be able to have multiple students). Provide
      // a clearer message and guidance to fix the DB index.
      if (field === 'classname') {
        console.error('Duplicate key on classname detected. This suggests an unintended unique index on Student.classname.');
        return res.status(400).json({
          msg: 'Duplicate key on classname detected. The database may have an unintended unique index on students.classname. Please remove the unique index so a class can contain multiple students.',
          field
        });
      }

      return res.status(400).json({ 
        msg: `A student with this ${field} already exists`,
        field 
      });
    }

    res.status(400).json({ msg: err.message });
  }
};

// Promote/demote teacher (principal)
exports.promoteTeacher = async (req, res) => {
  const { userId, newRole } = req.body;
  if (!['teacher', 'co-principal'].includes(newRole)) return res.status(400).json({ msg: 'Invalid role' });
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    user.role = newRole;
    await user.save();
    await createEnhancedLog('Promoted teacher', req.user, user, `New role: ${newRole}`);
    res.json({ msg: 'Role updated', user });
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

// Assign students to teacher (co-principal)
exports.assignStudents = async (req, res) => {
  const { teacherId, studentIds } = req.body;
  try {
    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== 'teacher') return res.status(404).json({ msg: 'Teacher not found' });
    teacher.studentsassigned = studentIds;
    await teacher.save();
    await createEnhancedLog('Assigned students to teacher', req.user, teacher, `Students: ${studentIds.length} assigned`);
    res.json({ msg: 'Students assigned', teacher });
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

// Change class/level assignments (principal)
exports.changeAssignment = async (req, res) => {
  const { userId, assignedclass, assignedlevel } = req.body;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    if (assignedclass) user.assignedclass = assignedclass;
    if (assignedlevel) user.assignedlevel = assignedlevel;
    await user.save();
    await Log.create({ action: 'changeAssignment', actor: req.user._id });
    res.json({ msg: 'Assignment updated', user });
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

// Export students at level 4 (principal)
exports.exportGraduates = async (req, res) => {
  try {
    const all = await Student.find({});
    const graduates = all.filter(s => (typeof s.getClassLevel === 'function' ? s.getClassLevel() : s.classLevel) === 4);
    if (!graduates.length) return res.status(404).json({ msg: 'No graduates found' });
    const csv = [
      'id,fullName,classLevel,classname,studentId,address,mother_phonenumber,father_phonenumber,birthdate',
      ...graduates.map(s => {
        const fullName = typeof s.getFullName === 'function' ? s.getFullName() : (s.fullName || '');
        const classLevel = typeof s.getClassLevel === 'function' ? s.getClassLevel() : (s.classLevel || '');
        const classname = typeof s.getClassname === 'function' ? s.getClassname() : (s.classname || '');
        const studentId = typeof s.getStudentId === 'function' ? s.getStudentId() : (s.studentId || '');
        const address = s.address || '';
        const mother = s.mother_phonenumber || '';
        const father = s.father_phonenumber || '';
        const bdate = s.birthdate ? (s.birthdate instanceof Date ? s.birthdate.toISOString() : String(s.birthdate)) : '';
        return `${s.id},${fullName},${classLevel},${classname},${studentId},${address},${mother},${father},${bdate}`;
      })
    ].join('\n');
    const filePath = path.join(__dirname, '../exports/graduates.csv');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, csv);
    await Log.create({ action: 'exportGraduates', actor: req.user._id });
    res.download(filePath);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Delete students (principal)
exports.deleteGraduates = async (req, res) => {
  try {
    // Cannot query encrypted classLevel directly. Fetch and delete matching docs.
    const docs = await Student.find({});
    const toDelete = docs.filter(s => (typeof s.getClassLevel === 'function' ? s.getClassLevel() : s.classLevel) === 4).map(s => s._id);
    if (toDelete.length) {
      await Student.deleteMany({ _id: { $in: toDelete } });
      await Log.create({ action: 'deleteGraduates', actor: req.user._id });
    }
    res.json({ msg: `Graduates deleted: ${toDelete.length}`, deleted: toDelete.length });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// View student data (role-based)
exports.getStudentData = async (req, res) => {
  const user = req.user;
  console.log('Fetching students for user role:', user.role);
  try {
    let students;
    if (user.role === 'admin' || user.role === 'principal') {
      // Fetch all and sort using decrypted getters
      const docs = await Student.find({});
      students = docs
        .map(s => ({ doc: s, level: typeof s.getClassLevel === 'function' ? s.getClassLevel() : s.classLevel, name: typeof s.getClassname === 'function' ? s.getClassname() : s.classname }))
        .sort((a, b) => (a.level - b.level) || String(a.name).localeCompare(String(b.name)))
        .map(x => x.doc);
      console.log('Admin/Principal access - fetching all students');
    } else if (user.role === 'co-principal') {
      const docs = await Student.find({});
      students = docs.filter(s => (typeof s.getClassLevel === 'function' ? s.getClassLevel() : s.classLevel) === user.assignedlevel)
                     .sort((a, b) => String((typeof a.getClassname==='function'?a.getClassname():a.classname)||'').localeCompare(String((typeof b.getClassname==='function'?b.getClassname():b.classname)||'')));
    } else if (user.role === 'teacher') {
      const docs = await Student.find({});
      const cleanUserClass = (user.assignedclass || '').replace(/^فصل\s+/, '').trim();
      students = docs.filter(s => {
        const sName = typeof s.getClassname === 'function' ? s.getClassname() : s.classname;
        const cleanSName = (sName || '').replace(/^فصل\s+/, '').trim();
        return cleanSName === cleanUserClass;
      }).sort((a, b) => String((typeof a.getFullName === 'function' ? a.getFullName() : (a.fullName||''))).localeCompare(String((typeof b.getFullName === 'function' ? b.getFullName() : (b.fullName||'')))));
    } else {
      return res.status(403).json({ msg: 'Unauthorized' });
    }
    // Log the action with enhanced details
    await createEnhancedLog(
      'Retrieved student data',
      user,
      null,
      `Found ${students.length} students for ${user.role}`,
      req
    );
    res.json(students);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Edit student data (role-based)
exports.editStudentData = async (req, res) => {
  const user = req.user;
  // Accept either id (Mongo _id) or _id from client
  const { id, _id, ...update } = req.body;
  const effectiveId = id || _id;
  console.log('editStudentData called by user=', req.user && { id: req.user.id, role: req.user.role }, 'payload id=', effectiveId);
  try {
    let student = await Student.findById(effectiveId);
    if (!student) return res.status(404).json({ msg: 'Student not found' });
  if (user.role === 'admin' ||
    user.role === 'principal' ||
    (user.role === 'co-principal' && (typeof student.getClassLevel === 'function' ? student.getClassLevel() : student.classLevel) === user.assignedlevel) ||
    (user.role === 'teacher' && (() => {
      const cleanUserClass = (user.assignedclass || '').replace(/^فصل\s+/, '').trim();
      const sName = typeof student.getClassname === 'function' ? student.getClassname() : student.classname;
      const cleanSName = (sName || '').replace(/^فصل\s+/, '').trim();
      return cleanSName === cleanUserClass;
    })())) {
      // If client included a password field, hash it and update the linked User account (if exists)
      if (update.password) {
        try {
          const plain = update.password;
          // remove password from student update so it isn't stored on Student model
          delete update.password;
          const hashed = await bcrypt.hash(plain, 10);
          // try to find a matching User by username (studentId) or googleCode
          const sid = typeof student.getStudentId === 'function' ? student.getStudentId() : student.studentId;
          const gcode = typeof student.getGoogleCode === 'function' ? student.getGoogleCode() : student.googlecode;
          const linkedUser = await User.findOne({ $or: [{ username: sid }, { googleCode: gcode }] });
          if (linkedUser) {
            linkedUser.password = hashed;
            // optional: clear mustResetPassword flag if present
            if (typeof linkedUser.mustResetPassword !== 'undefined') linkedUser.mustResetPassword = false;
            await linkedUser.save();
            await Log.create({ action: 'updateStudentPassword', actor: user._id, targetUser: linkedUser._id });
          } else {
            // no linked user found; just log for auditing
            await Log.create({ action: 'updateStudentPassword_attempt_without_user', actor: user._id, details: { studentId: student.id } });
          }
        } catch (pwErr) {
          console.error('Error hashing/updating linked user password:', pwErr);
          // continue to apply other updates to student but inform client
        }
      }

      // Sanitize update: prevent changing identifying or server-managed fields from client
      delete update._id;
      delete update.id;
      delete update.studentId;
      delete update.__v;
      delete update.createdAt;
      delete update.updatedAt;

      // Accept yearLevel from client and map to classLevel if provided
      if (update.yearLevel !== undefined && update.yearLevel !== null && update.yearLevel !== '') {
        const lvl = Number(update.yearLevel);
        if (!Number.isNaN(lvl)) update.classLevel = lvl;
        delete update.yearLevel;
      }

      // If classname is being updated, ensure the class exists
      if (update.classname) {
        const Class = require('../models/Class');
        // Because class fields are encrypted, we cannot query by name directly.
        // Fetch and match using decrypted virtual 'name'.
        const allClasses = await Class.find();
        const targetClass = allClasses.find(c => c.name === update.classname);
        if (!targetClass) return res.status(400).json({ msg: 'Class not found. Please select a valid class.', field: 'classname' });
        // Also set level from the matched class if not explicitly provided
        if (update.classLevel === undefined && typeof targetClass.level === 'number') {
          update.classLevel = targetClass.level;
        }
      }

      // Coerce numeric fields
      if (typeof update.classLevel !== 'undefined') update.classLevel = Number(update.classLevel);

      Object.assign(student, update);

      // Backfill legacy records missing numeric id/studentId to satisfy schema validation
      if (student.id === undefined || student.id === null) {
        try {
          const newId = await getNextId();
          student.id = newId;
          if (!student.studentId) {
            student.studentId = `ST${String(newId).padStart(3, '0')}`;
          }
        } catch (seqErr) {
          console.error('Failed to backfill student numeric id:', seqErr);
          return res.status(500).json({ msg: 'Failed to assign student numeric id' });
        }
      }
      try {
        await student.save();
      } catch (saveErr) {
        // Handle duplicate key errors cleanly
        if (saveErr && saveErr.code === 11000) {
          const dupField = Object.keys(saveErr.keyPattern || saveErr.keyValue || {})[0] || 'unknown';
          console.error('Duplicate key on edit:', dupField, saveErr);
          return res.status(400).json({ msg: `Duplicate key on ${dupField}`, field: dupField });
        }
        throw saveErr;
      }
  await Log.create({ action: 'editStudentData', actor: user._id });
  console.log('editStudentData: saved student', student._id);
  // Return a plain JSON object (apply toJSON to ensure virtuals are included
  // and encrypted fields are hidden) so clients receive a clean response.
  res.json(student.toJSON());
    } else {
      res.status(403).json({ msg: 'Unauthorized' });
    }
  } catch (err) {
    console.error('editStudentData error:', err);
    res.status(500).json({ msg: err.message });
  }
};

// Search students by name or studentId (safe fields only)
exports.searchStudents = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);
    const regex = new RegExp(q.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');

    // Because student fields are encrypted at rest, we cannot reliably query by
    // fullName or studentId at the database level. Fetch a reasonable batch and
    // filter in application code using the model getters (which decrypt values).
    const docs = await Student.find({}).limit(500);

    const filtered = docs.filter(s => {
      const name = typeof s.getFullName === 'function' ? s.getFullName() : (s.fullName || '');
      const sid = typeof s.getStudentId === 'function' ? s.getStudentId() : (s.studentId || '');
      return regex.test(String(name)) || regex.test(String(sid));
    }).slice(0, 50);

    const out = filtered.map(s => ({
      id: s.id,
      fullName: typeof s.getFullName === 'function' ? s.getFullName() : s.fullName,
      studentId: typeof s.getStudentId === 'function' ? s.getStudentId() : s.studentId,
      classname: typeof s.getClassname === 'function' ? s.getClassname() : s.classname,
      classLevel: typeof s.getClassLevel === 'function' ? s.getClassLevel() : s.classLevel,
      _id: s._id
    }));
    res.json(out);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

exports.bulkDeleteStudents = async (req, res) => {
  try {
    if (!req.user || (req.user.role !== 'principal' && req.user.role !== 'admin')) {
      return res.status(403).json({ msg: 'Only principal or admin can bulk delete students' });
    }
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (!ids.length) return res.status(400).json({ msg: 'No ids provided' });
    const Student = require('../models/Student');
    const Class = require('../models/Class');
    const { releaseId } = require('../services/idManager');
    let deleted = [];
    for (const id of ids) {
      const student = await Student.findById(id);
      if (!student) continue;
      // Remove from classes
      await Class.updateMany({ students: student._id }, { $pull: { students: student._id } });
      await Student.findByIdAndDelete(id);
      await releaseId(student.id);
      try {
        const name = typeof student.getFullName === 'function' ? student.getFullName() : (student.fullName || '');
        await createEnhancedLog('Bulk deleted student', req.user, null, `Deleted student ${name} (id=${id})`, req);
      } catch (e) { /* ignore logging error */ }
      deleted.push(id);
    }
    res.json({ msg: `Deleted ${deleted.length} students`, deleted });
  } catch (err) {
    console.error('Bulk delete students error:', err);
    res.status(500).json({ msg: err.message });
  }
};