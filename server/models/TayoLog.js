const mongoose = require('mongoose');

const tayoLogSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    givenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true }, 
    reason: { type: String, required: true },
    date: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

tayoLogSchema.index({ student: 1, date: -1 });
tayoLogSchema.index({ givenBy: 1 });

module.exports = mongoose.model('TayoLog', tayoLogSchema);
