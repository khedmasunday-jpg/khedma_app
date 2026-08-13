const Student = require('../models/Student');
const Class = require('../models/Class');
const Logger = require('../utils/logger');

const runPromotionJob = async (adminUser) => {
  try {
    Logger.info('JOB_STARTED', { jobName: 'promotion', triggeredBy: adminUser.username });
    
    // 1. Increment class level for all students from 1 to 5
    const allStudents = await Student.find({});
    for (const s of allStudents) {
      const level = typeof s.getClassLevel === 'function' ? s.getClassLevel() : s.classLevel;
      if ([1,2,3,4,5].includes(level)) {
        s.classLevel = level + 1; 
        await s.save();
      }
    }

    // 2. Export graduates (level 6) to CSV string
    const gradsSource = await Student.find({});
    const graduates = gradsSource.filter(s => (typeof s.getClassLevel === 'function' ? s.getClassLevel() : s.classLevel) === 6);
    
    let csvData = '';
    if (graduates.length > 0) {      
      csvData = [
        'id,fullName,classLevel,classname,studentId,address,mother_phonenumber,father_phonenumber,birthdate',
        ...graduates.map(s => `${s.id},${s.fullName},${s.classLevel},${s.classname},${s.studentId},${s.address},${s.mother_phonenumber},${s.father_phonenumber},${s.birthdate}`)
      ].join('\n');
    }

    // 3. Update class assignments
    await updateClassAssignments();

    Logger.info('JOB_COMPLETED', { jobName: 'promotion', recordsProcessed: allStudents.length });
    
    return { success: true, csvData, graduatesCount: graduates.length };
  } catch (err) {
    Logger.error('JOB_FAILED', { jobName: 'promotion', error: err.message });
    console.error('❌ Promotion/export error:', err);
    throw err;
  }
};

async function updateClassAssignments() {
  try {
    const classes = await Class.find().sort({ level: 1 });
    for (let level = 1; level <= 6; level++) {
      const docs = await Student.find({});
      const students = docs.filter(s => (typeof s.getClassLevel === 'function' ? s.getClassLevel() : s.classLevel) === level);
      const targetClass = classes.find(c => c.level === level);
      
      if (targetClass && students.length > 0) {
        for (const s of students) {
          s.classname = targetClass.name; 
          await s.save();
        }
        targetClass.students = students.map(s => s._id);
        await targetClass.save();
      }
    }
  } catch (err) {
    console.error('❌ Error updating class assignments:', err);
  }
} 

module.exports = { runPromotionJob };