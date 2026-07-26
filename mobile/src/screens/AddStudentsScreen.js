import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Linking,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { loadContactsForPicker } from '../utils/contactPicker';
import { logger } from '../utils/logger';
import { API_URL } from '../config/api';
import { getAuthToken } from '../config/authSession';
import { useLanguage } from '../utils/LanguageContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatDateDDMMYYYY } from '../utils/dateFormatter';
import WebDateInput from '../components/WebDateInput';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';

let DateTimePickerModal = null;
if (Platform.OS !== 'web') {
  try {
    DateTimePickerModal = require('react-native-modal-datetime-picker').default;
  } catch (e) {
    DateTimePickerModal = null;
  }
}

const initialStudent = {
  fullName: '',
  classLevel: '', 
  classname: '',
  googlecode: '',
  address: '',
  mother_phonenumber: '',
  father_phonenumber: '',
  birthdate: '',
  gender: 'male',
};

export default function AddStudentsScreen({ route, navigation }) {
  const { token: routeToken } = route?.params || {};
  const token = routeToken || getAuthToken();
  const { t, locale } = useLanguage();
  const [student, setStudent] = useState(initialStudent);
  const [students, setStudents] = useState([]);
  const [serverClasses, setServerClasses] = useState([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [contactsList, setContactsList] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactPickerVisible, setContactPickerVisible] = useState(false);
  const [contactPickerField, setContactPickerField] = useState(null);
  const [inlineMessage, setInlineMessage] = useState('');

  useEffect(() => {
    if (inlineMessage) {
      const timer = setTimeout(() => {
        setInlineMessage('');
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [inlineMessage]);

  const handleChange = (key, value) => setStudent({ ...student, [key]: value });

  const [customAlertVisible, setCustomAlertVisible] = useState(false);
  const [customAlertTitle, setCustomAlertTitle] = useState('');
  const [customAlertMessage, setCustomAlertMessage] = useState('');

  const showAlert = (title, message) => {
    setCustomAlertTitle(title);
    setCustomAlertMessage(message || '');
    setCustomAlertVisible(true);
  };

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/classes`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          logger.error('Failed fetching classes', await res.text());
          return;
        }
        const list = await res.json();
        setServerClasses(list || []);
      } catch (err) {
        logger.error('Error fetching classes', err);
      }
    })();
  }, [token]);

  const decodeBase64 = (input) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = input.replace(/=+$/, '');
    let output = '';

    if (str.length % 4 === 1) {
      throw new Error("'atob' failed: The string to be decoded is not correctly encoded.");
    }

    for (let bc = 0, bs = 0, buffer, i = 0; (buffer = str.charAt(i++)); ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4) ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)))) : 0) {
      buffer = chars.indexOf(buffer);
    }

    return output;
  };

  const handlePickExcel = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel'
        ],
        copyToCacheDirectory: true
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      let binaryData;

      if (Platform.OS === 'web') {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        binaryData = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(new Uint8Array(e.target.result));
          reader.onerror = (e) => reject(e);
          reader.readAsArrayBuffer(blob);
        });
      } else {
        const base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64
        });
        const decoded = decodeBase64(base64);
        binaryData = new Uint8Array(
          decoded
            .split('')
            .map((c) => c.charCodeAt(0))
        );
      }

      const workbook = XLSX.read(binaryData, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        showAlert(
          locale === 'ar' ? 'خطأ' : 'Error',
          locale === 'ar' ? 'ملف الإكسل فارغ!' : 'Excel file is empty!'
        );
        return;
      }

      const newStudents = jsonData.map((row) => {
        const getVal = (possibleKeys) => {
          for (const key of Object.keys(row)) {
            if (possibleKeys.includes(key.trim().toLowerCase())) {
              return row[key];
            }
          }
          return '';
        };

        const fullName = getVal(['اسم الطالب', 'الاسم بالكامل', 'الاسم', 'fullname', 'name', 'full name']);
        const classLevel = getVal(['السنة الدراسية', 'الصف', 'classlevel', 'grade', 'year', 'level']);
        const classname = getVal(['اسم الفصل', 'الفصل', 'classname', 'class name', 'class']);
        const googlecode = getVal(['كود جوجل', 'الكود', 'googlecode', 'code']);
        const address = getVal(['العنوان', 'address']);
        const mother_phonenumber = String(getVal(['تليفون الأم', 'رقم الأم', 'mother phone', 'mother_phonenumber', 'motherphone'])).replace(/\D/g, '');
        const father_phonenumber = String(getVal(['تليفون الأب', 'رقم الأب', 'father phone', 'father_phonenumber', 'fatherphone'])).replace(/\D/g, '');
        const birthdateRaw = getVal(['تاريخ الميلاد', 'birthdate', 'birth date', 'dob']);
        const genderRaw = String(getVal(['النوع', 'الجنس', 'gender', 'sex'])).trim().toLowerCase();

        let birthdate = '';
        if (birthdateRaw) {
          try {
            if (typeof birthdateRaw === 'number') {
              const date = new Date((birthdateRaw - 25569) * 86400 * 1000);
              birthdate = date.toISOString();
            } else {
              const date = new Date(birthdateRaw);
              if (!isNaN(date.getTime())) {
                birthdate = date.toISOString();
              }
            }
          } catch (e) {
            birthdate = '';
          }
        }

        let gender = 'male';
        if (genderRaw.includes('girl') || genderRaw.includes('بنت') || genderRaw.includes('female') || genderRaw.includes('أنثى')) {
          gender = 'female';
        }

        return {
          fullName: String(fullName).trim(),
          classLevel: classLevel ? Number(classLevel) : '',
          classname: String(classname).trim(),
          googlecode: String(googlecode).trim(),
          address: String(address).trim(),
          mother_phonenumber,
          father_phonenumber,
          birthdate,
          gender
        };
      });

      const validStudents = [];
      const invalidRows = [];

      newStudents.forEach((st, idx) => {
        const rowNum = idx + 2;
        if (!st.fullName) {
          invalidRows.push(locale === 'ar' ? `الصف ${rowNum}: اسم الطالب مفقود` : `Row ${rowNum}: Student Name is missing`);
        } else if (!st.classLevel) {
          invalidRows.push(locale === 'ar' ? `الصف ${rowNum}: السنة الدراسية مفقودة أو غير صحيحة` : `Row ${rowNum}: Grade Level is missing or invalid`);
        } else if (!st.classname) {
          invalidRows.push(locale === 'ar' ? `الصف ${rowNum}: اسم الفصل مفقود` : `Row ${rowNum}: Class Name is missing`);
        } else {
          validStudents.push(st);
        }
      });

      if (invalidRows.length > 0) {
        const errorMsg = invalidRows.slice(0, 5).join('\n') + (invalidRows.length > 5 ? '\n...' : '');
        showAlert(
          locale === 'ar' ? 'أخطاء في البيانات' : 'Data Errors',
          (locale === 'ar' ? 'تم العثور على أخطاء في بعض الصفوف وسيرفض استيرادها:\n\n' : 'Errors found in some rows (they will be skipped):\n\n') + errorMsg
        );
      }

      if (validStudents.length > 0) {
        setStudents([...students, ...validStudents]);
        showAlert(
          locale === 'ar' ? 'تم الاستيراد بنجاح' : 'Import Success',
          locale === 'ar' 
            ? `تم استيراد ${validStudents.length} مخدوم وإضافتهم لقائمة الانتظار.`
            : `Successfully imported ${validStudents.length} students to the queue list.`
        );
      } else {
        showAlert(
          locale === 'ar' ? 'فشل الاستيراد' : 'Import Failed',
          locale === 'ar' ? 'لم يتم العثور على أي صفوف صالحة للاستيراد.' : 'No valid rows found to import.'
        );
      }

    } catch (e) {
      logger.error('Excel pick error', e);
      showAlert(
        locale === 'ar' ? 'خطأ' : 'Error',
        locale === 'ar' ? `حدث خطأ أثناء قراءة الملف: ${e.message}` : `Failed to read file: ${e.message}`
      );
    }
  };

  useEffect(() => {
    if (route?.params?.autoPickExcel) {
      handlePickExcel();
    }
  }, [route?.params?.autoPickExcel]);

  const handleAddStudent = () => {
    const missing = [];
    if (!student.fullName || String(student.fullName).trim() === '') missing.push('fullName');
    if (!student.classLevel) missing.push('classLevel');
    if (!student.classname) missing.push('classname');

    if (missing.length) {
      const labels = {
        fullName: t('studentName'),
        classLevel: t('gradeLevel'),
        classname: t('selectClass'),
      };
      const human = missing.map(k => labels[k] || k).join(', ');
      const msg = locale === 'ar' ? `من فضلك أدخل: ${human}` : `Please enter: ${human}`;
      setInlineMessage(msg);
      showAlert(locale === 'ar' ? 'حقول مفقودة' : 'Missing fields', msg);
      return;
    }

    const phoneFields = ['mother_phonenumber', 'father_phonenumber'];
    for (const field of phoneFields) {
      if (student[field] && !/^\d+$/.test(student[field])) {
        const label = field === 'mother_phonenumber' ? t('motherPhone') : t('fatherPhone');
        const msg = locale === 'ar' ? `${label} يجب أن يحتوي على أرقام فقط` : `${label} must contain digits only`;
        setInlineMessage(msg);
        showAlert(locale === 'ar' ? 'خطأ' : 'Error', msg);
        return;
      }
    }

    const toAdd = {
      fullName: student.fullName.trim(),
      classLevel: Number(student.classLevel),
      classname: student.classname,
      googlecode: student.googlecode || '',
      address: student.address || '',
      mother_phonenumber: (student.mother_phonenumber || '').trim(),
      father_phonenumber: (student.father_phonenumber || '').trim(),
      birthdate: student.birthdate || new Date().toISOString(),
      gender: student.gender || 'male',
    };

    setStudents([...students, toAdd]);
    setStudent(initialStudent);
    const totalInQueue = students.length + 1;
    setInlineMessage(
      locale === 'ar'
        ? `تمت الإضافة إلى قائمة الانتظار (الإجمالي: ${totalInQueue})`
        : `Added to queue list (Total: ${totalInQueue})`
    );
    showAlert(
      locale === 'ar' ? 'تمت الإضافة' : 'Success',
      locale === 'ar'
        ? `العنصر أُضيف إلى قائمة الانتظار. العدد الحالي: ${totalInQueue}`
        : `Student added to queue list. Current count: ${totalInQueue}`
    );
  };

  const pickContactPhone = async (field) => {
    setLoadingContacts(true);
    try {
      const contacts = await loadContactsForPicker(showAlert);
      if (contacts) {
        setContactsList(contacts);
        setContactPickerField(field);
        setContactPickerVisible(true);
      }
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleSubmit = async () => {
    try {
      let toSubmit = [...students];

      const formHasData = 
        (student.fullName && String(student.fullName).trim() !== '') ||
        student.classLevel ||
        student.classname ||
        (student.mother_phonenumber && String(student.mother_phonenumber).trim() !== '') ||
        (student.father_phonenumber && String(student.father_phonenumber).trim() !== '');

      if (formHasData) {
        
        const missing = [];
        if (!student.fullName || String(student.fullName).trim() === '') missing.push('fullName');
        if (!student.classLevel) missing.push('classLevel');
        if (!student.classname) missing.push('classname');

        if (missing.length) {
          const labels = {
            fullName: t('studentName'),
            classLevel: t('gradeLevel'),
            classname: t('selectClass'),
          };
          const human = missing.map(k => labels[k] || k).join(', ');
          const msg = locale === 'ar' ? `من فضلك أكمل الحقول للمخدوم الحالي: ${human}` : `Please complete current student details: ${human}`;
          setInlineMessage(msg);
          showAlert(locale === 'ar' ? 'حقول مفقودة' : 'Missing fields', msg);
          return;
        }

        const phoneFields = ['mother_phonenumber', 'father_phonenumber'];
        for (const field of phoneFields) {
          if (student[field] && !/^\d+$/.test(student[field])) {
            const label = field === 'mother_phonenumber' ? t('motherPhone') : t('fatherPhone');
            const msg = locale === 'ar' ? `${label} يجب أن يحتوي على أرقام فقط` : `${label} must contain digits only`;
            setInlineMessage(msg);
            showAlert(locale === 'ar' ? 'خطأ' : 'Error', msg);
            return;
          }
        }

        const toAdd = {
          fullName: student.fullName.trim(),
          classLevel: Number(student.classLevel),
          classname: student.classname,
          googlecode: student.googlecode || '',
          address: student.address || '',
          mother_phonenumber: (student.mother_phonenumber || '').trim(),
          father_phonenumber: (student.father_phonenumber || '').trim(),
          birthdate: student.birthdate || new Date().toISOString(),
          gender: student.gender || 'male',
        };
        
        toSubmit.push(toAdd);
      }

      if (toSubmit.length === 0) {
        const msgEmpty = locale === 'ar' ? 'لا توجد عناصر للإرسال' : 'Please add at least one student first';
        setInlineMessage(msgEmpty);
        showAlert(locale === 'ar' ? 'لا يوجد' : 'Error', msgEmpty);
        return;
      }

      const res = await fetch(`${API_URL}/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(toSubmit),
      });

      const data = await res.json().catch(() => ({}));
      logger.log('Bulk add response', res.status, data);
      
      if (!res.ok) {
        const msg = data.error || data.msg || JSON.stringify(data);
        const details = data.details ? `\n\nDetails: ${data.details}` : '';
        logger.error('Failed to add students:', msg, data);
        const errMsg = locale === 'ar' ? `فشل إضافة المخدومين:\n${msg}${details}` : `Failed to add students:\n${msg}${details}`;
        setInlineMessage(errMsg);
        showAlert(locale === 'ar' ? '❌ خطأ' : '❌ Error', errMsg);
      } else {
        const addedCount = Array.isArray(data) ? data.length : toSubmit.length;
        const successMsg = locale === 'ar'
          ? (addedCount >= 2 ? `تمت إضافة ${addedCount} مخدومين بنجاح` : `تمت إضافة 1 مخدوم بنجاح`)
          : (addedCount >= 2 ? `Added ${addedCount} students successfully` : `Added 1 student successfully`);
        setInlineMessage(successMsg);
        showAlert(locale === 'ar' ? '✅ نجاح' : '✅ Success', successMsg);
        setStudents([]);
        setStudent(initialStudent);
      }
    } catch (err) {
      logger.error('Error adding students:', err);
      const errMsg = err.message || 'Failed to add students';
      setInlineMessage(errMsg);
      showAlert('Error', errMsg);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.headerText}>{t('addStudents')}</Text>

      <TouchableOpacity style={styles.excelButton} onPress={handlePickExcel}>
        <Ionicons name="document-text-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
        <Text style={styles.excelButtonText}>
          {locale === 'ar' ? 'استيراد مخدومين من ملف إكسل (Excel)' : 'Import Students from Excel File'}
        </Text>
      </TouchableOpacity>

      <View style={styles.formCard}>
        {}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { textAlign: locale === 'ar' ? 'right' : 'left' }]}>{t('studentName')}</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="person-outline" size={20} color="#2f4360" style={styles.inputIcon} />
            <TextInput
              value={student.fullName}
              onChangeText={(v) => handleChange('fullName', v)}
              style={[styles.input, { textAlign: locale === 'ar' ? 'right' : 'left' }]}
              placeholder={t('studentName')}
              placeholderTextColor="#a0a0a0"
            />
          </View>
        </View>

        {}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { textAlign: locale === 'ar' ? 'right' : 'left' }]}>{t('gender')}</Text>
          <View style={styles.pickerWrapper}>
            <Ionicons name="male-female-outline" size={20} color="#2f4360" style={styles.inputIcon} />
            {Platform.OS === 'web' ? (
              <select
                value={student.gender}
                onChange={(e) => handleChange('gender', e.target.value)}
                style={StyleSheet.flatten([styles.webSelect, { direction: locale === 'ar' ? 'rtl' : 'ltr' }])}
              >
                <option value="male">{locale === 'ar' ? 'ولد' : 'Boy'}</option>
                <option value="female">{locale === 'ar' ? 'بنت' : 'Girl'}</option>
              </select>
            ) : (
              <Picker
                selectedValue={student.gender}
                onValueChange={(v) => handleChange('gender', v)}
                style={styles.nativePicker}
                dropdownIconColor="#2f4360"
              >
                <Picker.Item label={locale === 'ar' ? 'ولد' : 'Boy'} value="male" />
                <Picker.Item label={locale === 'ar' ? 'بنت' : 'Girl'} value="female" />
              </Picker>
            )}
          </View>
        </View>

        {}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { textAlign: locale === 'ar' ? 'right' : 'left' }]}>{t('gradeLevel')}</Text>
          <View style={styles.pickerWrapper}>
            <Ionicons name="school-outline" size={20} color="#2f4360" style={styles.inputIcon} />
            {Platform.OS === 'web' ? (
              <select
                value={student.classLevel}
                onChange={(e) => {
                  const val = e.target.value || '';
                  handleChange('classLevel', val);
                }}
                style={StyleSheet.flatten([styles.webSelect, { direction: locale === 'ar' ? 'rtl' : 'ltr' }])}
              >
                <option value="">{t('selectLevel')}</option>
                <option value="1">{t('level1')}</option>
                <option value="2">{t('level2')}</option>
                <option value="3">{t('level3')}</option>
              </select>
            ) : (
              <Picker
                selectedValue={student.classLevel}
                onValueChange={(v) => handleChange('classLevel', String(v))}
                style={styles.nativePicker}
                dropdownIconColor="#2f4360"
              >
                <Picker.Item label={t('selectLevel')} value="" />
                <Picker.Item label={t('level1')} value="1" />
                <Picker.Item label={t('level2')} value="2" />
                <Picker.Item label={t('level3')} value="3" />
              </Picker>
            )}
          </View>
        </View>

        {}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { textAlign: locale === 'ar' ? 'right' : 'left' }]}>{t('selectClass')}</Text>
          <View style={styles.pickerWrapper}>
            <Ionicons name="people-outline" size={20} color="#2f4360" style={styles.inputIcon} />
            {student.classLevel ? (
              Platform.OS === 'web' ? (
                <select
                  value={student.classname}
                  onChange={(e) => handleChange('classname', e.target.value)}
                  style={StyleSheet.flatten([styles.webSelect, { direction: locale === 'ar' ? 'rtl' : 'ltr' }])}
                >
                  <option value="">{t('selectClass')}</option>
                  {serverClasses
                    .filter((c) => c.year === Number(student.classLevel))
                    .map((c) => (
                      <option key={c._id} value={c.name}>{c.name}</option>
                    ))}
                </select>
              ) : (
                <Picker
                  selectedValue={student.classname}
                  onValueChange={(v) => handleChange('classname', v)}
                  style={styles.nativePicker}
                  dropdownIconColor="#2f4360"
                >
                  <Picker.Item label={t('selectClass')} value="" />
                  {serverClasses
                    .filter((c) => c.year === Number(student.classLevel))
                    .map((c) => (
                      <Picker.Item key={c._id} label={c.name} value={c.name} />
                    ))}
                </Picker>
              )
            ) : (
              <View style={styles.promptBoxInside}>
                <Text style={styles.promptText}>{t('chooseLevelFirstPrompt')}</Text>
              </View>
            )}
          </View>
        </View>

        {}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { textAlign: locale === 'ar' ? 'right' : 'left' }]}>{t('motherPhone')}</Text>
          <View style={styles.inputWrapper}>
            <TouchableOpacity
              onPress={() => pickContactPhone('mother_phonenumber')}
              style={styles.inputIcon}
              activeOpacity={0.6}
            >
              <Ionicons name="call-outline" size={20} color="#2f4360" />
            </TouchableOpacity>
            <TextInput
              value={student.mother_phonenumber}
              onChangeText={(v) => handleChange('mother_phonenumber', v)}
              keyboardType="phone-pad"
              style={[styles.input, { textAlign: locale === 'ar' ? 'right' : 'left' }]}
              placeholder={t('phonePlaceholder')}
              placeholderTextColor="#a0a0a0"
            />
          </View>
          <Text style={styles.contactHint}>
            {locale === 'ar' ? '📞 اضغط على أيقونة الهاتف لاستيراد من جهات الاتصال' : '📞 Tap the phone icon to pick from contacts'}
          </Text>
        </View>

        {}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { textAlign: locale === 'ar' ? 'right' : 'left' }]}>{t('fatherPhone')}</Text>
          <View style={styles.inputWrapper}>
            <TouchableOpacity
              onPress={() => pickContactPhone('father_phonenumber')}
              style={styles.inputIcon}
              activeOpacity={0.6}
            >
              <Ionicons name="call-outline" size={20} color="#2f4360" />
            </TouchableOpacity>
            <TextInput
              value={student.father_phonenumber}
              onChangeText={(v) => handleChange('father_phonenumber', v)}
              keyboardType="phone-pad"
              style={[styles.input, { textAlign: locale === 'ar' ? 'right' : 'left' }]}
              placeholder={t('phonePlaceholder')}
              placeholderTextColor="#a0a0a0"
            />
          </View>
          <Text style={styles.contactHint}>
            {locale === 'ar' ? '📞 اضغط على أيقونة الهاتف لاستيراد من جهات الاتصال' : '📞 Tap the phone icon to pick from contacts'}
          </Text>
        </View>

        {}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { textAlign: locale === 'ar' ? 'right' : 'left' }]}>{t('birthdate')}</Text>
          <View style={styles.pickerWrapper}>
            <Ionicons name="calendar-outline" size={20} color="#2f4360" style={styles.inputIcon} />
            {Platform.OS === 'web' ? (
              <WebDateInput
                value={student.birthdate}
                onChange={(val) => handleChange('birthdate', val)}
                placeholder="dd/mm/yyyy"
                style={{ flex: 1 }}
              />
            ) : (
              <TouchableOpacity
                style={styles.nativeDatePickerBtn}
                onPress={() => setShowCalendar(true)}
              >
                <Text style={styles.datePickerBtnText}>
                  {student.birthdate ? formatDateDDMMYYYY(student.birthdate) : t('pickBirthdate')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {showCalendar && DateTimePickerModal && (
            <DateTimePickerModal
              isVisible={showCalendar}
              mode="date"
              date={student.birthdate ? new Date(student.birthdate) : new Date()}
              onConfirm={(d) => {
                setShowCalendar(false);
                handleChange('birthdate', d.toISOString());
              }}
              onCancel={() => setShowCalendar(false)}
            />
          )}
        </View>

        {}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleAddStudent}>
            <Ionicons name="add-circle-outline" size={20} color="#2f4360" style={{ marginRight: 6 }} />
            <Text style={styles.secondaryButtonText}>{t('addToQueue')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit}>
            <Ionicons name="cloud-upload-outline" size={20} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.primaryButtonText}>{t('submitAll')}</Text>
          </TouchableOpacity>
        </View>

        {inlineMessage ? (
          <Text style={styles.statusText}>{inlineMessage}</Text>
        ) : null}
      </View>

      {}
      <Modal visible={contactPickerVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{locale === 'ar' ? 'اختر تليفون جهة الاتصال' : 'Pick Contact Phone'}</Text>
              <TouchableOpacity onPress={() => setContactPickerVisible(false)}>
                <Ionicons name="close-circle-outline" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            {loadingContacts ? (
              <View style={{ padding: 30, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#2f4360" />
              </View>
            ) : (
              <FlatList
                data={contactsList}
                keyExtractor={(item, i) => `${item.id || 'c'}_${i}`}
                renderItem={({ item }) => (
                  <View style={styles.contactRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: 'bold', color: '#2f4360' }}>{item.name || 'No name'}</Text>
                      {item.phones.map((p, i2) => (
                        <TouchableOpacity
                          key={i2}
                          onPress={() => {
                            let num = p.number.replace(/\D/g, ''); 
                            if (num.startsWith('201') && num.length === 12) {
                              num = '0' + num.substring(2);
                            } else if (num.startsWith('00201') && num.length === 14) {
                              num = '0' + num.substring(4);
                            }
                            handleChange(contactPickerField, num);
                            setContactPickerVisible(false);
                          }}
                          style={{ paddingVertical: 8 }}
                        >
                          <Text style={{ color: '#555' }}>
                            {p.label ? `${p.label}: ` : ''}
                            {p.number}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {}
      <Modal visible={customAlertVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons 
                  name={customAlertTitle.includes('نجاح') || customAlertTitle.includes('Success') || customAlertTitle.includes('تم') ? 'checkmark-circle-outline' : 'information-circle-outline'} 
                  size={24} 
                  color="#2f4360" 
                />
                <Text style={styles.modalTitle}>{customAlertTitle}</Text>
              </View>
            </View>
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 15, color: '#333333', lineHeight: 22, textAlign: locale === 'ar' ? 'right' : 'left' }}>{customAlertMessage}</Text>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.modalPrimaryBtn} 
                onPress={() => setCustomAlertVisible(false)}
              >
                <Text style={styles.modalPrimaryBtnText}>{t('ok')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f5ee',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  headerText: {
    fontWeight: 'bold',
    fontSize: 24,
    color: '#2f4360',
    marginBottom: 24,
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.1)',
    ...Platform.select({
      ios: {
        shadowColor: '#2f4360',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 6px 12px rgba(47, 67, 96, 0.06)',
      }
    }),
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2f4360',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.16)',
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  pickerWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.16)',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  inputIcon: {
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    paddingRight: 12,
    paddingLeft: 12,
    fontSize: 15,
    color: '#333333',
    borderWidth: 0,
    outlineStyle: 'none',
  },
  webSelect: {
    flex: 1,
    padding: 10,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontSize: 15,
    color: '#333333',
    outlineStyle: 'none',
  },
  nativePicker: {
    flex: 1,
    height: 44,
  },
  webDateInput: {
    flex: 1,
    padding: 10,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontSize: 15,
    color: '#333333',
    outlineStyle: 'none',
  },
  nativeDatePickerBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  datePickerBtnText: {
    fontSize: 15,
    color: '#333333',
  },
  promptBoxInside: {
    flex: 1,
    padding: 12,
  },
  promptText: {
    flex: 1,
    fontSize: 13,
    color: '#666666',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2f4360',
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(47, 67, 96, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.16)',
    paddingVertical: 12,
    borderRadius: 8,
  },
  secondaryButtonText: {
    color: '#2f4360',
    fontWeight: 'bold',
    fontSize: 15,
  },
  statusText: {
    textAlign: 'center',
    color: '#666666',
    marginTop: 16,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2f4360',
  },
  contactRow: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  modalFooter: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 8,
  },
  modalPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2f4360',
    paddingVertical: 12,
    borderRadius: 8,
  },
  modalPrimaryBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  excelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#107c41',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#0b592e',
    ...Platform.select({
      ios: {
        shadowColor: '#107c41',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 4px 6px rgba(16, 124, 65, 0.15)',
      }
    }),
  },
  excelButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  contactHint: {
    fontSize: 11,
    color: '#888888',
    marginTop: 4,
    marginLeft: 4,
  },
});