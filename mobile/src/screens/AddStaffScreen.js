import React, { useState, useRef } from 'react';
import { View, Text, Animated, TextInput, ScrollView, Alert, Modal, TouchableOpacity, Platform, StyleSheet, Switch } from 'react-native';
import axios from 'axios';
import { logger } from '../utils/logger';
import { API_URL } from '../config/api';
import { getAuthToken } from '../config/authSession';
import { useLanguage } from '../utils/LanguageContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { loadContactsForPicker } from '../utils/contactPicker';
import { formatDateDDMMYYYY } from '../utils/dateFormatter';
let Clipboard = null;
if (typeof Platform !== 'undefined' && Platform.OS !== 'web') {
  try {
    Clipboard = require('expo-clipboard');
  } catch (e) {
    Clipboard = null;
  }
}

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Picker } from '@react-native-picker/picker';

import { useTheme } from '../utils/ThemeContext';
let DateTimePickerModal = null;
if (Platform.OS !== 'web') {
  try {
    DateTimePickerModal = require('react-native-modal-datetime-picker').default;
  } catch (e) {
    DateTimePickerModal = null;
  }
}

const initialStaff = {
  fullName: '',
  username: '',
  password: '',
  role: '',
  gender: 'Male',
  isActive: true,
  googleCode: '',
  address: '',
  phonenumber: '',
  telegramChatId: '',
  birthdate: '',
  studentsassigned: [],
  assignedclass: '',
  deviceId: '',
  lockedDeviceId: '',
  assignedlevel: '',
  isClassLeader: false,
};

const CLASS_OPTIONS = {
  '1': ['فصل السيرافيم', 'فصل الشاروبيم'],
  '2': ['الملاك رفائيل', 'الملاك ميخائيل'],
  '3': ['الملاك سوريال', 'الملاك غبريال'],
};

const classTranslations = {
  'فصل السيرافيم': 'classSeraphim',
  'فصل الشاروبيم': 'classCherubim',
  'الملاك رفائيل': 'classRaphael',
  'الملاك ميخائيل': 'classMichael',
  'الملاك سوريال': 'classSuriel',
  'الملاك غبريال': 'classGabriel',
};

