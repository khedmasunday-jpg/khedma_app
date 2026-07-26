const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config({ path: '/home/georgehany/Desktop/khedma/server/.env' });

async function run() {
  try {
    const token = jwt.sign({ id: 'dummy', role: 'principal' }, process.env.JWT_SECRET || 'secret123');
    const resClasses = await axios.get('http://localhost:5000/api/classes', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Classes:', resClasses.data.map(c => c._id));
    if (resClasses.data.length > 0) {
      const classId = resClasses.data[0]._id;
      console.log('Fetching students for class:', classId);
      const resStudents = await axios.get(`http://localhost:5000/api/classes/${classId}/students`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Students success:', resStudents.data.students.length);
    }
  } catch (err) {
    console.error('Error:', err.response ? err.response.data : err.message);
  }
}
run();
