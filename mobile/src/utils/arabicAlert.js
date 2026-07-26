import { Alert } from 'react-native';

const map = {
  'Error': 'خطأ',
  'Success': 'نجاح',
  'Copied': 'تم النسخ',
  'Exported': 'تم التصدير',
  'Imported': 'تم الاستيراد',
  'No staff added yet': 'لم يتم إضافة موظفين بعد',
  'Staff added': 'تمت إضافة الموظفين',
  'Failed to add staff': 'فشل إضافة الموظف',
  'Failed to import XLSX file': 'فشل استيراد ملف Excel',
  'Failed to fetch staff': 'فشل جلب بيانات الموظفين',
};

function translate(text) {
  if (!text) return text;
  if (map[text]) return map[text];
  return text;
}

export function installArabicAlert() {
  const old = Alert.alert;
  Alert.alert = function (title, message, buttons, options) {
    const t = translate(title);
    const m = translate(message);
    return old.call(Alert, t, m, buttons, options);
  };
}

export { translate };
export default { installArabicAlert, translate };
