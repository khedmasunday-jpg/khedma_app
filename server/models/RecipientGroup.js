
const mongoose = require('mongoose');

const recipientGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    
    criteria: {
      role: { type: String },
      classLevel: { type: Number },
      assignedclass: { type: String },
    },
    
    recipients: [
      {
        recipientType: { type: String, enum: ['User', 'Student'], required: true },
        recipientId: { type: mongoose.Schema.Types.ObjectId, refPath: 'recipients.recipientType', required: true },
        name: { type: String },
        phoneNumber: { type: String },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('RecipientGroup', recipientGroupSchema);
