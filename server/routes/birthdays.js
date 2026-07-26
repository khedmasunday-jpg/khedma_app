const express = require('express');
const router = express.Router();
const moment = require('moment');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const User = require('../models/User');
const Student = require('../models/Student');

router.get('/test', verifyToken, (req, res) => {
  res.json({ ok: true, route: '/api/birthdays/test' });
});

router.get('/', verifyToken, authorizeRoles('principal', 'co-principal'), async (req, res) => {
  try {    const today = moment().startOf('day');
    const currentMonth = today.format('MM');
    const results = [];

    if (req.user.role === 'principal') {

      const staff = await User.find({ role: { $in: ['teacher', 'co-principal'] } }).select('-password');
      for (const u of staff) {
        if (!u.birthdate) continue;
        if (moment(u.birthdate).format('MM') !== currentMonth) continue;
        const b = moment(u.birthdate).startOf('day');
        const thisYearOccur = moment().year(today.year()).month(b.month()).date(b.date()).startOf('day');
        const daysUntil = thisYearOccur.diff(today, 'days');
        const relative = daysUntil === 0 ? 'Today' : (daysUntil > 0 ? `In ${daysUntil} day${daysUntil === 1 ? '' : 's'}` : `${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'} ago`);
        
        const name = (typeof u.fullName === 'string') ? u.fullName : (u.fullName || '');
        results.push({
          id: u._id,
          name,
          type: 'staff',
          role: u.role,
          birthdate: u.birthdate,
          daysUntil,
          relative
        });
      }
    } else if (req.user.role === 'co-principal') {
      
      const students = await Student.find();
      for (const s of students) {
        try {
          const bdate = s.birthdate; 
          if (!bdate) continue;
          const bMonth = moment(bdate).format('MM');
          if (bMonth !== currentMonth) continue;
          const lvl = (typeof s.getClassLevel === 'function') ? s.getClassLevel() : s.classLevel;
          if (req.user && req.user.assignedlevel === undefined) {            continue;
          }
          if (Number(req.user.assignedlevel) !== Number(lvl)) {            continue;
          }
          const b = moment(bdate).startOf('day');
          const thisYearOccur = moment().year(today.year()).month(b.month()).date(b.date()).startOf('day');
          const daysUntil = thisYearOccur.diff(today, 'days');
          const relative = daysUntil === 0 ? 'Today' : (daysUntil > 0 ? `In ${daysUntil} day${daysUntil === 1 ? '' : 's'}` : `${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'} ago`);
          results.push({
            id: s._id,
            name: (typeof s.getFullName === 'function') ? s.getFullName() : (s.fullName || ''),
            type: 'student',
            classLevel: lvl,
            classname: (typeof s.getClassname === 'function') ? s.getClassname() : s.classname,
            birthdate: bdate,
            daysUntil,
            relative
          });
        } catch (e) {
          
          continue;
        }
      }
    }

    results.sort((a, b) => {
      const aUpcoming = a.daysUntil >= 0;
      const bUpcoming = b.daysUntil >= 0;
      if (aUpcoming && bUpcoming) return a.daysUntil - b.daysUntil;
      if (aUpcoming && !bUpcoming) return -1;
      if (!aUpcoming && bUpcoming) return 1;
      
      return b.daysUntil - a.daysUntil;
    });

    res.json(results);
  } catch (err) {
    console.error('Error fetching birthdays:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
