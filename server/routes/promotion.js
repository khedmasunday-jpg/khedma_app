const express = require('express');
const router = express.Router();
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const { runPromotionJob } = require('../jobs/promotionJob');

router.post('/run', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const result = await runPromotionJob(req.user);
    if (result.csvData) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=graduates.csv');
      return res.send(result.csvData);
    }
    res.json({ msg: 'Promotion completed, no graduates to export.', ...result });
  } catch (err) {
    res.status(500).json({ msg: 'Promotion job failed', error: err.message });
  }
});

module.exports = router;
