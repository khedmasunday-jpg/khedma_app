const mongoose = require('mongoose');

const cronJobRunSchema = new mongoose.Schema({
  jobName: { type: String, required: true },
  executionKey: { type: String, required: true, unique: true }, // e.g. "birthday:2026-08-13"
  status: { type: String, enum: ['running', 'completed', 'failed'], default: 'running' },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  recordsProcessed: { type: Number, default: 0 },
  error: { type: String }
});

// Ensure uniqueness so two concurrent requests can't both execute
cronJobRunSchema.index({ jobName: 1, executionKey: 1 }, { unique: true });

module.exports = mongoose.model('CronJobRun', cronJobRunSchema);
