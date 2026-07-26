const AvailableIds = require('../models/AvailableIds');

async function getNextId() {
  
  const available = await AvailableIds.findOneAndUpdate(
    {},
    { $pop: { ids: -1 } }, 
    { new: true }
  ).lean();

  if (available?.ids?.length > 0) {
    const reusedId = available.ids[0];
    
    const Student = require('../models/Student');
    const exists = await Student.findOne({ id: reusedId }).lean();
    if (!exists) {
      return reusedId;
    }
  }

  const Student = require('../models/Student');

  let maxAttempts = 10;
  
  while (maxAttempts > 0) {
    
    const lastStudent = await Student.findOne().sort({ id: -1 }).lean();
    const lastIdRaw = lastStudent && lastStudent.id;
    const lastIdNum = Number(lastIdRaw);
    
    let candidateId;
    if (!Number.isFinite(lastIdNum) || Number.isNaN(lastIdNum)) {
      candidateId = 1; 
    } else {
      candidateId = lastIdNum + 1;
    }

    const existing = await Student.findOne({ id: candidateId }).lean();
    if (!existing) {
      
      return candidateId;
    }

    maxAttempts--;
    
    await new Promise(resolve => setTimeout(resolve, Math.random() * 20 + 5));
  }

  return Math.floor(Date.now() / 1000);
}

async function releaseId(id) {
  await AvailableIds.updateOne(
    {},
    { $push: { ids: { $each: [id], $sort: 1 } } }, 
    { upsert: true }
  );
}

async function getNextIdBatch(count) {
  const Student = require('../models/Student');
  
  let maxAttempts = 5;
  const ids = [];
  
  while (ids.length < count && maxAttempts > 0) {
    
    const lastStudent = await Student.findOne().sort({ id: -1 }).lean();
    const lastIdRaw = lastStudent && lastStudent.id;
    const lastIdNum = Number(lastIdRaw);
    
    let startId;
    if (!Number.isFinite(lastIdNum) || Number.isNaN(lastIdNum)) {
      startId = 1;
    } else {
      startId = lastIdNum + 1;
    }

    const needed = count - ids.length;
    const candidateIds = [];
    for (let i = 0; i < needed; i++) {
      candidateIds.push(startId + i);
    }

    const existing = await Student.find({ id: { $in: candidateIds } }).lean();
    const existingIds = new Set(existing.map(s => s.id));
    const availableIds = candidateIds.filter(id => !existingIds.has(id));
    
    ids.push(...availableIds);

    if (ids.length >= count) {
      return ids.slice(0, count);
    }

    maxAttempts--;
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  while (ids.length < count) {
    ids.push(Math.floor(Date.now() / 1000) + ids.length);
  }
  
  return ids.slice(0, count);
}

module.exports = { getNextId, releaseId, getNextIdBatch };