const cron = require('node-cron');
const Student = require('../models/Student');
const Class = require('../models/Class');
const fs = require('fs');
const path = require('path');

// Run yearly on September 14th at 2:00 AM
cron.schedule('0 2 14 9 *', async () => {
  try {
    console.log('🎓 Starting yearly promotion process...');
    
    // Promote students through the 6-class system (decrypt-aware)
    const allStudents = await Student.find({});
    for (const s of allStudents) {
      const level = typeof s.getClassLevel === 'function' ? s.getClassLevel() : s.classLevel;
      if ([1,2,3,4,5].includes(level)) {
        s.classLevel = level + 1; // triggers pre-save encrypt hook
        await s.save();
      }
    }

    // Find students who reached class 6 (final class)
    const gradsSource = await Student.find({});
    const graduates = gradsSource.filter(s => (typeof s.getClassLevel === 'function' ? s.getClassLevel() : s.classLevel) === 6);
    if (graduates.length > 0) {
      console.log(`🎓 Found ${graduates.length} students ready for graduation`);
      
      // Export graduates to CSV
      const csv = [
        'id,fullName,classLevel,classname,studentId,address,mother_phonenumber,father_phonenumber,birthdate',
        ...graduates.map(s => `${s.id},${s.fullName},${s.classLevel},${s.classname},${s.studentId},${s.address},${s.mother_phonenumber},${s.father_phonenumber},${s.birthdate}`)
      ].join('\n');
      
      const filePath = path.join(__dirname, '../exports/graduates.csv');
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, csv);
      
      console.log(`📄 Graduates exported to: ${filePath}`);
    }
    
    // Update class assignments for students
    await updateClassAssignments();
    
    console.log('🎓 Yearly promotion and export complete.');
  } catch (err) {
    console.error('❌ Promotion/export error:', err);
  }
});

// Helper function to update class assignments based on new levels
async function updateClassAssignments() {
  try {
    // Get all classes
    const classes = await Class.find().sort({ level: 1 });
    
    // Update student class assignments
    for (let level = 1; level <= 6; level++) {
      const docs = await Student.find({});
      const students = docs.filter(s => (typeof s.getClassLevel === 'function' ? s.getClassLevel() : s.classLevel) === level);
      const targetClass = classes.find(c => c.level === level);
      
      if (targetClass && students.length > 0) {
        // Update classname for students
        for (const s of students) {
          s.classname = targetClass.name; // pre-save encrypt hook
          await s.save();
        }
        
        // Update class students array
        targetClass.students = students.map(s => s._id);
        await targetClass.save();
        
        console.log(`📚 Updated ${students.length} students for ${targetClass.name}`);
      }
    }
  } catch (err) {
    console.error('❌ Error updating class assignments:', err);
  }
} 