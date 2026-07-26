
const mongoose = require('mongoose');

const messageTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    content: { type: String, required: true },
    type: { type: String, enum: ['birthday', 'weekly_followup', 'custom'], default: 'custom' },
    description: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MessageTemplate', messageTemplateSchema);
