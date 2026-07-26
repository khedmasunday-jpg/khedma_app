const cron = require('node-cron');
const Student = require('../models/Student');
const Class = require('../models/Class');
const fs = require('fs');
const path = require('path');

cron.schedule('0 2 14 9 *', async () => {
  try {    
    
    const allStudents = await Student.find({});
    for (const s of allStudents) {
      const level = typeof s.getClassLevel === 'function' ? s.getClassLevel() : s.classLevel;
      if ([1,2,3,4,5].includes(level)) {
        s.classLevel = level + 1; 
        await s.save();
      }
    }

    const gradsSource = await Student.find({});
    const graduates = gradsSource.filter(s => (typeof s.getClassLevel === 'function' ? s.getClassLevel() : s.classLevel) === 6);
    if (graduates.length > 0) {      
      
      const csv = [
        'id,fullName,classLevel,classname,studentId,address,mother_phonenumber,father_phonenumber,birthdate',
        ...graduates.map(s => `${s.id},${s.fullName},${s.classLevel},${s.classname},${s.studentId},${s.address},${s.mother_phonenumber},${s.father_phonenumber},${s.birthdate}`)
      ].join('\n');
      
      const filePath = path.join(__dirname, '../exports/graduates.csv');
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, csv);    }

    await updateClassAssignments();  } catch (err) {
    console.error('❌ Promotion/export error:', err);
  }
});

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
        await targetClass.save();      }
    }
  } catch (err) {
    console.error('❌ Error updating class assignments:', err);
  }
} 