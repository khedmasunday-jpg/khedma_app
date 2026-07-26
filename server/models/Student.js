
const mongoose = require('mongoose');
const { getNextId, getNextIdBatch } = require('../services/idManager');
const crypto = require('crypto');

const AES_SECRET = process.env.AES_SECRET_KEY;
if (!AES_SECRET) throw new Error('Missing AES_SECRET_KEY in .env');

const AES_KEY = crypto.createHash('sha256').update(AES_SECRET).digest();

function encryptField(value) {
  if (!value && value !== 0) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', AES_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    data: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

function decryptField(enc) {
  if (!enc || !enc.data || !enc.iv || !enc.tag) return null;
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    AES_KEY,
    Buffer.from(enc.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(enc.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(enc.data, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

function normalizeDecryptedText(text) {
  if (text == null) return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const studentSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, required: true },
    fullName: { type: String },
    classLevel: { type: Number, enum: [1, 2, 3, 4, 5, 6] },
    classname: { type: String },
    studentId: { type: String, unique: true },
    googlecode: { type: String },
    gender: { type: String, enum: ['male', 'female'], default: 'male' },
    
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
    
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    address_enc: { data: String, iv: String, tag: String },
    mother_phonenumber_enc: { data: String, iv: String, tag: String },
    father_phonenumber_enc: { data: String, iv: String, tag: String },
    birthdate_enc: { data: String, iv: String, tag: String },
    fullName_enc: { data: String, iv: String, tag: String },
    studentId_enc: { data: String, iv: String, tag: String },
    googlecode_enc: { data: String, iv: String, tag: String },
    
    classname_enc: { data: String, iv: String, tag: String },
    classLevel_enc: { data: String, iv: String, tag: String },

    totalAttendance: { type: Number, default: 0 },
    tayoBalance: { type: Number, default: 0 },
    lastAbsentDate: { type: String },
    
    lastAttendanceDate: { type: String },
  },
  { timestamps: true }
);

studentSchema.index({ classLevel: 1, classname: 1 });
studentSchema.index({ classLevel: 1 });
studentSchema.index({ classname: 1 });

studentSchema.pre('validate', function (next) {
  
  const hasFullName = !!(this.fullName || this.fullName_enc);
  const hasClass = !!(this.classname || this.classname_enc);
  const hasLevel = !!(this.classLevel !== undefined && this.classLevel !== null || this.classLevel_enc);
  if (!hasFullName) this.invalidate('fullName', 'fullName is required');
  if (!hasClass) this.invalidate('classname', 'classname is required');
  if (!hasLevel) this.invalidate('classLevel', 'classLevel is required');
  
  next();
});

studentSchema.pre('validate', async function (next) {
  if (!this.isNew || this.id !== undefined) return next();
  try {
    this.id = await getNextId();
    if (!this.studentId)
      this.studentId = `ST${String(this.id).padStart(3, '0')}`;
    next();
  } catch (err) {
    console.error('Error generating student ID:', err);
    next(err);
  }
});

studentSchema.pre('save', function (next) {
  if (this.isModified('address')) {
    this.address_enc = encryptField(this.address);
    this.address = undefined;
  }
  if (this.isModified('mother_phonenumber')) {
    this.mother_phonenumber_enc = encryptField(this.mother_phonenumber);
    this.mother_phonenumber = undefined;
  }
  if (this.isModified('father_phonenumber')) {
    this.father_phonenumber_enc = encryptField(this.father_phonenumber);
    this.father_phonenumber = undefined;
  }
  if (this.isModified('birthdate')) {
    this.birthdate_enc = encryptField(this.birthdate);
    this.birthdate = undefined;
  }

  if (typeof this._birthdate !== 'undefined') {
    const v = this._birthdate === null ? null : (this._birthdate || null);
    const toStore = v ? (typeof v === 'string' ? v : new Date(v).toISOString()) : v;
    this.birthdate_enc = encryptField(toStore);
    delete this._birthdate;
  }

  if (typeof this._address !== 'undefined') {
    const v = this._address === null ? null : (this._address || null);
    const toStore = v ? String(v) : v;
    this.address_enc = encryptField(toStore);
    delete this._address;
  }
  if (typeof this._mother_phonenumber !== 'undefined') {
    const v = this._mother_phonenumber === null ? null : (this._mother_phonenumber || null);
    const toStore = v ? String(v) : v;
    this.mother_phonenumber_enc = encryptField(toStore);
    delete this._mother_phonenumber;
  }
  if (typeof this._father_phonenumber !== 'undefined') {
    const v = this._father_phonenumber === null ? null : (this._father_phonenumber || null);
    const toStore = v ? String(v) : v;
    this.father_phonenumber_enc = encryptField(toStore);
    delete this._father_phonenumber;
  }
  if (this.isModified('fullName')) {
    this.fullName_enc = encryptField(this.fullName);
    this.fullName = undefined;
  }
  if (this.isModified('studentId')) {
    this.studentId_enc = encryptField(this.studentId);

  }
  if (this.isModified('googlecode')) {
    this.googlecode_enc = encryptField(this.googlecode);
    this.googlecode = undefined;
  }
  
  if (this.isModified('classname')) {
    this.classname_enc = encryptField(this.classname);
    this.classname = undefined;
  }
  
  if (this.isModified('classLevel')) {
    this.classLevel_enc = encryptField(String(this.classLevel));
    this.classLevel = undefined;
  }
  next();
});

studentSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() || {};
  const set = update.$set ? update.$set : update;
  const unset = update.$unset ? update.$unset : (update.$unset = {});
  if (set.classname !== undefined) {
    set.classname_enc = encryptField(set.classname);
    unset.classname = '';
    delete set.classname;
  }
  if (set.classLevel !== undefined) {
    set.classLevel_enc = encryptField(String(set.classLevel));
    unset.classLevel = '';
    delete set.classLevel;
  }
  if (set.fullName !== undefined) {
    set.fullName_enc = encryptField(set.fullName);
    unset.fullName = '';
    delete set.fullName;
  }
  if (set.birthdate !== undefined) {
    const v = set.birthdate ? (typeof set.birthdate === 'string' ? set.birthdate : new Date(set.birthdate).toISOString()) : set.birthdate;
    set.birthdate_enc = encryptField(v);
    unset.birthdate = '';
    delete set.birthdate;
  }
  
  if (set.address !== undefined) {
    set.address_enc = encryptField(set.address);
    unset.address = '';
    delete set.address;
  }
  if (set.mother_phonenumber !== undefined) {
    set.mother_phonenumber_enc = encryptField(set.mother_phonenumber);
    unset.mother_phonenumber = '';
    delete set.mother_phonenumber;
  }
  if (set.father_phonenumber !== undefined) {
    set.father_phonenumber_enc = encryptField(set.father_phonenumber);
    unset.father_phonenumber = '';
    delete set.father_phonenumber;
  }
  if (set.studentId !== undefined) {
    set.studentId_enc = encryptField(set.studentId);
    unset.studentId = '';
    delete set.studentId;
  }
  if (set.googlecode !== undefined) {
    set.googlecode_enc = encryptField(set.googlecode);
    unset.googlecode = '';
    delete set.googlecode;
  }
  next();
});

studentSchema.pre('insertMany', async function(next, docs) {
  try {
    
    const missingIdDocs = docs.filter(d => d.id === undefined || d.id === null);
    if (missingIdDocs.length) {
      try {
        const ids = await getNextIdBatch(missingIdDocs.length);
        let i = 0;
        for (const d of docs) {
          if (d.id === undefined || d.id === null) {
            const id = ids[i++];
            d.id = id;
            if (!d.studentId) d.studentId = `ST${String(id).padStart(3, '0')}`;
          }
        }
      } catch (idErr) {
        return next(idErr);
      }
    }

    for (const doc of docs) {
      if (doc.classname !== undefined) {
        doc.classname_enc = encryptField(doc.classname);
        delete doc.classname;
      }
      if (doc.classLevel !== undefined) {
        doc.classLevel_enc = encryptField(String(doc.classLevel));
        delete doc.classLevel;
      }
      if (doc.fullName !== undefined) {
        doc.fullName_enc = encryptField(doc.fullName);
        delete doc.fullName;
      }
      if (doc.studentId !== undefined) {
        doc.studentId_enc = encryptField(doc.studentId);

      }
      if (doc.googlecode !== undefined) {
        doc.googlecode_enc = encryptField(doc.googlecode);
        delete doc.googlecode;
      }
      if (doc.address !== undefined) {
        doc.address_enc = encryptField(doc.address);
        delete doc.address;
      }
      if (doc.mother_phonenumber !== undefined) {
        doc.mother_phonenumber_enc = encryptField(doc.mother_phonenumber);
        delete doc.mother_phonenumber;
      }
      if (doc.father_phonenumber !== undefined) {
        doc.father_phonenumber_enc = encryptField(doc.father_phonenumber);
        delete doc.father_phonenumber;
      }
      if (doc.birthdate !== undefined) {
        const v = doc.birthdate ? new Date(doc.birthdate).toISOString() : doc.birthdate;
        doc.birthdate_enc = encryptField(v);
        delete doc.birthdate;
      }
    }
  } catch (e) {
    return next(e);
  }
  next();
});

studentSchema.virtual('address').get(function () {
  return normalizeDecryptedText(decryptField(this.address_enc));
});
studentSchema.virtual('mother_phonenumber').get(function () {
  return normalizeDecryptedText(decryptField(this.mother_phonenumber_enc));
});
studentSchema.virtual('father_phonenumber').get(function () {
  return normalizeDecryptedText(decryptField(this.father_phonenumber_enc));
});
studentSchema.virtual('birthdate').get(function () {
  return normalizeDecryptedText(decryptField(this.birthdate_enc));
});

studentSchema.virtual('birthdate').set(function (v) {
  if (v === undefined) {
    this._birthdate = undefined;
  } else if (v === null || v === '') {
    this._birthdate = null;
  } else {
    try {
      const d = new Date(v);
      this._birthdate = isNaN(d.getTime()) ? String(v) : d.toISOString();
    } catch (e) {
      this._birthdate = String(v);
    }
  }
});

studentSchema.virtual('address').set(function (v) {
  if (v === undefined) {
    this._address = undefined;
  } else if (v === null || v === '') {
    this._address = null;
  } else {
    this._address = String(v);
  }
});
studentSchema.virtual('mother_phonenumber').set(function (v) {
  if (v === undefined) {
    this._mother_phonenumber = undefined;
  } else if (v === null || v === '') {
    this._mother_phonenumber = null;
  } else {
    this._mother_phonenumber = String(v);
  }
});
studentSchema.virtual('father_phonenumber').set(function (v) {
  if (v === undefined) {
    this._father_phonenumber = undefined;
  } else if (v === null || v === '') {
    this._father_phonenumber = null;
  } else {
    this._father_phonenumber = String(v);
  }
});

studentSchema.methods.getClassname = function () {
  return this.classname || normalizeDecryptedText(decryptField(this.classname_enc));
};
studentSchema.methods.getClassLevel = function () {
  if (this.classLevel !== undefined && this.classLevel !== null) return this.classLevel;
  const dec = decryptField(this.classLevel_enc);
  const n = Number(dec);
  return isNaN(n) ? undefined : n;
};
studentSchema.methods.getFullName = function () {
  return this.fullName || normalizeDecryptedText(decryptField(this.fullName_enc));
};
studentSchema.methods.getStudentId = function () {
  return this.studentId || normalizeDecryptedText(decryptField(this.studentId_enc));
};
studentSchema.methods.getGoogleCode = function () {
  return this.googlecode || normalizeDecryptedText(decryptField(this.googlecode_enc));
};

studentSchema.methods.toJSON = function () {
  const obj = this.toObject({ virtuals: true });
  
  const source = this.toObject();
  for (const key of Object.keys(source)) {
    if (!key.endsWith('_enc')) continue;
    const base = key.slice(0, -4);
    
    delete obj[key];
    
    if (obj[base] !== undefined) continue;
    const dec = normalizeDecryptedText(decryptField(source[key]));
    if (base === 'classLevel') {
      const n = Number(dec);
      obj[base] = isNaN(n) ? dec : n;
    } else if (base === 'birthdate') {
      obj[base] = dec ? new Date(dec) : null;
    } else {
      obj[base] = dec;
    }
  }
  
  if (obj.classLevel !== undefined && obj.yearLevel === undefined) {
    const n = Number(obj.classLevel);
    if (!isNaN(n) && n >= 1) obj.yearLevel = Math.ceil(n / 2);
  }
  return obj;
};

studentSchema.post('save', function (doc) {});

module.exports = mongoose.model('Student', studentSchema);