export default function AddStaffScreen({ route, navigation }) {const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode);
  const { token: routeToken, role: requesterRole } = route?.params || {};
  const token = routeToken || getAuthToken();
  const { t, locale } = useLanguage();
  const isRtl = locale === 'ar';
  const [stats, setStats] = useState({ principalCount: 0, coPrincipalCount: 0 });
  const [staff, setStaff] = useState(initialStaff);
  const [staffList, setStaffList] = useState([]);
  const [credModalVisible, setCredModalVisible] = useState(false);
  const [generatedCreds, setGeneratedCreds] = useState(null);
  const [studentQuery, setStudentQuery] = useState('');
  const [studentResults, setStudentResults] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]); 
  const [showCalendar, setShowCalendar] = useState(false);
  const [inlineMessage, setInlineMessage] = useState('');

  const [contactsList, setContactsList] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactPickerVisible, setContactPickerVisible] = useState(false);

  const [customAlertVisible, setCustomAlertVisible] = useState(false);
  const [customAlertTitle, setCustomAlertTitle] = useState('');
  const [customAlertMessage, setCustomAlertMessage] = useState('');

  const toastOpacity = useRef(new Animated.Value(0)).current;

  const showAlert = (title, message) => {
    setCustomAlertTitle(title);
    setCustomAlertMessage(message || '');
    setCustomAlertVisible(true);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true })
    ]).start(() => setCustomAlertVisible(false));
  };

  const pickContactForStaff = async () => {
    setLoadingContacts(true);
    try {
      const contacts = await loadContactsForPicker(showAlert);
      if (contacts) {
        setContactsList(contacts);
        setContactPickerVisible(true);
      }
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleChange = (key, value) => setStaff({ ...staff, [key]: value });

  const handleRoleChange = (roleVal) => {
    setStaff(prev => {
      
      const normalized = String(roleVal).trim().replace(/\s+/g, '');
      if (['امينالخدمة', 'أمينالخدمة', 'امينالخدمه', 'أمينالخدمه'].includes(normalized) || roleVal === 'principal') {
        roleVal = 'principal';
      } else if (['امينهالمرحله', 'امينهالمرحلة', 'امينهالمرحله', 'امینهالمرحله'].includes(normalized) || roleVal === 'co-principal') {
        roleVal = 'co-principal';
      } else if (['خادمفصل', 'خادم'].includes(normalized) || roleVal === 'teacher') {
        roleVal = 'teacher';
      }

      if (roleVal === 'principal') {
        
        return { ...prev, role: roleVal, assignedlevel: '', assignedclass: '' };
      }
      if (roleVal === 'co-principal') {
        
        const assignedLevels = stats.assignedCoPrincipalLevels || [];
        const available = [1, 2, 3].filter(lvl => !assignedLevels.includes(lvl));
        const defaultLvl = available.length > 0 ? String(available[0]) : '';
        return { ...prev, role: roleVal, assignedlevel: defaultLvl, assignedclass: '' };
      }
      return { ...prev, role: roleVal };
    });
  };

  const handleLevelChange = (lvl) => {
    
    setStaff(prev => {
      const next = { ...prev, assignedlevel: String(lvl || '') };
      
      if (prev.role !== 'co-principal') {
        const opts = CLASS_OPTIONS[String(lvl)] || [];
        next.assignedclass = opts.length ? opts[0] : '';
      }
      return next;
    });
  };

  const handleClassChange = (cls) => {
    setStaff(prev => ({ ...prev, assignedclass: cls }));
  };

  const generateUsernameOnDemand = () => {
    const name = staff.fullName;
    
    const cleanName = (name || '').trim();
    const parts = cleanName.split(/\s+/).filter(Boolean);
    let base = 'user';
    if (parts.length > 0) {
      base = parts[0];
    }
    
    base = base.replace(/[\s\-_\.]/g, '');
    if (!base) base = 'user';
    
    const suffix = Math.floor(Math.random() * 90000 + 10000);
    const username = `${base}${suffix}`;
    
    handleChange('username', username);
  };

  const generatePasswordOnDemand = () => {
    const length = 16;
    const uppers = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowers = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const symbols = '!@#$%^&*()-_=+[]{}|;:,.<>?';
    const all = uppers + lowers + digits + symbols;
    const rand = (chars) => chars.charAt(Math.floor(Math.random() * chars.length));
    let pw = '';
    
    pw += rand(uppers) + rand(uppers);
    pw += rand(lowers) + rand(lowers);
    pw += rand(digits) + rand(digits);
    pw += rand(symbols) + rand(symbols);
    
    for (let i = pw.length; i < length; i++) pw += rand(all);
    
    for (let i = 0; i < 3; i++) {
      pw = pw.split('').sort(() => 0.5 - Math.random()).join('');
    }
    handleChange('password', pw);
  };

  React.useEffect(() => {
    
    if (!token) {
      const msg = 'No authentication token found. Please login again.';
      setInlineMessage(msg);
      showAlert('Authentication Error', msg);
      return;
    }

    (async () => {
      try {
        const res = await axios.get(`${API_URL}/users/staff-stats`, { 
          headers: { Authorization: `Bearer ${token}` } 
        });
        setStats(res.data || {});
      } catch (err) {
        logger.error('Failed to fetch staff stats:', err);
        if (err.response?.status === 401) {
          const msg = 'Your session has expired. Please login again.';
          setInlineMessage(msg);
          showAlert('Session Expired', msg);
        }
      }
    })();

    try {
      const devId = Device.osInternalBuildId || Device.deviceName || Constants.installationId || '';
      handleChange('deviceId', devId);
      handleChange('lockedDeviceId', devId);
    } catch (e) {}
  }, [token]);

  const formatDateNoYear = (dateStr) => {
    return formatDateDDMMYYYY(dateStr);
  };

  const PICKER_YEAR = 2000;
  const toPickerDateObj = (dateStr) => {
    try {
      const d = dateStr ? new Date(dateStr) : new Date();
      d.setFullYear(PICKER_YEAR);
      return d;
    } catch (e) {
      const d = new Date(); d.setFullYear(PICKER_YEAR); return d;
    }
  };
  const toStoredIsoWithPickerYear = (dateObj) => {
    try {
      const d = new Date(dateObj);
      d.setFullYear(PICKER_YEAR);
      return d.toISOString();
    } catch (e) {
      const d = new Date(); d.setFullYear(PICKER_YEAR); return d.toISOString();
    }
  };

  const handleAddOne = () => {
    
    const missing = [];
    if (!staff.fullName || String(staff.fullName).trim() === '') missing.push('fullName');
    if (!staff.username || String(staff.username).trim() === '') missing.push('username');
    if (!staff.password || String(staff.password).trim() === '') missing.push('password');
    if (!staff.role || String(staff.role).trim() === '') missing.push('role');
    if (missing.length) {
      const labels = {
        fullName: 'الاسم',
        username: 'اسم المستخدم',
        password: 'كلمة المرور',
        role: 'المنصب',
      };
      const human = missing.map(k => labels[k] || k).join(', ');
      const msg = `من فضلك أدخل: ${human}`;
      setInlineMessage(msg);
      showAlert('حقول مفقودة', msg);
      return;
    }

    const toAdd = {
      fullName: String(staff.fullName).trim(),
      username: String(staff.username).trim(),
      password: String(staff.password),
      role: String(staff.role),
      isActive: staff.isActive === undefined ? true : !!staff.isActive,
      googleCode: staff.googleCode || '',
      address: staff.address || '',
      phonenumber: staff.phonenumber || '',
      birthdate: staff.birthdate || '',
      studentsassigned: [], 
      assignedclass: staff.assignedclass || '',
      deviceId: staff.deviceId || '',
      lockedDeviceId: staff.lockedDeviceId || '',
      
      assignedlevel: (staff.assignedlevel !== undefined && staff.assignedlevel !== '') ? staff.assignedlevel : undefined,
      telegramChatId: staff.telegramChatId || '',
    };

    setStaffList(prev => [...prev, toAdd]);
    setStaff(initialStaff);
    setInlineMessage(locale === 'ar' ? 'تمت الإضافة إلى قائمة الانتظار' : 'Added to queue list');
    
    showAlert(locale === 'ar' ? 'تمت الإضافة' : 'Added', locale === 'ar' ? 'العنصر أُضيف إلى قائمة الانتظار' : 'Item added to queue list.');
  };

  const handleSubmit = async () => {
    try {
      
      if (!token) {
        const msg = 'No authentication token. Please login again.';
        setInlineMessage(msg);
        showAlert('Authentication Error', msg);
        return;
      }

      let toProcess = [...staffList];
      let directFormSubmission = false;
      if (toProcess.length === 0) {
        if (staff.fullName || staff.username || staff.role) {
          const missing = [];
          if (!staff.fullName || String(staff.fullName).trim() === '') missing.push('fullName');
          if (!staff.username || String(staff.username).trim() === '') missing.push('username');
          if (!staff.password || String(staff.password).trim() === '') missing.push('password');
          if (!staff.role || String(staff.role).trim() === '') missing.push('role');
          if (missing.length) {
            const labels = {
              fullName: t('fullNameLabel') || 'الاسم',
              username: t('usernameLabel') || 'اسم المستخدم',
              password: t('passwordLabel') || 'كلمة المرور',
              role: t('roleLabel') || 'المنصب',
            };
            const human = missing.map(k => labels[k] || k).join(', ');
            const msg = locale === 'ar' ? `من فضلك أدخل: ${human}` : `Please fill out: ${human}`;
            setInlineMessage(msg);
            showAlert(locale === 'ar' ? 'حقول مفقودة' : 'Missing fields', msg);
            return;
          }
          const toAdd = {
            fullName: String(staff.fullName).trim(),
            username: String(staff.username).trim(),
            password: String(staff.password),
            role: String(staff.role),
            isActive: staff.isActive === undefined ? true : !!staff.isActive,
            googleCode: staff.googleCode || '',
            address: staff.address || '',
            phonenumber: staff.phonenumber || '',
            birthdate: staff.birthdate || '',
            studentsassigned: [],
            assignedclass: staff.assignedclass || '',
            deviceId: staff.deviceId || '',
            lockedDeviceId: staff.lockedDeviceId || '',
            assignedlevel: (staff.assignedlevel !== undefined && staff.assignedlevel !== '') ? staff.assignedlevel : undefined,
            telegramChatId: staff.telegramChatId || '',
          };
          toProcess = [toAdd];
          directFormSubmission = true;
        } else {
          const msgEmpty = locale === 'ar' ? 'لا توجد عناصر للإرسال' : 'No items to submit';
          setInlineMessage(msgEmpty);
          showAlert(locale === 'ar' ? 'تنبيه' : 'Alert', msgEmpty);
          return;
        }
      }

      const created = [];
      const failed = [];
      let remaining = [...staffList];
      
      for (const s of toProcess) {
        
        const payload = { ...s };
        if (typeof payload.isActive === 'string') payload.isActive = payload.isActive === 'true' || payload.isActive === '1';
        
        if (payload.assignedlevel !== undefined && payload.assignedlevel !== '' && payload.assignedlevel !== null) {
          const n = Number(payload.assignedlevel);
          payload.assignedlevel = isNaN(n) ? undefined : n;
        } else {
          delete payload.assignedlevel;
        }

        payload.studentsassigned = [];

        try {
          const res = await axios.post(`${API_URL}/users/staff`, payload, { 
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            } 
          });
          const creds = {
            fullName: payload.fullName || s.fullName,
            username: res.data?.credentials?.username || payload.username || s.username,
            password: res.data?.credentials?.password || payload.password || s.password
          };
          created.push(creds);
          
          const idx = remaining.findIndex(item => item.username === s.username && item.fullName === s.fullName);
          if (idx !== -1) remaining.splice(idx, 1);
          
          setStaffList([...remaining]);
        } catch (err) {
          logger.error('Failed to add staff:', err.response?.data || err.message);

          if (err.response?.status === 401) {
            const authMsg = 'Session expired or invalid token. Please login again.';
            setInlineMessage(authMsg);
            showAlert('Authentication Error', authMsg);
            
            break;
          }
          
          failed.push({ item: s, err: err.response?.data?.msg || err.message || 'Unknown error' });
          
        }
      }
      
      if (created.length) {
        setGeneratedCreds(created);
        setCredModalVisible(true);
      }
      
      let msg = '';
      let alertTitle = '';
      if (locale === 'ar') {
        if (failed.length === 0) {
          alertTitle = 'تم الإرسال بنجاح';
          msg = created.length === 1 
            ? 'تمت إضافة خادم واحد بنجاح.' 
            : `تمت إضافة ${created.length} من الخدام بنجاح.`;
        } else {
          alertTitle = 'تم الإرسال مع أخطاء';
          msg = `تمت إضافة ${created.length} من الخدام. فشل: ${failed.length}`;
        }
      } else {
        if (failed.length === 0) {
          alertTitle = 'Submitted Successfully';
          msg = created.length === 1 
            ? 'Successfully added 1 servant.' 
            : `Successfully added ${created.length} servants.`;
        } else {
          alertTitle = 'Submitted with Errors';
          msg = `Successfully added ${created.length} servant(s). Failed: ${failed.length}`;
        }
      }
      setInlineMessage(msg);
      
      if (failed.length > 0) {
        const failedDetails = failed.map(f => `${f.item.fullName}: ${f.err}`).join('\n');
        const detailHeader = locale === 'ar' ? 'التفاصيل:' : 'Details:';
        showAlert(alertTitle, `${msg}\n\n${detailHeader}\n${failedDetails}`);
      } else {
        showAlert(alertTitle, msg);
        if (directFormSubmission) {
          setStaff(initialStaff);
        }
      }
    } catch (err) {
      logger.error('Submit error:', err);
      const defaultErr = locale === 'ar' ? 'فشل إضافة الخادم' : 'Failed to add servant';
      const errMsg = err.response?.data?.msg || err.message || defaultErr;
      const errorTitle = locale === 'ar' ? 'خطأ' : 'Error';
      setInlineMessage(errMsg);
      showAlert(errorTitle, errMsg);
    }
  };

  const copyToClipboard = async (text) => {
    if (Clipboard && Clipboard.setStringAsync) {
      await Clipboard.setStringAsync(text);
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    }
    setInlineMessage(locale === 'ar' ? 'تم النسخ إلى الحافظة' : 'Copied to clipboard');
    showAlert(locale === 'ar' ? 'تم النسخ' : 'Copied', locale === 'ar' ? 'تم النسخ إلى الحافظة' : 'Copied to clipboard');
  };

  if (!token) {
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ color: 'red', fontWeight: 'bold', fontSize: 18 }}>
          Authentication Error
        </Text>
        <Text style={{ marginTop: 8 }}>
          No authentication token found. Please login again.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }, { backgroundColor: theme.background }]} contentContainerStyle={styles.scrollContent}>
      <View style={styles.formCard}>
        {}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { textAlign: 'left' }]}>{t('fullNameLabel')}</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="person-outline" size={20} color={theme.iconColor} style={styles.inputIcon} />
            <TextInput 
              value={staff.fullName} 
              onChangeText={val => handleChange('fullName', val)} 
              style={[styles.input, { textAlign: 'right' }]} 
              placeholder={t('fullNameLabel')}
              placeholderTextColor={theme.textMuted}
            />
          </View>
        </View>
        
        {}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { textAlign: 'left' }]}>{t('roleLabel')}</Text>
          <View style={styles.pickerWrapper}>
            <Ionicons name="ribbon-outline" size={20} color={theme.iconColor} style={styles.inputIcon} />
            {Platform && Platform.OS === 'web' ? (
              <select
                value={staff.role}
                onChange={(e) => handleRoleChange(e.target.value)}
                style={{
                  ...styles.webSelect,
                  textAlign: 'right',
                  direction: 'rtl',
                  fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
                }}
              >
                <option value="">-- اختر المنصب --</option>
                {requesterRole === 'admin' && stats.principalCount === 0 && <option value="principal">أمين الخدمة</option>}
                {stats.coPrincipalCount < 3 && (requesterRole === 'admin' || requesterRole === 'principal') && <option value="co-principal">أمين مرحلة</option>}
                <option value="teacher">خادم فصل</option>
              </select>
            ) : (
              <Picker 
                selectedValue={staff.role} 
                onValueChange={val => handleRoleChange(val)}
                style={styles.nativePicker}
                dropdownIconColor="#2f4360"
              >
                <Picker.Item label="-- اختر المنصب --" value="" />
                {requesterRole === 'admin' && stats.principalCount === 0 && <Picker.Item label="أمين الخدمة" value="principal" />}
                {stats.coPrincipalCount < 3 && (requesterRole === 'admin' || requesterRole === 'principal') && <Picker.Item label="أمين مرحلة" value="co-principal" />}
                <Picker.Item label="خادم فصل" value="teacher" />
              </Picker>
            )}
          </View>
        </View>

        {/* Gender */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { textAlign: 'left' }]}>{locale === 'ar' ? 'النوع' : 'Gender'}</Text>
          <View style={[styles.pickerContainer, { backgroundColor: theme.inputBackground, borderColor: theme.borderColor }]}>
            {Platform.OS === 'web' ? (
              <select
                value={staff.gender || 'Male'}
                onChange={e => handleChange('gender', e.target.value)}
                style={styles.webSelect}
              >
                <option value="Male">{locale === 'ar' ? 'خادم' : 'Male'}</option>
                <option value="Female">{locale === 'ar' ? 'خادمة' : 'Female'}</option>
              </select>
            ) : (
              <Picker 
                selectedValue={staff.gender || 'Male'} 
                onValueChange={val => handleChange('gender', val)}
                style={styles.nativePicker}
                dropdownIconColor="#2f4360"
              >
                <Picker.Item label={locale === 'ar' ? 'خادم' : 'Male'} value="Male" />
                <Picker.Item label={locale === 'ar' ? 'خادمة' : 'Female'} value="Female" />
              </Picker>
            )}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { textAlign: 'left' }]}>{t('telegramChatIdLabel')}</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="paper-plane-outline" size={20} color={theme.iconColor} style={styles.inputIcon} />
            <TextInput 
              value={staff.telegramChatId} 
              onChangeText={val => handleChange('telegramChatId', val)} 
              keyboardType="numeric"
              style={[styles.input, { flex: 1, textAlign: 'left' }]} 
              placeholder={t('telegramChatIdPlaceholder')}
              placeholderTextColor={theme.textMuted}
            />
          </View>
          <Text style={styles.contactHint}>
            💡 {t('telegramChatIdHint')}
          </Text>
        </View>
        
        {}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { textAlign: 'left' }]}>{t('birthdate')}</Text>
          <View style={styles.pickerWrapper}>
            <Ionicons name="calendar-outline" size={20} color={theme.iconColor} style={styles.inputIcon} />
            {Platform.OS === 'web' ? (
              <>
                <View style={{ flex: 1, minHeight: 40, justifyContent: 'center', paddingLeft: 12 }} pointerEvents="none">
                  <Text style={{ color: staff.birthdate ? theme.text : theme.textMuted, fontSize: 15 }}>
                    {staff.birthdate ? formatDateDDMMYYYY(staff.birthdate) : 'dd/mm/yyyy'}
                  </Text>
                </View>
                <input
                  type="date"
                  value={staff.birthdate ? staff.birthdate.split('T')[0] : ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) {
                      const d = new Date(v);
                      d.setFullYear(PICKER_YEAR);
                      handleChange('birthdate', d.toISOString());
                    } else {
                      handleChange('birthdate', '');
                    }
                  }}
                  onClick={(e) => {
                    try { e.target.showPicker(); } catch (err) {}
                  }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer',
                    zIndex: 2,
                  }}
                />
              </>
            ) : (
              <TouchableOpacity
                style={styles.nativeDatePickerBtn}
                onPress={() => setShowCalendar(true)}
              >
                <Text style={styles.datePickerBtnText}>
                  {staff.birthdate ? formatDateNoYear(staff.birthdate) : t('pickBirthdate')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {DateTimePickerModal && (
            <DateTimePickerModal
              isVisible={showCalendar}
              mode="date"
              date={toPickerDateObj(staff.birthdate)}
              onConfirm={(date) => { setShowCalendar(false); handleChange('birthdate', toStoredIsoWithPickerYear(date)); }}
              onCancel={() => setShowCalendar(false)}
            />
          )}
        </View>
        
        {}
        {!staff.role ? (
          <View style={styles.promptBox}>
            <Ionicons name="information-circle-outline" size={20} color={theme.iconColor} style={{ marginRight: 6 }} />
            <Text style={styles.promptText}>{t('chooseRoleFirstPrompt')}</Text>
          </View>
        ) : (staff.role === 'teacher' || staff.role === 'co-principal') ? (
          <>
            {}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { textAlign: 'left' }]}>{t('gradeLevel')}</Text>
              <View style={styles.pickerWrapper}>
                <Ionicons name="school-outline" size={20} color={theme.iconColor} style={styles.inputIcon} />
                {(() => {
                  const levelOptions = [
                    { label: locale === 'ar' ? 'سنة أولى' : 'Year 1', value: 1 },
                    { label: locale === 'ar' ? 'سنة ثانية' : 'Year 2', value: 2 },
                    { label: locale === 'ar' ? 'سنة ثالثة' : 'Year 3', value: 3 }
                  ].filter(opt => {
                    if (staff.role === 'co-principal') {
                      const assignedLevels = stats.assignedCoPrincipalLevels || [];
                      return !assignedLevels.includes(opt.value);
                    }
                    return true;
                  });

                  return Platform.OS === 'web' ? (
                    <select
                      value={staff.assignedlevel}
                      onChange={(e) => {
                        const lvl = e.target.value || '';
                        handleLevelChange(lvl);
                      }}
                      style={{
                        ...styles.webSelect,
                        textAlign: 'right',
                        direction: 'rtl',
                        fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
                      }}
                    >
                      <option value="">{locale === 'ar' ? '-- اختر المرحلة --' : '-- Choose Level --'}</option>
                      {levelOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <Picker 
                      selectedValue={staff.assignedlevel} 
                      onValueChange={val => {
                        const lvl = String(val || '');
                        handleLevelChange(lvl);
                      }}
                      style={styles.nativePicker}
                      dropdownIconColor="#2f4360"
                    >
                      <Picker.Item label={locale === 'ar' ? '-- اختر المرحلة --' : '-- Choose Level --'} value="" />
                      {levelOptions.map(opt => (
                        <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
                      ))}
                    </Picker>
                  );
                })()}
              </View>
            </View>

            {}
            {}
            {staff.role === 'teacher' && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { textAlign: 'left' }]}>{t('selectClass')}</Text>
                  <View style={styles.pickerWrapper}>
                    <Ionicons name="people-outline" size={20} color={theme.iconColor} style={styles.inputIcon} />
                    {staff.assignedlevel ? (
                      Platform.OS === 'web' ? (
                        <select
                          value={staff.assignedclass}
                          onChange={(e) => handleClassChange(e.target.value)}
                          style={{
                            ...styles.webSelect,
                            textAlign: 'right',
                            direction: 'rtl',
                            fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
                          }}
                        >
                          <option value="">-- اختر الفصل --</option>
                          {(CLASS_OPTIONS[staff.assignedlevel] || []).map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <Picker
                          selectedValue={staff.assignedclass}
                          onValueChange={val => handleClassChange(val)}
                          style={styles.nativePicker}
                          dropdownIconColor="#2f4360"
                        >
                          <Picker.Item label="-- اختر الفصل --" value="" />
                          {(CLASS_OPTIONS[staff.assignedlevel] || []).map(opt => (
                            <Picker.Item key={opt} label={opt} value={opt} />
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
                <View style={[styles.inputGroup, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0', marginTop: 10 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="star-outline" size={20} color={theme.iconColor} style={{ marginRight: 8 }} />
                    <Text style={[styles.label, { marginBottom: 0 }]}>
                      {locale === 'ar' ? 'أمين الفصل' : 'Class Leader'}
                    </Text>
                  </View>
                  <Switch
                    value={staff.isClassLeader}
                    onValueChange={(val) => handleChange('isClassLeader', val)}
                    trackColor={{ false: '#d1d1d1', true: '#2f4360' }}
                    thumbColor={staff.isClassLeader ? '#ffffff' : '#f4f3f4'}
                  />
                </View>
              </>
            )}
          </>
        ) : staff.role === 'principal' ? (
          <View style={styles.promptBox}>
            <Ionicons name="information-circle-outline" size={20} color={theme.iconColor} style={{ marginRight: 6 }} />
            <Text style={styles.promptText}>{t('principalNoLevelPrompt')}</Text>
          </View>
        ) : null}
        
        {}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { textAlign: 'left' }]}>{t('usernameLabel')}</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="keypad-outline" size={20} color={theme.iconColor} style={styles.inputIcon} />
            <TextInput 
              value={staff.username} 
              onChangeText={val => handleChange('username', val)} 
              style={[styles.input, { textAlign: 'left' }]} 
              placeholder={t('usernameLabel')}
              placeholderTextColor={theme.textMuted}
            />
            <TouchableOpacity 
              onPress={generateUsernameOnDemand} 
              style={styles.inlineActionBtn}
            >
              <Ionicons name="sparkles-outline" size={18} color={theme.iconColor} />
            </TouchableOpacity>
          </View>
        </View>
        
        {}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { textAlign: 'left' }]}>{t('passwordLabel')}</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color={theme.iconColor} style={styles.inputIcon} />
            <TextInput 
              value={staff.password} 
              onChangeText={val => handleChange('password', val)} 
              secureTextEntry 
              style={[styles.input, { textAlign: 'left' }]} 
              placeholder={t('passwordLabel')}
              placeholderTextColor={theme.textMuted}
            />
            <TouchableOpacity 
              onPress={generatePasswordOnDemand} 
              style={styles.inlineActionBtn}
            >
              <Ionicons name="refresh-outline" size={18} color={theme.iconColor} />
            </TouchableOpacity>
          </View>
        </View>

        {}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleAddOne}>
            <Ionicons name="add-circle-outline" size={20} color={theme.iconColor} style={{ marginRight: 6 }} />
            <Text style={styles.secondaryButtonText}>{t('addToQueue')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit}>
            <Ionicons name="cloud-upload-outline" size={20} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.primaryButtonText}>{t('submitAll')}</Text>
          </TouchableOpacity>
        </View>

        {inlineMessage ? (
          <Text style={styles.statusText}>{inlineMessage}</Text>
        ) : null}
      </View>

      {}
      <Modal visible={credModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Ionicons name="key-outline" size={24} color={theme.iconColor} />
              <Text style={[styles.modalTitle, { color: theme.text }, { color: theme.text }]}>{t('credentialsTitle')}</Text>
            </View>
            <View style={styles.modalBody}>
              {generatedCreds && generatedCreds.length > 1 ? (
                <View style={{ width: '100%' }}>
                  <Text style={[styles.credInstruction, { textAlign: 'left' }]}>
                    {isRtl 
                      ? 'تم إنشاء الحسابات التالية بنجاح. يمكنك نسخها بالكامل أدناه:' 
                      : 'The following accounts were created successfully. You can copy them in bulk below:'}
                  </Text>
                  <TextInput
                    style={styles.bulkTextArea}
                    value={(() => {
                      if (!generatedCreds || !generatedCreds.length) return '';
                      return generatedCreds.map(c => `${c.username || ''}, ${c.password || ''}`).join('\n');
                    })()}
                    multiline
                    editable={false}
                    selectTextOnFocus
                  />
                </View>
              ) : (
                <View style={{ width: '100%' }}>
                  <View style={styles.credRow}>
                    <Text style={styles.credLabel}>{isRtl ? 'الاسم' : 'Name'}:</Text>
                    <Text style={styles.credValue}>{generatedCreds?.[0]?.fullName}</Text>
                  </View>
                  <View style={styles.credRow}>
                    <Text style={styles.credLabel}>{t('usernameLabel')}:</Text>
                    <Text style={styles.credValue}>{generatedCreds?.[0]?.username}</Text>
                  </View>
                  <View style={styles.credRow}>
                    <Text style={styles.credLabel}>{t('passwordLabel')}:</Text>
                    <Text style={styles.credValue}>{generatedCreds?.[0]?.password}</Text>
                  </View>
                </View>
              )}
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.modalPrimaryBtn} 
                onPress={() => {
                  if (!generatedCreds || !generatedCreds.length) return;
                  if (generatedCreds.length === 1) {
                    copyToClipboard(`${generatedCreds[0].username}, ${generatedCreds[0].password}`);
                  } else {
                    const text = generatedCreds.map(c => `${c.username || ''}, ${c.password || ''}`).join('\n');
                    copyToClipboard(text);
                  }
                }}
              >
                <Ionicons name="copy-outline" size={18} color={theme.iconColor} style={{ marginRight: 6 }} />
                <Text style={styles.modalPrimaryBtnText}>{t('copyClipboard')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSecondaryBtn} onPress={() => setCredModalVisible(false)}>
                <Text style={styles.modalSecondaryBtnText}>{t('close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {}
      {customAlertVisible && (
        <Animated.View style={[
          styles.toastContainer, 
          { backgroundColor: theme.cardBackground, borderColor: theme.borderColor, opacity: toastOpacity }
        ]} pointerEvents="none">
          <Text style={[styles.toastMessage, { color: theme.text, textAlign: 'center' }]}>
            {customAlertMessage}
          </Text>
        </Animated.View>
      )}

      {}
      <Modal visible={contactPickerVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }, { maxHeight: '80%', padding: 0 }]}>
            <View style={[styles.modalHeader, { paddingHorizontal: 16, paddingTop: 16 }]}>
              <Ionicons name="people-outline" size={22} color={theme.iconColor} />
              <Text style={[styles.modalTitle, { color: theme.text }, { color: theme.text }]}>
                {locale === 'ar' ? 'اختر جهة اتصال' : 'Pick a Contact'}
              </Text>
              <TouchableOpacity onPress={() => setContactPickerVisible(false)} style={{ marginLeft: 'auto' }}>
                <Ionicons name="close-circle-outline" size={24} color={theme.iconColor} />
              </TouchableOpacity>
            </View>
            {loadingContacts ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Text style={{ color: theme.text }}>{locale === 'ar' ? 'جارٍ التحميل...' : 'Loading...'}</Text>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                {contactsList.map((contact, ci) => (
                  <View key={ci} style={styles.contactRow}>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    {contact.phones.map((p, pi) => (
                      <TouchableOpacity
                        key={pi}
                        style={styles.contactPhone}
                        onPress={() => {
                          handleChange('phonenumber', p.number);
                          setContactPickerVisible(false);
                        }}
                      >
                        <Ionicons name="call-outline" size={14} color={theme.iconColor} style={{ marginRight: 6 }} />
                        <Text style={styles.contactPhoneText}>{p.number}</Text>
                        <Text style={styles.contactPhoneLabel}> ({p.label})</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const getStyles = (theme, isDarkMode) => StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    maxWidth: '90%',
    borderRadius: 30,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toastMessage: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
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
    color: theme.text,
    marginBottom: 24,
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  formCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.borderColor,
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
    color: theme.text,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 8,
    backgroundColor: theme.cardBackground,
  },
  pickerWrapper: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 8,
    backgroundColor: theme.cardBackground,
    overflow: 'hidden',
    height: 45,
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
    color: theme.text,
    borderWidth: 0,
    outlineStyle: 'none',
  },
  webSelect: {
    flex: 1,
    padding: 10,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontSize: 15,
    color: theme.text,
    outlineStyle: 'none',
    height: '100%',
  },
  nativePicker: {
    flex: 1,
    height: 44,
  },
  webDateInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    outlineStyle: 'none',
    cursor: 'pointer',
    zIndex: 2,
    padding: 0,
    margin: 0,
    borderWidth: 0,
  },
  nativeDatePickerBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  datePickerBtnText: {
    fontSize: 15,
    color: theme.text,
  },
  promptBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(47, 67, 96, 0.04)',
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 8,
    padding: 12,
    marginBottom: 18,
  },
  promptBoxInside: {
    flex: 1,
    padding: 12,
  },
  promptText: {
    flex: 1,
    fontSize: 13,
    color: theme.textMuted,
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
    backgroundColor: theme.primary,
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
    borderColor: theme.borderColor,
    paddingVertical: 12,
    borderRadius: 8,
  },
  secondaryButtonText: {
    color: theme.text,
    fontWeight: 'bold',
    fontSize: 15,
  },
  inlineActionBtn: {
    paddingHorizontal: 12,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
  },
  statusText: {
    textAlign: 'center',
    color: theme.textMuted,
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
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
  },
  modalBody: {
    marginBottom: 20,
  },
  credRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
  },
  credLabel: {
    fontSize: 14,
    color: theme.textMuted,
    fontWeight: '500',
  },
  credValue: {
    fontSize: 14,
    color: theme.text,
    fontWeight: 'bold',
  },
  modalFooter: {
    flexDirection: 'column',
    gap: 10,
  },
  modalPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primary,
    paddingVertical: 12,
    borderRadius: 8,
  },
  modalPrimaryBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  modalSecondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  modalSecondaryBtnText: {
    color: theme.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  bulkTextArea: {
    width: '100%',
    height: 180,
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#f9f9f9',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 13,
    color: theme.text,
    textAlign: 'left',
    textAlignVertical: 'top',
    marginTop: 10,
  },
  credInstruction: {
    fontSize: 13,
    color: theme.textMuted,
    lineHeight: 18,
    marginBottom: 8,
  },
  contactImportBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(47, 67, 96, 0.15)',
  },
  contactHint: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 4,
    marginLeft: 4,
  },
  contactRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(47, 67, 96, 0.08)',
  },
  contactName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 4,
  },
  contactPhone: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#f0f4f9',
    borderRadius: 8,
    marginTop: 3,
  },
  contactPhoneText: {
    fontSize: 13,
    color: theme.text,
    fontWeight: '600',
  },
  contactPhoneLabel: {
    fontSize: 12,
    color: theme.textMuted,
  },
});