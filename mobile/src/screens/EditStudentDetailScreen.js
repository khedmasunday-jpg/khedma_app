import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  TouchableOpacity,
  Modal,
  FlatList
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import axios from "axios";
import { loadContactsForPicker } from '../utils/contactPicker';
import { logger } from '../utils/logger';
import { getApiBase } from '../config/api';
import { getAuthToken } from '../config/authSession';
import { formatDateDDMMYYYY } from '../utils/dateFormatter';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLanguage } from '../utils/LanguageContext';

import { useTheme } from '../utils/ThemeContext';
let DateTimePickerModal = null;
if (Platform.OS !== 'web') {
  try {
    DateTimePickerModal = require('react-native-modal-datetime-picker').default;
  } catch (e) {
    DateTimePickerModal = null;
  }
}

export default function EditStudentDetailScreen({ route, navigation }) {const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode);
  const { token: routeToken, studentId } = route.params || {};
  const token = routeToken || getAuthToken();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [classesList, setClassesList] = useState([]);
  const { t, locale } = useLanguage();
  const isRtl = locale === 'ar';
  const canDelete = userRole === "principal" || userRole === "admin";

  const showAlert = (title, message, onOk = null) => {
    Alert.alert(title, message, [{ text: "OK", onPress: onOk }]);
  };

  const [contactPickerVisible, setContactPickerVisible] = useState(false);
  const [contactsList, setContactsList] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactPickerField, setContactPickerField] = useState(null);

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

  useEffect(() => {
    
    (async () => {
      setLoading(true);
      try {
        const results = await Promise.allSettled([
          axios.get(`${getApiBase()}/classes`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${getApiBase()}/users/me`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        let classes = [];
        let meData = {};

        if (results[0].status === 'fulfilled') {
          classes = results[0].value?.data || [];
        } else {
          logger.warn('Could not fetch classes:', results[0].reason?.response?.status || results[0].reason);
        }

        if (results[1].status === 'fulfilled') {
          meData = results[1].value?.data || {};
        } else {
          logger.warn('Could not fetch current user:', results[1].reason?.response?.status || results[1].reason);
        }

        setClassesList(classes);
        if (meData) setUserRole(meData.role || "");
        logger.log('Fetched classes:', classes.map(c => c.name));

        try {
          const res = await axios.get(`${getApiBase()}/students/edit?id=${studentId}`, { headers: { Authorization: `Bearer ${token}` } });
          const s = res.data || {};
          
          if (s.classname && typeof s.classname !== 'string') {
            try {
              s.classname = s.classname.name || String(s.classname);
            } catch (e) {
              s.classname = String(s.classname);
            }
          }
          
          if (s.classLevel !== undefined && s.classLevel !== null) {
            try {
              const cl = Number(s.classLevel);
              if (!Number.isNaN(cl)) {
                if (cl >= 1 && cl <= 3) {
                  s.yearLevel = String(cl);
                } else {
                  if (s.yearLevel === undefined || s.yearLevel === null || s.yearLevel === '') {
                    s.yearLevel = String(Math.ceil(cl / 2));
                  } else {
                    s.yearLevel = String(s.yearLevel);
                  }
                }
              }
            } catch (e) {
              
            }
          } else if (s.yearLevel !== undefined && s.yearLevel !== null) {
            s.yearLevel = String(s.yearLevel);
          }

          const getClassesForYearLocal = (yearVal) => {
            const serverOpts = classes
              .filter(c => Number(c.year) === Number(yearVal))
              .map(c => c.name);
            if (serverOpts.length > 0) return serverOpts;
            const fallback = {
              "1": ["فصل السيرافيم", "فصل الشاروبيم"],
              "2": ["الملاك رفائيل", "الملاك ميخائيل"],
              "3": ["الملاك سوريال", "الملاك غبريال"],
            };
            return fallback[String(yearVal)] || [];
          };

          const optsForYear = getClassesForYearLocal(s.yearLevel);
          if (s.classname) {
            if (!optsForYear.includes(s.classname)) {
              const norm = (s.classname || '').toString().trim().toLowerCase();
              const match = optsForYear.find(name => name.toString().trim().toLowerCase() === norm);
              if (match) s.classname = match;
              else if (s.classLevel !== undefined && s.classLevel !== null) {
                const cl = Number(s.classLevel);
                if (!Number.isNaN(cl) && cl >= 1 && cl <= 3) {
                  const byYearOpts = getClassesForYearLocal(String(cl));
                  if (byYearOpts.length) s.classname = byYearOpts[0];
                } else {
                  if (optsForYear.length) s.classname = optsForYear[0];
                }
              }
            }
          } else if (optsForYear.length) {
            s.classname = optsForYear[0];
          }

          setStudent(s);
        } catch (err) {
          logger.error('Failed to fetch student:', err);
          showAlert('Error', 'Failed to fetch student data');
        }
      } catch (e) {
        logger.error('Failed to initialize edit screen data:', e);
        showAlert('Error', 'Failed to fetch classes or user info');
        setClassesList([]);
      }
      setLoading(false);
    })();
  }, []);

  const handleChange = (key, value) => setStudent({ ...student, [key]: value });

  const handleSave = async () => {
    setSaving(true);
    try {
      const allowedKeys = [
        "fullName",
        "yearLevel",
        "classname",
        "gender",
        "googlecode",
        "address",
        "mother_phonenumber",
        "father_phonenumber",
        "birthdate",
      ];
      const payload = {};
      for (const key of allowedKeys) {
        if (student[key] !== undefined) payload[key] = student[key];
      }

      if (payload.classname && typeof payload.classname !== 'string') {
        try { payload.classname = String(payload.classname); } catch (e) {}
      }

      logger.log('Prepared student payload for save:', payload);

      if (payload.yearLevel) {
        payload.classLevel = Number(payload.yearLevel);
        delete payload.yearLevel;
      }

      payload.id = student._id || studentId;

      const res = await axios.put(
        `${getApiBase()}/students/edit`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showAlert(t('success'), locale === 'ar' ? 'تم حفظ التعديل بنجاح.' : 'Student details updated successfully.', () =>
        navigation.goBack()
      );
    } catch (err) {
      logger.error("❌ Save error:", err.response?.data || err.message);
      showAlert(t('error'), locale === 'ar' ? 'فشل حفظ التعديل' : 'Failed to save student data.');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    logger.log("🧭 Delete button pressed");
    
    const performDelete = async () => {
      setDeleting(true);
      try {
        const id = student._id || studentId;
        const url = `${getApiBase()}/students/${id}`;
        logger.log("🛰️ Sending DELETE request to:", url);

        const res = await axios.delete(url, {
          headers: { Authorization: `Bearer ${token}` },
          data: {},
        });

        logger.log("✅ Delete response:", res.status, res.data);
        showAlert(t('success'), locale === 'ar' ? 'تم حذف الحساب بنجاح.' : 'Student record deleted successfully.', () =>
          navigation.goBack()
        );
      } catch (err) {
        logger.error("❌ Delete failed:", err.response?.data || err.message);
        showAlert(
          t('error'),
          err?.response?.data?.msg ||
            err?.response?.data?.error ||
            err.message ||
            t('deleteStaffFailure')
        );
      }
      setDeleting(false);
    };

    Alert.alert(
      locale === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete',
      locale === 'ar' ? 'هل أنت متأكد من رغبتك في حذف هذا المخدوم؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this student record? This action cannot be undone.',
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('deleteLabel'), style: 'destructive', onPress: performDelete }
      ]
    );
  };

  const getFieldLabel = (key) => {
    switch (key) {
      case 'fullName': return t('studentName');
      case 'yearLevel': return t('gradeLevel');
      case 'classname': return t('selectClass');
      case 'gender': return t('gender');
      case 'mother_phonenumber': return t('motherPhone');
      case 'father_phonenumber': return t('fatherPhone');
      case 'birthdate': return t('birthdate');
      default: return key;
    }
  };

  const getFieldIcon = (key) => {
    switch (key) {
      case 'fullName': return 'person-outline';
      case 'yearLevel': return 'school-outline';
      case 'classname': return 'people-outline';
      case 'gender': return 'male-female-outline';
      case 'mother_phonenumber': return 'call-outline';
      case 'father_phonenumber': return 'call-outline';
      case 'birthdate': return 'calendar-outline';
      default: return 'help-circle-outline';
    }
  };

  const getClassesForYear = (year) => {
    if (!year) return [];
    const serverFiltered = classesList
      .filter(c => Number(c.year) === Number(year))
      .map(c => c.name);
    if (serverFiltered.length > 0) return serverFiltered;
    const CLASS_OPTIONS_FALLBACK = {
      "1": ["فصل السيرافيم", "فصل الشاروبيم"],
      "2": ["الملاك رفائيل", "الملاك ميخائيل"],
      "3": ["الملاك سوريال", "الملاك غبريال"],
    };
    return CLASS_OPTIONS_FALLBACK[String(year)] || [];
  };

  if (loading || !student) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={theme.iconColor} />
    </View>
  );

  const editableFields = [
    "fullName",
    "yearLevel",
    "classname",
    "mother_phonenumber",
    "father_phonenumber",
    "birthdate",
  ];

  return (
    <View style={{ flex: 1 }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView 
        style={[styles.container, { backgroundColor: theme.background }, { backgroundColor: theme.background }]} 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: theme.text }, { color: theme.text }]}>{student.fullName}</Text>

        {}
        <View style={styles.summaryHeader}>
          <Text style={[styles.level, { textAlign: isRtl ? 'right' : 'left' }]}>
            {t('gradeLevel')}: {student.classLevel || student.yearLevel}
          </Text>
          <Text style={[styles.classnameText, { textAlign: isRtl ? 'right' : 'left' }]}>
            {t('selectClass')}: {student.classname || ''}
          </Text>
        </View>

        {}
        <View style={styles.formContainer}>
          {editableFields.map((key) => (
            <View key={key} style={styles.fieldRow}>
              <Text style={[styles.label, { textAlign: isRtl ? 'right' : 'left' }]}>
                {getFieldLabel(key)}
              </Text>

              {key === "yearLevel" ? (
                <View style={[styles.inputWrapper, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                  <Ionicons name={getFieldIcon(key)} size={20} color={theme.iconColor} style={styles.inputIcon} />
                  <View style={{ flex: 1 }}>
                    {Platform.OS === 'web' ? (
                      <View style={styles.webSelectWrapper}>
                        <select
                          value={student.yearLevel !== undefined ? String(student.yearLevel) : ""}
                          onChange={(e) => handleChange("yearLevel", e.target.value)}
                          style={StyleSheet.flatten([styles.webSelect, { direction: isRtl ? 'rtl' : 'ltr', paddingLeft: isRtl ? 35 : 14, paddingRight: isRtl ? 14 : 35 }])}
                        >
                          <option value="">{t('selectLevel')}</option>
                          <option value="1">{t('level1')}</option>
                          <option value="2">{t('level2')}</option>
                          <option value="3">{t('level3')}</option>
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
                        selectedValue={student.yearLevel !== undefined ? String(student.yearLevel) : ""}
                        onValueChange={(val) => handleChange("yearLevel", val)}
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
              ) : key === "classname" ? (
                <View style={[styles.inputWrapper, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                  <Ionicons name={getFieldIcon(key)} size={20} color={theme.iconColor} style={styles.inputIcon} />
                  <View style={{ flex: 1 }}>
                    {student.yearLevel ? (
                      Platform.OS === 'web' ? (
                        <View style={styles.webSelectWrapper}>
                          <select
                            value={student.classname || ""}
                            onChange={(e) => handleChange("classname", e.target.value)}
                            style={StyleSheet.flatten([styles.webSelect, { direction: isRtl ? 'rtl' : 'ltr', paddingLeft: isRtl ? 35 : 14, paddingRight: isRtl ? 14 : 35 }])}
                          >
                            <option value="">{t('selectClass')}</option>
                            {(() => {
                              const names = getClassesForYear(student.yearLevel);
                              const hasStudentName = names.includes(student.classname);
                              const options = names.map(n => <option key={n} value={n}>{n}</option>);
                              if (student.classname && !hasStudentName) {
                                options.unshift(<option key={'__student_name'} value={student.classname}>{student.classname}</option>);
                              }
                              return options;
                            })()}
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
                          selectedValue={student.classname || ""}
                          onValueChange={(val) => handleChange("classname", val)}
                          style={styles.nativePicker}
                          dropdownIconColor="#2f4360"
                        >
                          <Picker.Item label={t('selectClass')} value="" />
                          {(() => {
                            const names = getClassesForYear(student.yearLevel);
                            const items = names.map(n => <Picker.Item key={n} label={n} value={n} />);
                            const hasStudentName = items.some(it => String(it.props.value) === String(student.classname));
                            if (student.classname && !hasStudentName) {
                              items.unshift(<Picker.Item key={'__student_name'} label={student.classname} value={student.classname} />);
                            }
                            return items;
                          })()}
                        </Picker>
                      )
                    ) : (
                      <Text style={{ color: "#666", padding: 10 }}>
                        {t('chooseLevelFirstPrompt')}
                      </Text>
                    )}
                  </View>
                </View>
              ) : key === "birthdate" ? (
                <View style={{ marginBottom: 4 }}>
                  {Platform.OS === 'web' ? (
                    <View style={[styles.inputWrapper, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                      <Ionicons name={getFieldIcon(key)} size={20} color={theme.iconColor} style={styles.inputIcon} />
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
                          <Text style={{ color: theme.text, fontSize: 15 }}>
                            {student.birthdate ? formatDateDDMMYYYY(student.birthdate) : 'dd/mm/yyyy'}
                          </Text>
                        </View>
                        <input
                          type="date"
                          value={student.birthdate ? student.birthdate.split('T')[0] : ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v) {
                              const d = new Date(v);
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
                    </View>
                  ) : (
                    <View style={[styles.inputWrapper, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                      <Ionicons name={getFieldIcon(key)} size={20} color={theme.iconColor} style={styles.inputIcon} />
                      <TouchableOpacity 
                        style={[styles.btnPicker, { flex: 1, flexDirection: isRtl ? 'row-reverse' : 'row', borderWidth: 0 }]} 
                        onPress={() => setShowCalendar(true)}
                      >
                        <Text style={styles.btnPickerText}>
                          {student.birthdate ? formatDateDDMMYYYY(student.birthdate) : t('pickBirthdate')}
                        </Text>
                      </TouchableOpacity>
                      {DateTimePickerModal && (
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
                  )}
                </View>
              ) : (
                <View>
                  <View style={[styles.inputWrapper, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                    <TouchableOpacity
                      onPress={() => key.includes('phonenumber') ? pickContactPhone(key) : null}
                      style={styles.inputIcon}
                      activeOpacity={key.includes('phonenumber') ? 0.6 : 1}
                    >
                      <Ionicons name={getFieldIcon(key)} size={20} color={key.includes('phonenumber') ? '#2f4360' : '#2f4360'} />
                    </TouchableOpacity>
                    <TextInput
                      value={student[key] ? String(student[key]) : ""}
                      onChangeText={(val) => handleChange(key, val)}
                      style={[styles.input, { textAlign: isRtl ? 'right' : 'left' }]}
                      keyboardType={key.includes("phonenumber") ? "phone-pad" : "default"}
                      autoCapitalize="none"
                    />
                  </View>
                  {key.includes('phonenumber') && (
                    <Text style={{ fontSize: 11, color: theme.textMuted, marginTop: 3 }}>
                      {isRtl ? '📞 اضغط على أيقونة الهاتف لاستيراد من جهات الاتصال' : '📞 Tap the phone icon to pick from contacts'}
                    </Text>
                  )}
                </View>
              )}
            </View>
          ))}

          {}
          <View style={styles.buttonSection}>
            <TouchableOpacity 
              style={[styles.btn, styles.btnSave, saving && styles.btnDisabled]} 
              onPress={handleSave}
              disabled={saving || deleting}
            >
              <Ionicons name="checkmark-done" size={20} color="#ffffff" style={isRtl ? { marginLeft: 8 } : { marginRight: 8 }} />
              <Text style={styles.btnText}>{saving ? t('loading') : t('save')}</Text>
            </TouchableOpacity>

            {canDelete && (
              <TouchableOpacity 
                style={[styles.btn, styles.btnDelete, deleting && styles.btnDisabled]} 
                onPress={handleDelete}
                disabled={saving || deleting}
              >
                <Ionicons name="trash-outline" size={20} color="#ffffff" style={isRtl ? { marginLeft: 8 } : { marginRight: 8 }} />
                <Text style={styles.btnText}>{deleting ? t('loading') : t('deleteLabel')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>

    {}
    <Modal visible={contactPickerVisible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }, { backgroundColor: theme.cardBackground }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }, { color: theme.text }]}>{locale === 'ar' ? 'اختر تليفون جهة الاتصال' : 'Pick Contact Phone'}</Text>
            <TouchableOpacity onPress={() => setContactPickerVisible(false)}>
              <Ionicons name="close-circle-outline" size={24} color={theme.iconColor} />
            </TouchableOpacity>
          </View>
          {loadingContacts ? (
            <View style={{ padding: 30, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={theme.iconColor} />
            </View>
          ) : (
            <FlatList
              data={contactsList}
              keyExtractor={(item, i) => `${item.id || 'c'}_${i}`}
              renderItem={({ item }) => (
                <View style={styles.contactRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: 'bold', color: theme.text }}>{item.name || 'No name'}</Text>
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
                        <Text style={{ color: theme.text }}>
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
    </View>
  );
}

const getStyles = (theme, isDarkMode) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: 'transparent' 
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  title: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    marginBottom: 16, 
    textAlign: 'center',
    color: theme.text,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  summaryHeader: { 
    backgroundColor: theme.cardBackground, 
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.borderColor,
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#24364f',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0 2px 4px rgba(36, 54, 79, 0.03)',
      }
    }),
  },
  level: { 
    fontSize: 15, 
    fontWeight: '700',
    color: isDarkMode ? '#4ade80' : '#2e7d32', 
    marginBottom: 4,
  },
  classnameText: { 
    fontSize: 14, 
    color: theme.textMuted,
    fontWeight: '600',
  },
  formContainer: {
    backgroundColor: theme.cardBackground,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.borderColor,
    padding: 16,
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
    color: theme.text,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 10,
    backgroundColor: theme.cardBackground,
    width: '100%',
  },
  inputIcon: {
    paddingHorizontal: 12,
  },
  input: { 
    flex: 1,
    paddingVertical: 10, 
    paddingRight: 14, 
    paddingLeft: 14, 
    color: theme.text,
    fontSize: 15,
    borderWidth: 0,
    backgroundColor: 'transparent',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      }
    })
  },
  nativePicker: {
    width: '100%',
    color: theme.text,
    height: 45,
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
    color: theme.text,
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
    borderWidth: 0,
    backgroundColor: 'transparent',
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
  btnPicker: {
    backgroundColor: theme.cardBackground,
    borderWidth: 0,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPickerText: {
    color: theme.text,
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
    backgroundColor: theme.primary,
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: theme.cardBackground,
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
    color: theme.text,
  },
  contactRow: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: theme.borderColor,
  },
});