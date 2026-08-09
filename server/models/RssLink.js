const mongoose = require('mongoose');

const RssLinkSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    url: { type: String, required: true },
    allowedLevels: [{ type: Number }],
    allowedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  { timestamps: true }
);

module.exports = mongoose.model('RssLink', RssLinkSchema);
