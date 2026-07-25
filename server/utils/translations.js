// Central translation mapping for server responses
const map = {
  'Access denied': 'تم الرفض - لا توجد صلاحية',
  'Server error': 'خطأ في الخادم',
  'Unauthorized': 'غير مصرح',
  'Missing fields': 'حقول مفقودة',
  'Please provide:': 'يرجى توفير:',
  'User created': 'تم إنشاء المستخدم',
  'A principal already exists': 'يوجد بالفعل مدير مدرسة',
  'Principal may only create teacher or co-principal': 'المدير يستطيع فقط إنشاء معلم أو نائب مدير',
  'Username already exists': 'اسم المستخدم موجود بالفعل',
  'Maximum number of co-principals reached': 'تم الوصول للحد الأقصى من النواب',
  'Failed to add staff': 'فشل إضافة الموظف',
  'Failed to import XLSX file': 'فشل استيراد ملف Excel',
  'Failed to fetch staff': 'فشل جلب بيانات الموظفين',
  'Missing fields: fullName, password, role are required': 'الحقول المطلوبة: الاسم الكامل، كلمة المرور، الدور',
  'Please provide': 'يرجى توفير',
  'Success': 'نجاح',
  'Error': 'خطأ',
  'Copied': 'تم النسخ',
  'Exported': 'تم التصدير',
  'Imported': 'تم الاستيراد',
  'No staff added yet': 'لم يتم إضافة موظفين بعد',
  'Staff added': 'تمت إضافة الموظفين',
};

const fieldReplacements = {
  'fullName': 'الاسم الكامل',
  'username': 'اسم المستخدم',
  'password': 'كلمة المرور',
  'role': 'الدور',
  'birthdate': 'تاريخ الميلاد',
  'assignedlevel': 'الصف',
  'assignedclass': 'الفصل',
};

function translateMessage(msg) {
  if (!msg) return msg;
  if (typeof msg !== 'string') return msg;
  if (map[msg]) return map[msg];

  // try partial replacements for known patterns
  let out = msg;
  // common prefixes
  out = out.replace(/Missing fields:?/i, map['Missing fields'] || 'حقول مفقودة');
  out = out.replace(/Please provide:?/i, map['Please provide:'] || 'يرجى توفير:');

  // replace field tokens
  Object.keys(fieldReplacements).forEach(k => {
    const re = new RegExp(`\\b${k}\\b`, 'g');
    out = out.replace(re, fieldReplacements[k]);
  });

  return out;
}

module.exports = { translateMessage };
