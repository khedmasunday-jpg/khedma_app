const AvailableIds = require('../models/AvailableIds');

// Get next available ID (reuse deleted or auto-increment)
// Uses atomic operations to prevent race conditions
async function getNextId() {
  // 1. Try to reuse a deleted ID (atomic operation)
  const available = await AvailableIds.findOneAndUpdate(
    {},
    { $pop: { ids: -1 } }, // Remove smallest available ID
    { new: true }
  ).lean();

  if (available?.ids?.length > 0) {
    const reusedId = available.ids[0];
    // Verify the ID isn't already in use (shouldn't happen, but double-check)
    const Student = require('../models/Student');
    const exists = await Student.findOne({ id: reusedId }).lean();
    if (!exists) {
      return reusedId;
    }
  }

  // 2. If none available, find the max ID and increment
  // Import Student model here to avoid circular dependency
  const Student = require('../models/Student');
  
  // Retry logic to handle concurrent requests
  let maxAttempts = 10;
  
  while (maxAttempts > 0) {
    // Get the current max ID
    const lastStudent = await Student.findOne().sort({ id: -1 }).lean();
    const lastIdRaw = lastStudent && lastStudent.id;
    const lastIdNum = Number(lastIdRaw);
    
    let candidateId;
    if (!Number.isFinite(lastIdNum) || Number.isNaN(lastIdNum)) {
      candidateId = 1; // Start from 1 if no students exist
    } else {
      candidateId = lastIdNum + 1;
    }
    
    // Check if this ID already exists (race condition check)
    const existing = await Student.findOne({ id: candidateId }).lean();
    if (!existing) {
      // ID is available, return it
      return candidateId;
    }
    
    // ID was taken (race condition), increment and retry
    maxAttempts--;
    // Small random delay to reduce collision probability
    await new Promise(resolve => setTimeout(resolve, Math.random() * 20 + 5));
  }
  
  // Fallback: return a timestamp-based ID to ensure uniqueness
  // This should rarely be needed, but provides a safety net
  return Math.floor(Date.now() / 1000);
}

// Release ID when student is deleted
async function releaseId(id) {
  await AvailableIds.updateOne(
    {},
    { $push: { ids: { $each: [id], $sort: 1 } } }, // Keep sorted for efficiency
    { upsert: true }
  );
}

// Get a batch of unique IDs atomically (for bulk operations)
async function getNextIdBatch(count) {
  const Student = require('../models/Student');
  
  let maxAttempts = 5;
  const ids = [];
  
  while (ids.length < count && maxAttempts > 0) {
    // Get the current max ID
    const lastStudent = await Student.findOne().sort({ id: -1 }).lean();
    const lastIdRaw = lastStudent && lastStudent.id;
    const lastIdNum = Number(lastIdRaw);
    
    let startId;
    if (!Number.isFinite(lastIdNum) || Number.isNaN(lastIdNum)) {
      startId = 1;
    } else {
      startId = lastIdNum + 1;
    }
    
    // Generate a range of IDs we need
    const needed = count - ids.length;
    const candidateIds = [];
    for (let i = 0; i < needed; i++) {
      candidateIds.push(startId + i);
    }
    
    // Check which IDs are available (don't exist yet)
    const existing = await Student.find({ id: { $in: candidateIds } }).lean();
    const existingIds = new Set(existing.map(s => s.id));
    const availableIds = candidateIds.filter(id => !existingIds.has(id));
    
    ids.push(...availableIds);
    
    // If we got all needed IDs, return them
    if (ids.length >= count) {
      return ids.slice(0, count);
    }
    
    // Otherwise, retry with a new range
    maxAttempts--;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  // Fallback: if we still don't have enough IDs, use timestamp-based IDs
  while (ids.length < count) {
    ids.push(Math.floor(Date.now() / 1000) + ids.length);
  }
  
  return ids.slice(0, count);
}

module.exports = { getNextId, releaseId, getNextIdBatch };