const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { encrypt, decrypt } = require('../utils/crypto');

const UserSchema = new mongoose.Schema(
  {
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  role: { type: String, required: true, enum: ['admin', 'principal', 'co-principal', 'teacher'] },
  gender: { type: String, enum: ['Male', 'Female'], default: 'Male' },
  assignedlevel: { type: Number, enum: [1, 2, 3], required: function() { return this.role !== 'principal'; } },
  assignedclass: { type: String },
  isClassLeader: { type: Boolean, default: false },

  fullName: {
    type: String,
    set: function(v) {
      if (v === undefined) return v;
      if (v === null || v === '') {
        this.fullName_enc = undefined;
        return undefined;
      }
      this.fullName_enc = encrypt(v);
      return undefined; 
    },
    get: function() {
      return decrypt(this.fullName_enc);
    }
  },
  address: {
    type: String,
    set: function(v) {
      if (v === undefined) return v;
      if (v === null || v === '') {
        this.address_enc = undefined;
        return undefined;
      }
      this.address_enc = encrypt(v);
      return undefined;
    },
    get: function() {
      return decrypt(this.address_enc);
    }
  },
  googleCode: {
    type: String,
    set: function(v) {
      if (v === undefined) return v;
      if (v === null || v === '') {
        this.googleCode_enc = undefined;
        return undefined;
      }
      this.googleCode_enc = encrypt(v);
      return undefined;
    },
    get: function() {
      return decrypt(this.googleCode_enc);
    }
  },

  telegramChatId: {
    type: String,
    set: function(v) {
      if (v === undefined) return v;
      if (v === null || v === '') {
        this.telegramChatId_enc = undefined;
        return undefined;
      }
      this.telegramChatId_enc = encrypt(v);
      return undefined;
    },
    get: function() {
      return decrypt(this.telegramChatId_enc);
    }
  },

  googleCode_enc: { type: Object },
  fullName_enc: { type: Object },
  telegramChatId_enc: { type: Object },
  address_enc: { type: Object },

  birthdate: { type: Date },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ role: 1, assignedlevel: 1 });
UserSchema.index({ role: 1, assignedclass: 1, assignedlevel: 1 });
UserSchema.index({ isActive: 1 });

UserSchema.pre('save', function(next) {
  const self = this;

  if (self.isModified('password')) {
    const salt = bcrypt.genSaltSync(10);
    try {
      self.password = bcrypt.hashSync(self.password, salt);
    } catch (err) {
      return next(err);
    }
  }

  next();
});

UserSchema.methods.toJSON = function() {
  const obj = this.toObject({ virtuals: true, getters: true });
  delete obj.fullName_enc;
  delete obj.address_enc;
  delete obj.googleCode_enc;
  delete obj.phonenumber_enc;
  delete obj.telegramChatId_enc;
  
  if (obj.password) delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', UserSchema);
