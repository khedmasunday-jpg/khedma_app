const express = require('express');
const router = express.Router();
const xlsx = require('xlsx');
const Student = require('../models/Student');
const User = require('../models/User');
const Class = require('../models/Class');
const { authorizeRoles } = require('../middleware/auth');

// Endpoint to promote students and teachers, and download graduates as Excel
router.post('/promote-all', authorizeRoles('admin', 'principal'), async (req, res) => {
  try {
    const allStudents = await Student.find({});
    
    // 1. Handle Graduates (Year 3: Level 5 and 6)
    const graduates = allStudents.filter(s => {
      const level = typeof s.getClassLevel === 'function' ? s.getClassLevel() : s.classLevel;
      return level === 5 || level === 6;
    });
    
    let excelBuffer = null;
    if (graduates.length > 0) {
      const exportData = graduates.map(s => ({
        ID: s.id || '',
        Name: s.getFullName ? s.getFullName() : s.fullName,
        Class: s.getClassname ? s.getClassname() : s.classname,
        StudentID: s.getStudentId ? s.getStudentId() : s.studentId,
        Address: s.address || '',
        MotherPhone: s.mother_phonenumber || '',
        FatherPhone: s.father_phonenumber || '',
        Birthdate: s.birthdate ? new Date(s.birthdate).toLocaleDateString() : ''
      }));
      
      const ws = xlsx.utils.json_to_sheet(exportData);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Graduates");
      excelBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
      
      // Delete graduates from the system
      const graduateIds = graduates.map(s => s._id);
      await Student.deleteMany({ _id: { $in: graduateIds } });
    }
    
    // 2. Promote remaining students
    const remainingStudents = await Student.find({});
    for (const s of remainingStudents) {
      const level = typeof s.getClassLevel === 'function' ? s.getClassLevel() : s.classLevel;
      
      // Chain A: Level 1 -> 4 -> 6
      if (level === 1) {
        s.classLevel = 4;
        s.classname = 'الملاك ميخائيل';
      } else if (level === 4) {
        s.classLevel = 6;
        s.classname = 'الملاك غبريال';
      }
      // Chain B: Level 2 -> 3 -> 5
      else if (level === 2) {
        s.classLevel = 3;
        s.classname = 'الملاك رفائيل';
      } else if (level === 3) {
        s.classLevel = 5;
        s.classname = 'الملاك سوريال';
      }
      
      await s.save();
    }
    
    // 3. Promote Teachers and Co-Principals
    const staff = await User.find({ role: { $in: ['teacher', 'co-principal'] } });
    for (const user of staff) {
      if (user.assignedlevel === 1) {
        user.assignedlevel = 2;
      } else if (user.assignedlevel === 2) {
        user.assignedlevel = 3;
      } else if (user.assignedlevel === 3) {
        user.assignedlevel = 1;
      }
      // Clear assigned class if they are moving years, as they will need to be re-assigned to a specific class in the new year
      user.assignedclass = ''; 
      await user.save();
    }
    
    // 4. Update Class References
    const classes = await Class.find();
    for (const cls of classes) {
      const clsStudents = await Student.find({});
      const matchingStudents = clsStudents.filter(s => {
        const level = typeof s.getClassLevel === 'function' ? s.getClassLevel() : s.classLevel;
        return level === cls.level;
      });
      cls.students = matchingStudents.map(s => s._id);
      await cls.save();
    }
    
    // Send response. If there are graduates, send the excel file.
    if (excelBuffer) {
      res.setHeader('Content-Disposition', 'attachment; filename="graduates.xlsx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(excelBuffer);
    } else {
      return res.json({ msg: 'Promotion completed successfully. No graduates this year.' });
    }
    
  } catch (err) {
    console.error('Error during promotion:', err);
    res.status(500).json({ msg: 'Failed to promote users', error: err.message });
  }
});

module.exports = router;
