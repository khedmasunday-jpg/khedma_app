const express = require('express');
const router = express.Router();
const moment = require('moment');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const User = require('../models/User');
const Student = require('../models/Student');

// GET /api/birthdays
// Principal: returns staff (teachers & co-principals) birthdays in current month
// Co-Principal: returns students in assigned level birthdays in current month
// Quick unauthenticated test endpoint to verify reachability from clients

// Protect the test endpoint to avoid unauthenticated probing
router.get('/test', verifyToken, (req, res) => {
  res.json({ ok: true, route: '/api/birthdays/test' });
});

router.get('/', verifyToken, authorizeRoles('principal', 'co-principal'), async (req, res) => {
  try {
    console.log('GET /api/birthdays called by user=', req.user && { id: req.user.id, role: req.user.role });
    const today = moment().startOf('day');
    const currentMonth = today.format('MM');
    const results = [];

    if (req.user.role === 'principal') {
      // Fetch full user docs (including encrypted blobs) so the model's getter
      // for `fullName` can decrypt and return the same value as Student.getFullName().
      // Selecting only 'fullName' can prevent the underlying encrypted field
      // from being retrieved which makes the getter return undefined.
      const staff = await User.find({ role: { $in: ['teacher', 'co-principal'] } }).select('-password');
      for (const u of staff) {
        if (!u.birthdate) continue;
        if (moment(u.birthdate).format('MM') !== currentMonth) continue;
        const b = moment(u.birthdate).startOf('day');
        const thisYearOccur = moment().year(today.year()).month(b.month()).date(b.date()).startOf('day');
        const daysUntil = thisYearOccur.diff(today, 'days');
        const relative = daysUntil === 0 ? 'Today' : (daysUntil > 0 ? `In ${daysUntil} day${daysUntil === 1 ? '' : 's'}` : `${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'} ago`);
        // Use the model getter to obtain the decrypted fullName (same approach as students)
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
      // co-principal sees students in their assigned level only
      const students = await Student.find();
      for (const s of students) {
        try {
          const bdate = s.birthdate; // virtual/decrypted value comes from model
          if (!bdate) continue;
          const bMonth = moment(bdate).format('MM');
          if (bMonth !== currentMonth) continue;
          const lvl = (typeof s.getClassLevel === 'function') ? s.getClassLevel() : s.classLevel;
          // Diagnostic logging to help uncover why a student may be skipped
          if (moment().format('YYYY-MM-DD') && false) console.log('debug');
          if (req.user && req.user.assignedlevel === undefined) {
            console.log(`Birthday skip: co-principal ${req.user.id} has no assignedlevel; skipping student ${s._id}`);
            continue;
          }
          if (Number(req.user.assignedlevel) !== Number(lvl)) {
            console.log(`Birthday skip: student ${s._id} (${typeof s.getFullName === 'function' ? s.getFullName() : s.fullName || 'N/A'}) birthMonth=${bMonth} classLevel=${lvl} does not match co-principal assignedlevel=${req.user.assignedlevel}`);
            continue;
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
          // ignore malformed student
          continue;
        }
      }
    }

    // Sort: upcoming (daysUntil >=0) ascending, then past (daysUntil <0) by most recent
    results.sort((a, b) => {
      const aUpcoming = a.daysUntil >= 0;
      const bUpcoming = b.daysUntil >= 0;
      if (aUpcoming && bUpcoming) return a.daysUntil - b.daysUntil;
      if (aUpcoming && !bUpcoming) return -1;
      if (!aUpcoming && bUpcoming) return 1;
      // both past: most recent first (closer to zero)
      return b.daysUntil - a.daysUntil;
    });

    res.json(results);
  } catch (err) {
    console.error('Error fetching birthdays:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

module.exports = router;
