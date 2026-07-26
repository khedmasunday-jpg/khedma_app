
const mongoose = require('mongoose');

const scheduledJobSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    cronExpression: { type: String, required: true }, 
    timezone: { type: String, default: 'Africa/Cairo' },
    isActive: { type: Boolean, default: true },
    lastRunTime: { type: Date },
    nextRunTime: { type: Date },
    notificationType: { type: String, enum: ['birthday', 'weekly_followup', 'custom'], required: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'MessageTemplate' },
    recipientGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecipientGroup' },
    settings: { type: mongoose.Schema.Types.Map, of: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ScheduledJob', scheduledJobSchema);
