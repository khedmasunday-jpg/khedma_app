
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Class = require('../models/Class');
const Student = require('../models/Student');
const Log = require('../models/Log');
const mongoose = require('mongoose');
const crypto = require('crypto');

function getAesKey() {
  const secret = process.env.AES_SECRET_KEY || process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error('Missing AES_SECRET_KEY in .env');
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptField(value) {
  if (value === undefined || value === null) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', getAesKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    data: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

function hashField(value) {
  if (value === undefined || value === null) return null;
  return crypto.createHmac('sha256', AES_SECRET).update(String(value)).digest('hex');
}

function isoToDDMMYYYY(iso) {
  try {
    if (!iso || typeof iso !== 'string') return iso;
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return iso;
    return `${m[3]}-${m[2]}-${m[1]}`;
  } catch (e) { return iso; }
}

exports.markAttendance = async (req, res) => {
  const { classId } = req.params;
  const { students, performedBy: bodyPerformedBy, targetClass: bodyTargetClass, timestamp: bodyTimestamp } = req.body; 

  if (!Array.isArray(students)) return res.status(400).json({ msg: 'Invalid student list' });
  if (students.length === 0) return res.status(400).json({ msg: 'No students to mark' });

  try {
    const user = req.user;

    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({ msg: 'Invalid classId' });
    }

    const foundClass = await Class.findById(classId);
    if (!foundClass) return res.status(404).json({ msg: 'Class not found' });

    if (user.role === 'teacher') {
      const isAssignedByRef = foundClass.teacher && foundClass.teacher.toString() === String(user.id);
      const cleanUserClass = (user.assignedclass || '').replace(/^فصل\s+/, '').trim();
      const cleanClassName = (foundClass.name || '').replace(/^فصل\s+/, '').trim();
      const isAssignedByName = cleanUserClass && cleanClassName && cleanClassName === cleanUserClass;
      if (!isAssignedByRef && !isAssignedByName) {
        return res.status(403).json({ msg: 'Unauthorized (teacher)' });
      }
    } else if (user.role === 'co-principal') {
      
      let year;
      if (user.assignedlevel && [1, 2, 3].includes(user.assignedlevel)) {
        year = user.assignedlevel;
      } else {
        year = Math.ceil((user.assignedlevel || 1) / 2);
      }
      if (foundClass.year !== year) {
        return res.status(403).json({ msg: 'Unauthorized (co-principal)' });
      }
    } else if (user.role !== 'principal' && user.role !== 'teacher' && user.role !== 'co-principal') {
      return res.status(403).json({ msg: 'Unauthorized role' });
    }

    let dateKey = null;
    if (req.body && typeof req.body.date === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(req.body.date)) {
      dateKey = req.body.date;
    } else {
      const dateObj = bodyTimestamp ? new Date(bodyTimestamp) : new Date();
      if (isNaN(dateObj.getTime())) return res.status(400).json({ msg: 'Invalid timestamp provided' });
      dateKey = dateObj.toISOString().split('T')[0];
    }

    const normalizedStudents = students
      .filter(s => s && s.studentId && mongoose.Types.ObjectId.isValid(String(s.studentId)))
      .map(s => ({ studentId: String(s.studentId), status: s.status }));

    if (normalizedStudents.length === 0) {
      return res.status(400).json({ msg: 'No valid students to mark' });
    }

    const classHash = hashField(classId);
    const dateHash = hashField(dateKey);
    const studentHashes = normalizedStudents.map(s => ({ id: s.studentId, hash: hashField(s.studentId) }));

    const existingRecords = await Attendance.find({
      class_hash: classHash,
      date_hash: dateHash,
      student_hash: { $in: studentHashes.map(h => h.hash) }
    });

    const existingMap = new Map();
    for (const rec of existingRecords) {
      try {
        const studentVal = rec.student; 
        const statusVal = rec.status; 
        const sh = hashField(studentVal);
        existingMap.set(sh, statusVal);
      } catch (e) {
        
      }
    }

    const bulkOps = normalizedStudents.map(({ studentId, status }) => {
      const finalStatus = status === 'absent' ? 'absent' : 'present';
      const encClass = encryptField(classId);
      const encDate = encryptField(dateKey);
      const encStudent = encryptField(studentId);
      const encStatus = encryptField(finalStatus);
      const sh = hashField(studentId);
      return {
        updateOne: {
          filter: {
            class_hash: classHash,
            student_hash: sh,
            date_hash: dateHash
          },
          update: {
            $set: {
              class_enc: encClass,
              student_enc: encStudent,
              date_enc: encDate,
              status_enc: encStatus,
              class_hash: classHash,
              student_hash: sh,
              date_hash: dateHash
            }
          },
          upsert: true
        }
      };
    });

    await Attendance.bulkWrite(bulkOps);

    for (const { studentId, status } of normalizedStudents) {
      try {
        const finalStatus = status === 'absent' ? 'absent' : 'present';
        const sh = hashField(studentId);
        const priorStatus = existingMap.get(sh); 

        if (priorStatus === finalStatus) {

          if (finalStatus === 'absent') {
            await Student.updateOne({ _id: studentId }, { $set: { lastAbsentDate: dateKey } }, { runValidators: false });
          } else if (finalStatus === 'present') {
            await Student.updateOne({ _id: studentId }, { $set: { lastAttendanceDate: dateKey } }, { runValidators: false });
          }
          continue;
        }

        if (!priorStatus) {
          
          if (finalStatus === 'present') {
            
            await Student.updateOne({ _id: studentId }, { $inc: { totalAttendance: 1 }, $set: { lastAttendanceDate: dateKey } }, { runValidators: false });

            try {
              const alt = isoToDDMMYYYY(dateKey);
              await Student.updateOne({ _id: studentId, lastAbsentDate: { $in: [dateKey, alt] } }, { $set: { lastAbsentDate: null } });
            } catch (e) {
              
            }
          } else if (finalStatus === 'absent') {
            await Student.updateOne({ _id: studentId }, { $set: { lastAbsentDate: dateKey } }, { runValidators: false });
          }
        } else {
          
          if (priorStatus === 'present' && finalStatus === 'absent') {
            
            await Student.updateOne({ _id: studentId }, { $inc: { totalAttendance: -1 }, $set: { lastAbsentDate: dateKey } }, { runValidators: false });
          } else if (priorStatus !== 'present' && finalStatus === 'present') {
            
            await Student.updateOne({ _id: studentId }, { $inc: { totalAttendance: 1 }, $set: { lastAttendanceDate: dateKey } }, { runValidators: false });
            
            try {
              const alt = isoToDDMMYYYY(dateKey);
              await Student.updateOne({ _id: studentId, lastAbsentDate: { $in: [dateKey, alt] } }, { $set: { lastAbsentDate: null } });
            } catch (e) {
              
            }
          } else if (finalStatus === 'absent') {
            
            await Student.updateOne({ _id: studentId }, { $set: { lastAbsentDate: dateKey } }, { runValidators: false });
          }
        }
      } catch (e) {
        console.warn('Skipping student during attendance update:', studentId, e.message);
      }
      
      try {
        const sh = hashField(studentId);
        const allRecs = await Attendance.find({ student_hash: sh });
        let presentTotal = 0;
        for (const r of allRecs) {
          try {
            const st = r.status; 
            if (st === 'present' || st === true || st === '1') presentTotal++;
          } catch (er) {
            
          }
        }
        await Student.updateOne({ _id: studentId }, { $set: { totalAttendance: presentTotal } }, { runValidators: false });
      } catch (errTotal) {
        
      }
    }
    res.status(200).json({ msg: 'Attendance recorded' });
    
    (async () => {
      try {
        const presentCount = normalizedStudents.filter(s => s.status === 'present').length;
        const absentCount = normalizedStudents.length - presentCount;

        let performedById = user._id;
        let performedByName = user.fullName || user.username || 'Unknown';
        let performedByRole = user.role || 'Unknown';
        if (bodyPerformedBy && bodyPerformedBy.id) {
          
          try {
            if (mongoose.Types.ObjectId.isValid(String(bodyPerformedBy.id))) {
              performedById = bodyPerformedBy.id;
            }
          } catch (e) {
            
          }
        }
        if (bodyPerformedBy && bodyPerformedBy.name) performedByName = bodyPerformedBy.name;
        if (bodyPerformedBy && bodyPerformedBy.role) performedByRole = bodyPerformedBy.role;

        const logEntry = {
          action: 'TAKE_ATTENDANCE',
          actor: user._id,
          performedBy: performedById,
          timestamp: bodyTimestamp ? new Date(bodyTimestamp) : new Date(),
          details: `Recorded attendance for class ${foundClass.name} (${normalizedStudents.length} student(s)): ${presentCount} present, ${absentCount} absent`,
          ip: req.ip || 'unknown',
          userAgent: req.get('user-agent') || 'unknown',
          actorName: user.fullName || user.username || 'Unknown',
          actorRole: user.role || 'Unknown',
          
          performedByName: performedByName,
          performedByRole: performedByRole,
          
          targetClass: foundClass._id,
          targetClassName: foundClass.name,
          targetUserName: foundClass.name,
          targetUserRole: 'class'
        };

        const createWithRetry = async (entry, attempts = 2, delayMs = 500) => {
          for (let i = 0; i < attempts; i++) {
            try {
              await Log.create(entry);
              return;
            } catch (e) {
              console.error(`Attendance log creation attempt ${i + 1} failed:`, e && e.stack ? e.stack : e);
              if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs));
            }
          }
          console.error('Attendance log creation failed after retries. Entry:', JSON.stringify({ action: 'TAKE_ATTENDANCE', targetClass: foundClass._id, actor: user._id }));
        };

        await createWithRetry(logEntry, 3, 500);
      } catch (logErr) {
        console.error('Unexpected error while creating attendance log (background):', logErr && logErr.stack ? logErr.stack : logErr);
      }
    })();
  } catch (err) {
    console.error('Error recording attendance:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.getAttendance = async (req, res) => {
  try {
    const { classId, date } = req.query;
    
    const query = {};
    if (classId) query.class_hash = hashField(classId);
    if (date) query.date_hash = hashField(date);

    let records = await Attendance.find(query);

    if ((!records || records.length === 0) && (classId || date)) {
      const all = await Attendance.find({});
      records = all.filter(r => {
        try {
          const rvClass = r.class; 
          const rvDate = r.date; 
          const matchClass = classId ? String(rvClass) === String(classId) : true;
          const matchDate = date ? String(rvDate) === String(date) : true;
          return matchClass && matchDate;
        } catch (e) { return false; }
      });
    }

    res.json(records);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getStats = async (req, res) => {
  try {
    const { classId, startDate, endDate } = req.query;
    const query = {};
    if (classId) query.class = classId;
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }
    
    const stats = await Attendance.aggregate([
      { $match: query },
      { $group: {
        _id: "$student",
        totalDays: { $sum: 1 },
        presentDays: { 
          $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] }
        }
      }}
    ]);
    
    res.json(stats);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const { studentId, startDate, endDate } = req.query;
    const query = { student: studentId };
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }
    
    const history = await Attendance.find(query)
      .sort({ date: -1 })
      .populate('class', 'name');
    
    res.json(history);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getToday = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const records = await Attendance.find({ date: today })
      .populate('student', 'fullName')
      .populate('class', 'name');
    
    res.json(records);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.resetClassDate = async (req, res) => {
  try {
    const user = req.user;
    const { classId, date } = req.body || {};
    if (!classId) return res.status(400).json({ msg: 'Missing classId' });
    if (!date || typeof date !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) {
      return res.status(400).json({ msg: 'Missing or invalid date (expected YYYY-MM-DD)' });
    }

    if (!mongoose.Types.ObjectId.isValid(classId)) return res.status(400).json({ msg: 'Invalid classId' });
    const foundClass = await Class.findById(classId);
    if (!foundClass) return res.status(404).json({ msg: 'Class not found' });

    const classHash = hashField(classId);
    const dateHash = hashField(date);

    let records = await Attendance.find({ class_hash: classHash, date_hash: dateHash });
    
    if ((!records || records.length === 0)) {
      const all = await Attendance.find({});
      records = all.filter(r => {
        try {
          const rvClass = r.class;
          const rvDate = r.date;
          
          return String(rvClass) === String(classId) && String(rvDate) === String(date);
        } catch (e) { return false; }
      });
    }

    let adjustedStudents = 0;
    let clearedLastAbsent = 0;
    const studentIdsToProcess = [];
    for (const rec of records) {
      try {
        const studentIdVal = rec.student; 
        const statusVal = rec.status; 
        if (!studentIdVal) continue;
        
        studentIdsToProcess.push({ id: studentIdVal, status: statusVal });
      } catch (e) {
        
      }
    }

    for (const s of studentIdsToProcess) {
      try {
        const sid = s.id;
        const status = s.status;
        if (status === 'present') {
          
          await Student.updateOne({ _id: sid }, { $inc: { totalAttendance: -1 } }, { runValidators: false });
          
          await Student.updateOne({ _id: sid, totalAttendance: { $lt: 0 } }, { $set: { totalAttendance: 0 } });
          adjustedStudents++;
        } else if (status === 'absent') {
          
          const altDate = isoToDDMMYYYY(date);
          const resu = await Student.updateOne({ _id: sid, lastAbsentDate: { $in: [date, altDate] } }, { $set: { lastAbsentDate: null } });
          if (resu && (resu.modifiedCount || resu.nModified || resu.modified)) clearedLastAbsent++;
        }
      } catch (e) {
        console.warn('Error adjusting student during reset:', e.message || e);
      }
    }

    const delRes = await Attendance.deleteMany({ class_hash: classHash, date_hash: dateHash });
    const deletedCount = (delRes && (delRes.deletedCount || delRes.n || delRes.result && delRes.result.n)) || 0;

    await Log.create({
      action: 'Reset attendance for class/date',
      performedBy: user._id,
      actorName: user.fullName || user.username || 'Unknown',
      actorRole: user.role || 'Unknown',
      details: `Deleted ${deletedCount} attendance records for class ${foundClass.name} on ${date}. Adjusted ${adjustedStudents} present counters, cleared ${clearedLastAbsent} lastAbsentDate entries.`,
    });

    res.json({ msg: 'Attendance reset for class/date', deletedCount, adjustedStudents, clearedLastAbsent });
  } catch (err) {
    console.error('Error resetting class/date attendance:', err && err.stack ? err.stack : err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};
