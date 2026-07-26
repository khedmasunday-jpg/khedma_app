const express = require('express');
const { body, validationResult } = require('express-validator');
const app = express();

app.use(express.json());

app.post('/api/attendance/:classId', [
  body('students').isArray().withMessage('students array required')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ msg: 'Invalid input', errors: errors.array() });
  }
  res.status(200).json({ msg: 'Success' });
});

const request = require('supertest');

request(app)
  .post('/api/attendance/123')
  .send({
    students: [{ studentId: "123", status: "present" }]
  })
  .expect(200)
  .then(res => console.log('Test 1:', res.body))
  .catch(err => console.error('Test 1 error:', err));
