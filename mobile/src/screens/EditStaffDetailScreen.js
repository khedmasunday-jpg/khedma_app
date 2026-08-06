import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, Switch, Modal, FlatList
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import arabicAlert from '../utils/arabicAlert';
import axios from 'axios';
import Constants from 'expo-constants';
import { logger } from '../utils/logger';
import { getApiBase } from '../config/api';
import { getAuthToken } from '../config/authSession';
import { formatDateDDMMYYYY } from '../utils/dateFormatter';
import { useLanguage } from '../utils/LanguageContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { loadContactsForPicker } from '../utils/contactPicker';

import { useTheme } from '../utils/ThemeContext';
let DateTimePickerModal = null;
if (Platform.OS !== 'web') {
  try {
    DateTimePickerModal = require('react-native-modal-datetime-picker').default;
  } catch (e) {
    DateTimePickerModal = null;
  }
}

const PICKER_YEAR = 2000;
const API_URL = `${getApiBase()}/users`;

export default function EditStaffDetailScreen({ route, navigation }) {
  const { theme, isDarkMode } = useTheme();
  const { token: routeToken, userId, role: requesterRole } = route.params || {};
  const token = routeToken || getAuthToken();
  const { t, locale } = useLanguage();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [stats, setStats] = useState({ principalCount: 0, coPrincipalCount: 0 });
  const [origRole, setOrigRole] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [origBirthdate, setOrigBirthdate] = useState(null);
  const [origUsername, setOrigUsername] = useState('');

  const [contactPickerVisible, setContactPickerVisible] = useState(false);
  const [contactsList, setContactsList] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  const showAlert = (title, message) => Alert.alert(title, message);

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

  const isRtl = locale === 'ar';

  const getSafeField = (fieldName) => {
    if (!user) return '';
    const encryptedFields = ['fullName', 'role', 'address', 'phonenumber', 'googleCode', 'assignedclass'];
    
    if (encryptedFields.includes(fieldName)) {
      if (user[fieldName] !== undefined && user[fieldName] !== null) {
        return user[fieldName];
      }
      if (user[`${fieldName}_enc`] !== undefined) {
        return user[`${fieldName}_enc`];
      }
      return '';
    }
    return user[fieldName] || '';
  };

  const formatDateNoYear = (dateStr) => {
    return formatDateDDMMYYYY(dateStr);
  };

  const normalizeToIso = (dateStr) => {
    if (!dateStr) return '';
    if (typeof dateStr === 'string' && dateStr.includes('T')) return dateStr;
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return new Date(dateStr + 'T00:00:00.000Z').toISOString();
      }
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('/').map(p => parseInt(p, 10));
        const day = parts[0];
        const month = parts[1];
        const year = parts[2];
        const d = new Date(Date.UTC(year, month - 1, day));
        return d.toISOString();
      }
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) return d.toISOString();
    } catch (e) {}
    return '';
  };

  const formatDateWithYear = (dateStr) => {
    return formatDateDDMMYYYY(dateStr);
  };

  const toPickerDateObj = (dateStr) => {
    try {
      const d = new Date(dateStr);
      d.setFullYear(PICKER_YEAR);
      return d;
    } catch (e) {
      const d = new Date();
      d.setFullYear(PICKER_YEAR);
      return d;
    }
  };

  const toStoredIsoWithPickerYear = (date) => {
    const d = new Date(date);
    d.setFullYear(PICKER_YEAR);
    return d.toISOString();
  };

  useEffect(() => {
    try { arabicAlert.installArabicAlert(); } catch (e) {}
    const fetchUser = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/${userId}`, { headers: { Authorization: `Bearer ${token}` } });
        
        logger.log('🔍 User data received:', {
          fullName: res.data.fullName,
          role: res.data.role,
          username: res.data.username,
          hasFullName_enc: !!res.data.fullName_enc,
          hasRole_enc: !!res.data.role_enc
        });
        
        const normalized = normalizeToIso(res.data.birthdate);
        setUser({ ...res.data, birthdate: normalized || '' });
        setOrigRole(res.data.role);
        setOrigBirthdate(normalized || null);
        setOrigUsername(res.data.username || '');
      } catch (err) {
        logger.error('❌ Error fetching user:', err);
        Alert.alert('Error', 'Failed to fetch user data');
      }
      setLoading(false);
    };
    fetchUser();
    (async () => {
      try {
        const s = await axios.get(`${getApiBase()}/users/staff-stats`, { headers: { Authorization: `Bearer ${token}` } });
        setStats(s.data || {});
      } catch (e) {}
    })();
  }, []);

  const handleChange = (key, value) => setUser({ ...user, [key]: value });

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = {
        fullName: getSafeField('fullName'),
        address: getSafeField('address'),
        phonenumber: getSafeField('phonenumber'),
        birthdate: getSafeField('birthdate'),
        googleCode: getSafeField('googleCode'),
        assignedclass: getSafeField('assignedclass'),
        assignedlevel: getSafeField('assignedlevel'),
        isClassLeader: !!getSafeField('isClassLeader'),
      };

      await axios.patch(`${API_URL}/${userId}`, updates, { headers: { Authorization: `Bearer ${token}` } });

      if (requesterRole === 'admin'|| requesterRole === 'principal') {
        const credPayload = {};
        const currentUsername = getSafeField('username');
        if (currentUsername && currentUsername !== origUsername) {
          credPayload.username = currentUsername;
        }
        if (newPassword && newPassword.trim()) {
          credPayload.password = newPassword;
        }
        if (Object.keys(credPayload).length > 0) {
          await axios.patch(`${API_URL}/${userId}/credentials`, credPayload, { headers: { Authorization: `Bearer ${token}` } });
          try { setOrigUsername(currentUsername); } catch (e) {}
        }
        if (getSafeField('role') && origRole && getSafeField('role') !== origRole) {
          await axios.patch(`${API_URL}/${userId}/role`, { role: getSafeField('role') }, { headers: { Authorization: `Bearer ${token}` } });
        }
      }

      try { setOrigBirthdate(getSafeField('birthdate') || null); } catch (e) {}
      Alert.alert(t('success'), t('editStaffSuccess'), [{ text: t('ok'), onPress: () => navigation.goBack() }]);
    } catch (err) {
      const msg = err.response?.data?.msg || t('editStaffFailure');
      Alert.alert(t('error'), msg);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    logger.log('🧭 Delete button pressed');
    setDeleting(true);
    try {
      const id = user._id || userId;
      const url = `${API_URL}/${id}`;
      logger.log('🛰️ Sending DELETE request to:', url);
      const res = await axios.delete(url, { headers: { Authorization: `Bearer ${token}` } });
      logger.log('✅ Delete response:', res.status, res.data);

      if (Platform.OS !== 'web') {
        Alert.alert(t('success'), t('deleteStaffSuccess'), [
          { text: t('ok'), onPress: () => navigation.goBack() }
        ]);
      } else {
        window.alert(t('deleteStaffSuccess'));
        navigation.goBack();
      }
    } catch (err) {
      logger.error('❌ Delete failed:', err?.response?.data || err.message);
      if (Platform.OS !== 'web') {
        Alert.alert(t('error'), err?.response?.data?.msg || t('deleteStaffFailure'));
      } else {
        window.alert(t('deleteStaffFailure'));
      }
    }
    setDeleting(false);
  };

  if (loading || !user) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={theme.iconColor} />
    </View>
  );

  const canDelete = (requesterRole === 'admin' || requesterRole === 'principal') && user;
  const editableFields = ['fullName', 'username', 'telegramChatId', 'birthdate'];
  
  const classTranslations = {
    'فصل السيرافيم': 'classSeraphim',
    'فصل الشاروبيم': 'classCherubim',
    'الملاك رفائيل': 'classRaphael',
    'الملاك ميخائيل': 'classMichael',
    'الملاك سوريال': 'classSuriel',
    'الملاك غبريال': 'classGabriel',
  };

  const CLASS_OPTIONS = {
    '1': ['فصل السيرافيم', 'فصل الشاروبيم'],
    '2': ['الملاك رفائيل', 'الملاك ميخائيل'],
    '3': ['الملاك سوريال', 'الملاك غبريال'],
  };

  const getFieldLabel = (key) => {
    switch (key) {
      case 'fullName': return t('fullNameLabel');
      case 'username': return t('usernameLabel');
      case 'phonenumber': return t('phoneLabel');
      case 'telegramChatId': return t('telegramChatIdLabel');
      case 'birthdate': return t('birthdate');
      case 'role': return t('roleLabel');
      case 'assignedlevel': return t('gradeLevel');
      case 'assignedclass': return t('selectClass');
      case 'password': return t('passwordLabel');
      default: return key;
    }
  };

  return (
    <>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={[styles.container, { backgroundColor: theme.background }, { backgroundColor: theme.background }]} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {}
        <Text style={[styles.title, { color: theme.text }, { color: theme.text }]}>{getSafeField('fullName') || 'Unknown Name'}</Text>
        
        {}
        <View style={styles.formContainer}>
          {editableFields.map(key => (
            <View key={key} style={styles.fieldRow}>
              <Text style={[styles.label, { textAlign: isRtl ? 'right' : 'left' }]}>
                {getFieldLabel(key)}
              </Text>
              
              {key === 'birthdate' ? (
                <View style={{ marginBottom: 4 }}>
                  {Platform.OS === 'web' ? (
                    <>
                      <View style={styles.webDateWrapper}>
                        <View 
                          pointerEvents="none" 
                          style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            flexDirection: isRtl ? 'row-reverse' : 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingHorizontal: 14,
                            zIndex: 1
                          }}
                        >
                          <Text style={{ color: '#2f4360', fontSize: 15 }}>
                            {getSafeField('birthdate') ? formatDateDDMMYYYY(getSafeField('birthdate')) : 'dd/mm/yyyy'}
                          </Text>
                          <Ionicons 
                            name="calendar-outline" 
                            size={18} 
                            color={theme.iconColor} 
                          />
                        </View>
                        <input
                          type="date"
                          value={getSafeField('birthdate') ? getSafeField('birthdate').split('T')[0] : ''}
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
                          style={styles.webDateInput}
                        />
                      </View>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity 
                        style={[styles.btnPicker, { flexDirection: isRtl ? 'row-reverse' : 'row' }]} 
                        onPress={() => setShowCalendar(true)}
                      >
                        <Ionicons name="calendar-outline" size={18} color={theme.iconColor} style={{ marginHorizontal: 6 }} />
                        <Text style={styles.btnPickerText}>
                          {getSafeField('birthdate') ? `${t('birthdate')}: ${formatDateNoYear(getSafeField('birthdate'))}` : t('pickBirthdate')}
                        </Text>
                      </TouchableOpacity>
                      {DateTimePickerModal && (
                        <DateTimePickerModal
                          isVisible={showCalendar}
                          mode="date"
                          date={toPickerDateObj(getSafeField('birthdate'))}
                          onConfirm={(date) => {
                            setShowCalendar(false);
                            handleChange('birthdate', toStoredIsoWithPickerYear(date));
                          }}
                          onCancel={() => setShowCalendar(false)}
                        />
                      )}
                    </>
                  )}
                </View>
              ) : (
                key === 'phonenumber' ? (
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#cccccc', borderRadius: 10, backgroundColor: '#ffffff', overflow: 'hidden' }}>
                      <TouchableOpacity
                        onPress={pickContactForStaff}
                        style={{ paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: 'rgba(47,67,96,0.15)' }}
                        activeOpacity={0.6}
                      >
                        <Ionicons name="call-outline" size={20} color={theme.iconColor} />
                      </TouchableOpacity>
                      <TextInput
                        value={getSafeField(key) ? String(getSafeField(key)) : ''}
                        onChangeText={val => handleChange(key, val)}
                        style={[styles.input, { flex: 1, borderWidth: 0, textAlign: isRtl ? 'right' : 'left' }]}
                        keyboardType="phone-pad"
                      />
                    </View>
                    <Text style={{ fontSize: 11, color: '#888', marginTop: 3 }}>
                      {isRtl ? '📞 اضغط على أيقونة الهاتف لاستيراد رقم' : '📞 Tap the phone icon to pick from contacts'}
                    </Text>
                  </View>
                ) : key === 'telegramChatId' ? (
                  <View>
                    <TextInput
                      value={getSafeField(key) ? String(getSafeField(key)) : ''}
                      onChangeText={val => handleChange(key, val)}
                      placeholder={t('telegramChatIdPlaceholder')}
                      keyboardType="numeric"
                      style={[styles.input, { textAlign: isRtl ? 'right' : 'left' }]}
                    />
                    <Text style={{ fontSize: 11, color: '#888', marginTop: 3 }}>
                      💡 {t('telegramChatIdHint')}
                    </Text>
                  </View>
                ) : (
                <TextInput
                  value={getSafeField(key) ? String(getSafeField(key)) : ''}
                  onChangeText={val => handleChange(key, val)}
                  style={[styles.input, { textAlign: isRtl ? 'right' : 'left' }]}
                />
                )
              )}
            </View>
          ))}

          {}
          {requesterRole === 'admin' && (
            <View style={styles.fieldRow}>
              <Text style={[styles.label, { textAlign: isRtl ? 'right' : 'left' }]}>
                {getFieldLabel('role')}
              </Text>
              <View style={styles.pickerContainer}>
                {Platform.OS === 'web' ? (
                  <View style={styles.webSelectWrapper}>
                    <select 
                      value={getSafeField('role') || ''} 
                      onChange={(e) => handleChange('role', e.target.value)} 
                      style={{
                        ...styles.webSelect,
                        textAlign: isRtl ? 'right' : 'left',
                        direction: isRtl ? 'rtl' : 'ltr',
                        paddingLeft: isRtl ? 35 : 14,
                        paddingRight: isRtl ? 14 : 35,
                      }}
                    >
                      <option value="">-- اختر المنصب --</option>
                      {stats.principalCount === 0 && <option value="principal">امينه الخدمه</option>}
                      {stats.coPrincipalCount < 3 && <option value="co-principal">أمين مرحلة</option>}
                      <option value="teacher">خادم</option>
                    </select>
                    <Ionicons 
                      name="chevron-down-outline" 
                      size={18} 
                      color={theme.iconColor} 
                      style={isRtl ? { position: 'absolute', left: 14, pointerEvents: 'none' } : { position: 'absolute', right: 14, pointerEvents: 'none' }} 
                    />
                  </View>
                ) : (
                  <Picker 
                    selectedValue={getSafeField('role') || ''} 
                    onValueChange={val => handleChange('role', val)}
                    style={styles.nativePicker}
                  >
                    <Picker.Item label="-- اختر المنصب --" value="" />
                    {stats.principalCount === 0 && <Picker.Item label="امينه الخدمه" value="principal" />}
                    {stats.coPrincipalCount < 3 && <Picker.Item label="أمين مرحلة" value="co-principal" />}
                    <Picker.Item label="خادم" value="teacher" />
                  </Picker>
                )}
              </View>
            </View>
          )}

          {}
          {(getSafeField('role') === 'teacher' || getSafeField('role') === 'co-principal') && (
            <View style={styles.fieldRow}>
              <Text style={[styles.label, { textAlign: isRtl ? 'right' : 'left' }]}>
                {getFieldLabel('assignedlevel')}
              </Text>
              <View style={styles.pickerContainer}>
                {(() => {
                  const currentRole = getSafeField('role');
                  const currentLevel = getSafeField('assignedlevel');
                  const levelOptions = [
                    { label: isRtl ? 'سنه اولي' : 'Year 1', value: 1 },
                    { label: isRtl ? 'سنه تانيه' : 'Year 2', value: 2 },
                    { label: isRtl ? 'سنه تالته' : 'Year 3', value: 3 }
                  ].filter(opt => {
                    if (currentRole === 'co-principal') {
                      const assignedLevels = stats.assignedCoPrincipalLevels || [];
                      if (opt.value === Number(currentLevel)) return true;
                      return !assignedLevels.includes(opt.value);
                    }
                    return true;
                  });

                  return Platform.OS === 'web' ? (
                    <View style={styles.webSelectWrapper}>
                      <select 
                        value={getSafeField('assignedlevel') !== undefined ? String(getSafeField('assignedlevel')) : ''} 
                        onChange={(e) => handleChange('assignedlevel', e.target.value)} 
                        style={{
                          ...styles.webSelect,
                          textAlign: isRtl ? 'right' : 'left',
                          direction: isRtl ? 'rtl' : 'ltr',
                          paddingLeft: isRtl ? 35 : 14,
                          paddingRight: isRtl ? 14 : 35,
                        }}
                      >
                        <option value="">{isRtl ? '-- اختر المرحلة --' : '-- select level --'}</option>
                        {levelOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <Ionicons 
                        name="chevron-down-outline" 
                        size={18} 
                        color={theme.iconColor} 
                        style={isRtl ? { position: 'absolute', left: 14, pointerEvents: 'none' } : { position: 'absolute', right: 14, pointerEvents: 'none' }} 
                      />
                    </View>
                  ) : (
                    <Picker 
                      selectedValue={getSafeField('assignedlevel') !== undefined ? String(getSafeField('assignedlevel')) : ''} 
                      onValueChange={val => handleChange('assignedlevel', String(val))}
                      style={styles.nativePicker}
                    >
                      <Picker.Item label={isRtl ? '-- اختر المرحلة --' : '-- select level --'} value="" />
                      {levelOptions.map(opt => (
                        <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
                      ))}
                    </Picker>
                  );
                })()}
              </View>
            </View>
          )}

          {}
          {getSafeField('role') === 'teacher' && (
            <View style={styles.fieldRow}>
              <Text style={[styles.label, { textAlign: isRtl ? 'right' : 'left' }]}>
                {getFieldLabel('assignedclass')}
              </Text>
              <View style={styles.pickerContainer}>
                {Platform.OS === 'web' ? (
                  <View style={styles.webSelectWrapper}>
                    <select 
                      value={getSafeField('assignedclass') || ''} 
                      onChange={(e) => handleChange('assignedclass', e.target.value)} 
                      style={{
                        ...styles.webSelect,
                        textAlign: isRtl ? 'right' : 'left',
                        direction: isRtl ? 'rtl' : 'ltr',
                        paddingLeft: isRtl ? 35 : 14,
                        paddingRight: isRtl ? 14 : 35,
                      }}
                    >
                      <option value="">-- select class --</option>
                      {(CLASS_OPTIONS[String(getSafeField('assignedlevel'))] || []).map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <Ionicons 
                      name="chevron-down-outline" 
                      size={18} 
                      color={theme.iconColor} 
                      style={isRtl ? { position: 'absolute', left: 14, pointerEvents: 'none' } : { position: 'absolute', right: 14, pointerEvents: 'none' }} 
                    />
                  </View>
                ) : (
                  <Picker 
                    selectedValue={getSafeField('assignedclass') || ''} 
                    onValueChange={val => handleChange('assignedclass', val)}
                    style={styles.nativePicker}
                  >
                    <Picker.Item label="-- select class --" value="" />
                    {(CLASS_OPTIONS[String(getSafeField('assignedlevel'))] || []).map(opt => (
                      <Picker.Item key={opt} label={opt} value={opt} />
                    ))}
                  </Picker>
                )}
              </View>
            </View>
          )}

          {}
          {getSafeField('role') === 'teacher' && (
            <View style={[styles.fieldRow, { flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 }]}>
              <Text style={[styles.label, { textAlign: isRtl ? 'right' : 'left', marginBottom: 0 }]}>
                {isRtl ? 'أمين الفصل' : 'Class Leader'}
              </Text>
              <Switch
                value={!!getSafeField('isClassLeader')}
                onValueChange={(val) => handleChange('isClassLeader', val)}
                trackColor={{ false: '#d1d1d1', true: '#2f4360' }}
                thumbColor={!!getSafeField('isClassLeader') ? '#ffffff' : '#f4f3f4'}
              />
            </View>
          )}

          {}
          <View style={styles.fieldRow}>
            <Text style={[styles.label, { textAlign: isRtl ? 'right' : 'left' }]}>
              {getFieldLabel('password')}
            </Text>
            <TextInput
              value={newPassword}
              onChangeText={val => setNewPassword(val)}
              style={[styles.input, { textAlign: isRtl ? 'right' : 'left' }]}
              secureTextEntry
              placeholder={isRtl ? "أدخل كلمة مرور جديدة لإعادة الضبط (اتركها فارغة للحفظ)" : "Enter new password to reset (leave empty to keep)"}
              placeholderTextColor="rgba(47, 67, 96, 0.4)"
              autoCapitalize="none"
            />
          </View>

          {}
          <View style={styles.buttonSection}>
            <TouchableOpacity 
              style={[styles.btn, styles.btnSave, saving && styles.btnDisabled]} 
              onPress={handleSave} 
              disabled={saving}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{ marginHorizontal: 6 }} />
              <Text style={styles.btnText}>
                {saving ? (isRtl ? 'جاري الحفظ...' : 'Saving...') : (isRtl ? 'حفظ' : 'Save')}
              </Text>
            </TouchableOpacity>

            {canDelete && (
              <TouchableOpacity 
                style={[styles.btn, styles.btnDelete, deleting && styles.btnDisabled]} 
                onPress={() => {
                  if (Platform.OS === 'web') {
                    const confirmDelete = window.confirm(t('deleteStaffConfirm'));
                    if (confirmDelete) handleDelete();
                  } else {
                    Alert.alert(
                      t('confirmDeleteTitle'),
                      t('deleteStaffConfirm'),
                      [
                        { text: t('cancel'), style: 'cancel' },
                        { text: t('deleteLabel'), style: 'destructive', onPress: handleDelete },
                      ]
                    );
                  }
                }}
                disabled={deleting}
              >
                <Ionicons name="trash-outline" size={20} color="#fff" style={{ marginHorizontal: 6 }} />
                <Text style={styles.btnText}>
                  {deleting ? (isRtl ? 'جاري الحذف...' : 'Deleting...') : (isRtl ? 'حذف الخادم' : 'Delete Staff')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>

      {}
      <Modal visible={contactPickerVisible} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(47,67,96,0.1)' }}>
              <Ionicons name="people-outline" size={22} color={theme.iconColor} />
              <Text style={{ flex: 1, marginLeft: 10, fontWeight: 'bold', fontSize: 16, color: '#2f4360' }}>
                {isRtl ? 'اختر جهة اتصال' : 'Pick a Contact'}
              </Text>
              <TouchableOpacity onPress={() => setContactPickerVisible(false)}>
                <Ionicons name="close-circle-outline" size={26} color={theme.iconColor} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={contactsList}
              keyExtractor={(_, i) => String(i)}
              renderItem={({ item: contact }) => (
                <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(47,67,96,0.07)' }}>
                  <Text style={{ fontWeight: 'bold', color: '#2f4360', marginBottom: 4 }}>{contact.name}</Text>
                  {contact.phones.map((p, pi) => (
                    <TouchableOpacity
                      key={pi}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#f0f4f9', borderRadius: 8, marginTop: 3 }}
                      onPress={() => {
                        handleChange('phonenumber', p.number);
                        setContactPickerVisible(false);
                      }}
                    >
                      <Ionicons name="call-outline" size={14} color={theme.iconColor} style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 13, color: '#2f4360', fontWeight: '600' }}>{p.number}</Text>
                      <Text style={{ fontSize: 12, color: '#888' }}> ({p.label})</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: 'transparent' 
  },
  scrollContent: { 
    padding: 16, 
    paddingBottom: 60, 
    alignItems: 'stretch' 
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  title: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    marginBottom: 20, 
    textAlign: 'center',
    color: '#2f4360',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  formContainer: { 
    width: '100%', 
    maxWidth: 600, 
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 252, 246, 0.95)', 
    borderRadius: 18, 
    padding: 20, 
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.12)',
    ...Platform.select({
      ios: {
        shadowColor: '#24364f',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 4px 6px rgba(36, 54, 79, 0.05)',
      }
    }),
  },
  fieldRow: { 
    marginBottom: 16 
  },
  label: { 
    fontWeight: '700', 
    fontSize: 14,
    color: '#2f4360',
    marginBottom: 6,
  },
  input: { 
    borderWidth: 1, 
    borderColor: 'rgba(47, 67, 96, 0.15)',
    borderRadius: 10, 
    paddingHorizontal: 14, 
    paddingVertical: 10, 
    backgroundColor: '#fff', 
    color: '#2f4360',
    fontSize: 15,
    width: '100%',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      }
    })
  },
  pickerContainer: {
    borderWidth: 1, 
    borderColor: 'rgba(47, 67, 96, 0.15)',
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  nativePicker: {
    width: '100%',
    color: '#2f4360',
  },
  webSelectWrapper: {
    position: 'relative',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webSelect: {
    width: '100%',
    height: 45,
    paddingVertical: 10,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: '#2f4360',
    fontSize: 15,
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    outlineStyle: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  webDateWrapper: {
    position: 'relative',
    width: '100%',
    height: 45,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    borderColor: 'rgba(47, 67, 96, 0.15)',
    backgroundColor: '#fff',
    overflow: 'hidden',
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
  dateMeta: {
    fontSize: 12,
    color: 'rgba(47, 67, 96, 0.6)',
    marginTop: 4,
  },
  btnPicker: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.15)',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPickerText: {
    color: '#2f4360',
    fontWeight: '600',
    fontSize: 14,
  },
  buttonSection: {
    marginTop: 24,
    gap: 12,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#24364f',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 4px rgba(36, 54, 79, 0.08)',
        transition: 'background-color 0.2s ease',
      }
    }),
  },
  btnSave: {
    backgroundColor: '#2f4360',
  },
  btnDelete: {
    backgroundColor: '#dc3545',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});