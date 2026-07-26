const Student = require('../models/Student');
const User = require('../models/User');
const Log = require('../models/Log');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { releaseId, getNextId, getNextIdBatch } = require('../services/idManager');

async function createEnhancedLog(action, actor, targetUser = null, additionalDetails = '', req = null) {
  try {
    const sanitize = (v) => {
      if (v === undefined || v === null) return '';
      return String(v).replace(/^\s+|\s+$/g, '');
    };

    const ipVal = req ? (req.headers['x-forwarded-for'] || req.connection.remoteAddress) : 'unknown';
    const userAgentVal = req ? (req.headers['user-agent'] || 'unknown') : 'unknown';

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

exports.deleteStudent = async (req, res) => {
  try {

    if (!req.user || (req.user.role !== 'principal' && req.user.role !== 'admin')) {      return res.status(403).json({ msg: 'Only principal or admin may delete students' });
    }

    const student = await Student.findById(req.params.id);
    if (!student) {      return res.status(404).json({ error: 'Student not found' });
    }

    const Class = require('../models/Class');
    await Class.updateMany({ students: student._id }, { $pull: { students: student._id } });

    await Student.findByIdAndDelete(req.params.id);
    await releaseId(student.id); 

    try {
      const name = typeof student.getFullName === 'function' ? student.getFullName() : (student.fullName || '');
      await createEnhancedLog('Deleted student', req.user, null, `Deleted student ${name}`, req);
    } catch (logErr) {
      console.error('Failed to create delete log:', logErr);
    }    res.json({ msg: 'Student deleted' });
  } catch (err) {
    console.error('Delete student error:', err);
    res.status(500).json({ error: err.message });
  }
};

const formatStudentId = (id) => `ST${String(id).padStart(3, '0')}`;

exports.bulkAddStudents = async (req, res) => {
  try {
    if (!Array.isArray(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'Request body must be a non-empty array' });
    }

    const Class = require('../models/Class');

    const allClasses = await Class.find();

    const validatedStudents = [];
    for (const stu of req.body) {
      
      if (!stu.fullName || !stu.classLevel || !stu.classname) {
        continue; 
      }

      const targetClass = allClasses.find(c => c.name === stu.classname);
      if (!targetClass) {
        continue; 
      }

      if (targetClass.year !== undefined && Number(stu.classLevel) !== Number(targetClass.year)) {
        continue; 
      }

      if (req.user.role === 'co-principal' && targetClass.year !== req.user.assignedlevel) {
        continue; // Skip adding to unauthorized levels
      }
      
      validatedStudents.push({ stu, targetClass });
    }

    if (validatedStudents.length === 0) {
      return res.status(400).json({ error: 'No valid students to add' });
    }

    let students;
    let attempts = 0;
    const maxRetries = 3;
    
    while (attempts < maxRetries) {
      try {
        const ids = await getNextIdBatch(validatedStudents.length);        
        
        const toInsert = [];
        for (let i = 0; i < validatedStudents.length; i++) {
          const id = ids[i];
          const studentId = `ST${String(id).padStart(3, '0')}`;

          const exists = await Student.findOne({ studentId }).lean();
          if (exists) {
            throw new Error(`StudentId ${studentId} already exists`);
          }

          toInsert.push({
            ...validatedStudents[i].stu,
            id,
            studentId
          });
        }

        students = [];
        for (const doc of toInsert) {
          try {
            const created = await Student.create(doc);
            students.push(created);
          } catch (singleErr) {
            console.error('Error creating student in bulkAddStudents for studentId=', doc.studentId || doc.id, singleErr && singleErr.stack ? singleErr.stack : singleErr);
            
            throw singleErr;
          }
        }
        break; 
      } catch (insertErr) {
        attempts++;
        console.error(`bulkAddStudents attempt ${attempts} error:`, insertErr && insertErr.stack ? insertErr.stack : insertErr);
        if (attempts >= maxRetries) {
          console.error('Failed to insert students after retries:', insertErr);
          
          return res.status(400).json({ 
            error: 'Failed to add students. Please try again or submit students in smaller batches.',
            details: insertErr && insertErr.message ? insertErr.message : String(insertErr)
          });
        }        
        await new Promise(resolve => setTimeout(resolve, 100 * attempts));
        continue;
      }
    }

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

    for (const { class: targetClass, studentIds } of classUpdates.values()) {
      targetClass.students.push(...studentIds);
      await targetClass.save();
    }

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

exports.addStudent = async (req, res) => {
  try {    
    
    const requiredFields = ['fullName', 'classLevel', 'classname', 'address'];
    const missingFields = requiredFields.filter(field => !req.body[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({ 
        msg: `Missing required fields: ${missingFields.join(', ')}`,
        missingFields 
      });
    }

    const Class = require('../models/Class');

    const allClasses = await Class.find();
    const targetClass = allClasses.find(c => c.name === req.body.classname);
    if (!targetClass) {
      return res.status(400).json({
        msg: 'Class not found. Please select a valid class.',
        field: 'classname'
      });
    }

    if (req.body.classLevel !== undefined && targetClass.year !== undefined) {
      if (Number(req.body.classLevel) !== Number(targetClass.year)) {
        return res.status(400).json({
          msg: `Class level mismatch. The class "${req.body.classname}" is for year ${targetClass.year}, but you provided classLevel ${req.body.classLevel}.`,
          field: 'classLevel'
        });
      }
    }

    if (req.user.role === 'co-principal') {
      const allowedLevel = req.user.assignedlevel;
      if (targetClass.year !== allowedLevel) {
        return res.status(403).json({
          msg: `Unauthorized: You can only add students to level ${allowedLevel} classes.`,
          field: 'classname'
        });
      }
    }

  if (Object.prototype.hasOwnProperty.call(req.body, 'studentId')) delete req.body.studentId;

    let student;
    let attempts = 0;
    const maxRetries = 5;
    const studentData = { ...req.body }; 
    
    while (attempts < maxRetries) {
      try {
        
        if (attempts > 0) {
          const newId = await getNextId();
          studentData.id = newId;
          studentData.studentId = `ST${String(newId).padStart(3, '0')}`;
        }

        student = new Student(studentData);        await student.save();        break; 
      } catch (saveErr) {
        
        if (saveErr.code === 11000 && saveErr.keyPattern && 
            (saveErr.keyPattern.studentId || saveErr.keyPattern.id)) {
          attempts++;
          if (attempts >= maxRetries) {
            
            return res.status(400).json({ 
              msg: 'Failed to generate unique student ID after multiple attempts. Please try again.',
              field: 'studentId'
            });
          }
          const field = saveErr.keyPattern.studentId ? 'studentId' : 'id';          
          await new Promise(resolve => setTimeout(resolve, 50 * attempts));
          
          continue;
        }
        
        throw saveErr;
      }
    }

    targetClass.students.push(student._id);
    await targetClass.save();
  
  const logDetails = `Added student: ${typeof student.getFullName === 'function' ? student.getFullName() : (student.fullName || '')}, Class: ${typeof student.getClassname === 'function' ? student.getClassname() : (student.classname || '')}, Level: ${typeof student.getClassLevel === 'function' ? student.getClassLevel() : (student.classLevel || '')}`;
    await createEnhancedLog('Added student', req.user, null, logDetails, req);

    res.status(201).json(student);
  } catch (err) {
    
    if (err.code === 11000) {
      
      const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'unknown_field';

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

exports.deleteGraduates = async (req, res) => {
  try {
    
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

exports.getStudentData = async (req, res) => {
  const user = req.user;
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);

    let students;
    if (user.role === 'admin' || user.role === 'principal') {
      const docs = await Student.find({});
      students = docs
        .map(s => ({ doc: s, level: typeof s.getClassLevel === 'function' ? s.getClassLevel() : s.classLevel, name: typeof s.getClassname === 'function' ? s.getClassname() : s.classname }))
        .sort((a, b) => (a.level - b.level) || String(a.name).localeCompare(String(b.name)))
        .map(x => x.doc);
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

    const total = students.length;
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;
    const paginatedStudents = students.slice(skip, skip + limit);

    await createEnhancedLog(
      'Retrieved student data',
      user,
      null,
      `Found ${total} students for ${user.role} (page ${page}/${totalPages})`,
      req
    );

    if (req.query.page || req.query.limit) {
      res.json({
        students: paginatedStudents,
        total,
        page,
        limit,
        totalPages,
        hasMore: page < totalPages
      });
    } else {
      res.json(students);
    }
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.editStudentData = async (req, res) => {
  const user = req.user;
  
  const { id, _id, ...update } = req.body;
  const effectiveId = id || _id;  try {
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
      
      if (update.password) {
        try {
          const plain = update.password;
          
          delete update.password;
          const hashed = await bcrypt.hash(plain, 10);
          
          const sid = typeof student.getStudentId === 'function' ? student.getStudentId() : student.studentId;
          const gcode = typeof student.getGoogleCode === 'function' ? student.getGoogleCode() : student.googlecode;
          const linkedUser = await User.findOne({ $or: [{ username: sid }, { googleCode: gcode }] });
          if (linkedUser) {
            linkedUser.password = hashed;
            
            if (typeof linkedUser.mustResetPassword !== 'undefined') linkedUser.mustResetPassword = false;
            await linkedUser.save();
            await Log.create({ action: 'updateStudentPassword', actor: user._id, targetUser: linkedUser._id });
          } else {
            
            await Log.create({ action: 'updateStudentPassword_attempt_without_user', actor: user._id, details: { studentId: student.id } });
          }
        } catch (pwErr) {
          console.error('Error hashing/updating linked user password:', pwErr);
          
        }
      }

      delete update._id;
      delete update.id;
      delete update.studentId;
      delete update.__v;
      delete update.createdAt;
      delete update.updatedAt;

      if (update.yearLevel !== undefined && update.yearLevel !== null && update.yearLevel !== '') {
        const lvl = Number(update.yearLevel);
        if (!Number.isNaN(lvl)) update.classLevel = lvl;
        delete update.yearLevel;
      }

      if (update.classname) {
        const Class = require('../models/Class');

        const allClasses = await Class.find();
        const targetClass = allClasses.find(c => c.name === update.classname);
        if (!targetClass) return res.status(400).json({ msg: 'Class not found. Please select a valid class.', field: 'classname' });
        
        if (update.classLevel === undefined && typeof targetClass.level === 'number') {
          update.classLevel = targetClass.level;
        }
      }

      if (typeof update.classLevel !== 'undefined') update.classLevel = Number(update.classLevel);

      Object.assign(student, update);

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
        
        if (saveErr && saveErr.code === 11000) {
          const dupField = Object.keys(saveErr.keyPattern || saveErr.keyValue || {})[0] || 'unknown';
          console.error('Duplicate key on edit:', dupField, saveErr);
          return res.status(400).json({ msg: `Duplicate key on ${dupField}`, field: dupField });
        }
        throw saveErr;
      }
  await Log.create({ action: 'editStudentData', actor: user._id });  
  
  res.json(student.toJSON());
    } else {
      res.status(403).json({ msg: 'Unauthorized' });
    }
  } catch (err) {
    console.error('editStudentData error:', err);
    res.status(500).json({ msg: err.message });
  }
};

exports.searchStudents = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);
    const regex = new RegExp(q.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');

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
      
      await Class.updateMany({ students: student._id }, { $pull: { students: student._id } });
      await Student.findByIdAndDelete(id);
      await releaseId(student.id);
      try {
        const name = typeof student.getFullName === 'function' ? student.getFullName() : (student.fullName || '');
        await createEnhancedLog('Bulk deleted student', req.user, null, `Deleted student ${name} (id=${id})`, req);
      } catch (e) {  }
      deleted.push(id);
    }
    res.json({ msg: `Deleted ${deleted.length} students`, deleted });
  } catch (err) {
    console.error('Bulk delete students error:', err);
    res.status(500).json({ msg: err.message });
  }
};