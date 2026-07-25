const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { encrypt, decrypt } = require('../utils/crypto');

const UserSchema = new mongoose.Schema(
  {
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  role: { type: String, required: true, enum: ['admin', 'principal', 'co-principal', 'teacher'] },
  assignedlevel: { type: Number, enum: [1, 2, 3], required: function() { return this.role !== 'principal'; } },
  assignedclass: { type: String },
  isClassLeader: { type: Boolean, default: false },

  // Fields with setters/getters - setting these will encrypt into *_enc immediately
  fullName: {
    type: String,
    set: function(v) {
      if (v === undefined) return v;
      if (v === null || v === '') {
        this.fullName_enc = undefined;
        return undefined;
      }
      this.fullName_enc = encrypt(v);
      return undefined; // don't store plain value
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
  phonenumber: {
    type: String,
    set: function(v) {
      if (v === undefined) return v;
      if (v === null || v === '') {
        this.phonenumber_enc = undefined;
        return undefined;
      }
      this.phonenumber_enc = encrypt(v);
      return undefined;
    },
    get: function() {
      return decrypt(this.phonenumber_enc);
    }
  },

  // Encrypted fields persisted in DB
  googleCode_enc: { type: Object },
  fullName_enc: { type: Object },
  phonenumber_enc: { type: Object },
  address_enc: { type: Object },

  birthdate: { type: Date },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Before save: hash password only (encryption of fields handled by path setters)
UserSchema.pre('save', function(next) {
  const self = this;

  // Hash password when modified
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

// Hide _enc fields when sending JSON
UserSchema.methods.toJSON = function() {
  const obj = this.toObject({ virtuals: true, getters: true });
  delete obj.fullName_enc;
  delete obj.address_enc;
  delete obj.googleCode_enc;
  delete obj.phonenumber_enc;
  // Never expose password
  if (obj.password) delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', UserSchema);
