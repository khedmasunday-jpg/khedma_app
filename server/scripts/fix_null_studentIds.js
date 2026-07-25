require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Student = require('../models/Student');
const { getNextId } = require('../services/idManager');

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI not set in .env');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to DB');

  try {
    const cursor = Student.find({ $or: [ { studentId: null }, { studentId: { $exists: false } } ] }).cursor();
    let count = 0;
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      console.log('Fixing student _id=', doc._id, 'current studentId=', doc.studentId);
      const newId = await getNextId();
      doc.id = newId;
      doc.studentId = `ST${String(newId).padStart(3, '0')}`;
      try {
        await doc.save();
        console.log('Updated student', doc._id, '->', doc.studentId);
        count++;
      } catch (e) {
        console.error('Failed to update student', doc._id, e);
      }
    }
    console.log('Done. Updated', count, 'students');
  } catch (e) {
    console.error('Error during fix:', e);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
