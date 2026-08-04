const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  ip_enc: String
});
schema.virtual('ip')
  .get(function() { return this.ip_enc; })
  .set(function(v) { this.ip_enc = v + '_encrypted'; });
  
const Model = mongoose.model('Test', schema);
const doc = new Model({ ip: '192.168.1.1' });
console.log('Doc ip_enc:', doc.ip_enc);
