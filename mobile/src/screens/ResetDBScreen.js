import React, { useState, useEffect } from 'react';
import { View, Text, Alert, StyleSheet, Platform, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { createApiClient } from '../config/api';
import { getAuthToken } from '../config/authSession';
import { useLanguage } from '../utils/LanguageContext';
import { logger } from '../utils/logger';
import { formatDateDDMMYYYY } from '../utils/dateFormatter';

import { useTheme } from '../utils/ThemeContext';
let DateTimePickerModal = null;
if (Platform.OS !== 'web') {
  try { DateTimePickerModal = require('react-native-modal-datetime-picker').default; } catch (e) { DateTimePickerModal = null; }
}

export default function ResetDBScreen({ route, navigation }) {
  const { theme, isDarkMode } = useTheme();
  const { token: routeToken } = route.params || {};
  const token = routeToken || getAuthToken();
  const { locale } = useLanguage();
  const isAr = locale === 'ar';

  const [loading, setLoading] = useState(false);
  const [loadingMaster, setLoadingMaster] = useState(false);
  const client = createApiClient(token);

  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);

  const notify = (title, message) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const confirmAndResetCounters = () => {
    const title = isAr ? 'تأكيد تصفير الحضور' : 'Confirm Attendance Reset';
    const message = isAr
      ? 'سيعمل هذا على تصفير عداد الحضور لجميع المخدومين وإعادة ضبط التواريخ. هل تريد الاستمرار؟'
      : 'This will reset attendance counters for all students to zero. Continue?';

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`${title}\n\n${message}`)) {
        doResetCounters();
      }
    } else {
      Alert.alert(
        title,
        message,
        [
          { text: isAr ? 'إلغاء' : 'Cancel', style: 'cancel' },
          { text: isAr ? 'تصفير' : 'Reset', style: 'destructive', onPress: () => doResetCounters() }
        ],
        { cancelable: true }
      );
    }
  };

  const doResetCounters = async () => {
    try {
      setLoading(true);
      const res = await client.post('/students/reset-attendance');
      const count = res?.data?.modifiedCount;
      notify(
        isAr ? 'تم التصفير بنجاح 🚀' : 'Reset Complete 🚀',
        isAr
          ? `تم تصفير عداد الحضور لعدد ${count || 0} مخدوم.`
          : `Attendance counters reset for ${count || 0} students.`
      );
    } catch (err) {
      logger.error('Reset error', err);
      notify(
        isAr ? 'خطأ' : 'Error',
        err?.response?.data?.msg || err?.message || (isAr ? 'فشل التصفير' : 'Failed to reset')
      );
    } finally {
      setLoading(false);
    }
  };

  const confirmAndResetLogs = () => {
    const title = isAr ? 'تأكيد مسح سجلات النظام' : 'Confirm Logs Reset';
    const message = isAr
      ? 'سيعمل هذا على مسح كافة سجلات النظام والعمليات بشكل نهائي. هل تريد الاستمرار؟'
      : 'This will permanently delete all system logs. Continue?';

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`${title}\n\n${message}`)) doResetLogs();
    } else {
      Alert.alert(title, message, [
        { text: isAr ? 'إلغاء' : 'Cancel', style: 'cancel' },
        { text: isAr ? 'مسح' : 'Clear', style: 'destructive', onPress: () => doResetLogs() }
      ], { cancelable: true });
    }
  };

  const doResetLogs = async () => {
    try {
      setLoading(true);
      const res = await client.post('/users/logs/reset');
      notify(isAr ? 'تم بنجاح 🚀' : 'Success 🚀', res?.data?.msg || 'Logs reset completed.');
    } catch (err) {
      logger.error('Logs reset error', err);
      notify(isAr ? 'خطأ' : 'Error', err?.response?.data?.msg || err?.message || 'Failed to reset logs');
    } finally {
      setLoading(false);
    }
  };

  const confirmAndResetTayo = () => {
    const title = isAr ? 'تأكيد تصفير طايو' : 'Confirm Taio Reset';
    const message = isAr
      ? 'سيعمل هذا على تصفير كافة أرصدة طايو ومسح سجلات طايو لجميع المخدومين. هل تريد الاستمرار؟'
      : 'This will permanently reset all Taio balances to 0 and delete all Taio logs. Continue?';

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`${title}\n\n${message}`)) doResetTayo();
    } else {
      Alert.alert(title, message, [
        { text: isAr ? 'إلغاء' : 'Cancel', style: 'cancel' },
        { text: isAr ? 'تصفير' : 'Reset', style: 'destructive', onPress: () => doResetTayo() }
      ], { cancelable: true });
    }
  };

  const doResetTayo = async () => {
    try {
      setLoading(true);
      const res = await client.post('/tayo/reset');
      notify(isAr ? 'تم بنجاح 🚀' : 'Success 🚀', res?.data?.msg || 'Taio reset completed.');
    } catch (err) {
      logger.error('Taio reset error', err);
      notify(isAr ? 'خطأ' : 'Error', err?.response?.data?.msg || err?.message || 'Failed to reset Taio');
    } finally {
      setLoading(false);
    }
  };

  const confirmAndMasterReset = () => {
    const title = isAr ? '⚠️ تحذير: حذف وإعادة ضبط شاملة (Master Reset)' : '⚠️ Warning: Master Reset All Data';
    const message = isAr
      ? 'تحذير شديد الخطورة!\nسيعمل هذا الخيار على مسح كافة المخدومين وسجلات الحضور نهائياً لبدء تجربة أو موسم جديد من الصفر.\n\nهل أنت متأكد تماماً من تنفيذ مسح الشامل؟'
      : 'CRITICAL WARNING!\nThis will PERMANENTLY DELETE ALL STUDENTS AND ATTENDANCE RECORDS from the database to allow a fresh start.\n\nAre you absolutely sure you want to execute a Master Reset?';

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`${title}\n\n${message}`)) {
        doMasterReset();
      }
    } else {
      Alert.alert(
        title,
        message,
        [
          { text: isAr ? 'إلغاء' : 'Cancel', style: 'cancel' },
          { text: isAr ? 'نعم، امسح كل البيانات' : 'Yes, Wipe Everything', style: 'destructive', onPress: () => doMasterReset() }
        ],
        { cancelable: true }
      );
    }
  };

  const doMasterReset = async () => {
    try {
      setLoadingMaster(true);
      const res = await client.post('/students/reset-all');
      if (res.data && res.data.success) {
        notify(
          isAr ? 'تمت إعادة الضبط الشاملة بنجاح 🧹' : 'Master Reset Complete 🧹',
          isAr
            ? `تم مسح وقوائم البيانات بنجاح!\n• المخدومين: ${res.data.deletedStudents || 0}\n• حسابات الخدام: ${res.data.deletedUsers || 0}\n• الإشعارات: ${res.data.deletedNotifications || 0}\n• السجلات: ${res.data.deletedLogs || 0}\n\n(تم الاحتفاظ بحساب الأدمن)`
            : `Database successfully cleared!\n• Students: ${res.data.deletedStudents || 0}\n• Staff Accounts: ${res.data.deletedUsers || 0}\n• Notifications: ${res.data.deletedNotifications || 0}\n• Logs: ${res.data.deletedLogs || 0}\n\n(Admin account retained)`
        );
      } else {
        notify(isAr ? 'خطأ' : 'Error', res.data?.msg || 'Failed to execute master reset');
      }
    } catch (err) {
      logger.error('Master Reset error:', err);
      notify(
        isAr ? 'خطأ' : 'Error',
        err?.response?.data?.msg || err?.message || (isAr ? 'حدث خطأ أثناء الضبط الشامل' : 'Failed to execute master reset')
      );
    } finally {
      setLoadingMaster(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await client.get('/classes');
        if (Array.isArray(res.data)) setClasses(res.data);
      } catch (e) {}
    })();
  }, []);

  const resetForClassDate = async () => {
    if (!selectedClass) return notify(isAr ? 'خطأ' : 'Error', isAr ? 'من فضلك اختر الفصل' : 'Please select a class');
    if (!selectedDate) return notify(isAr ? 'خطأ' : 'Error', isAr ? 'من فضلك اختر التاريخ' : 'Please select a date');
    const dateKey = selectedDate.toISOString().split('T')[0];
    const confirmed = Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.confirm(isAr ? `مسح حضور الفصل في تاريخ ${dateKey}؟` : `Clear attendance for class and date ${dateKey}?`)
      : true;

    if (Platform.OS !== 'web') {
      Alert.alert(
        isAr ? 'تأكيد' : 'Confirm',
        isAr ? `مسح حضور الفصل في تاريخ ${dateKey}؟` : `Clear attendance for class and date ${dateKey}?`,
        [
          { text: isAr ? 'إلغاء' : 'Cancel', style: 'cancel' },
          { text: isAr ? 'مسح' : 'Clear', style: 'destructive', onPress: async () => {
            await doResetForClassDate(selectedClass, dateKey);
          }}
        ]
      );
      return;
    }
    if (confirmed) await doResetForClassDate(selectedClass, dateKey);
  };

  const doResetForClassDate = async (classId, dateKey) => {
    try {
      setLoading(true);
      const payload = { classId: String(classId), date: dateKey };
      const res = await client.post('/attendance/reset', payload);
      const data = res?.data || {};
      const text = data?.msg ? `${data.msg} (${isAr ? 'سجلات محذوفة:' : 'deleted:'} ${data.deletedCount || 0})` : 'Reset completed';
      notify(isAr ? 'تم' : 'Done', text);
    } catch (err) {
      logger.error('Reset for class/date error:', err);
      notify(isAr ? 'خطأ' : 'Error', err?.response?.data?.msg || err?.message || 'Failed to reset for class/date');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {}
      <View style={styles.headerCard}>
        <View style={styles.iconCircle}>
          <Ionicons name="refresh-circle-outline" size={40} color="#d9534f" />
        </View>
        <Text style={[styles.headerTitle, { color: theme.text }, { color: theme.text }]}>
          {isAr ? 'إعادة ضبط البيانات وتصفير الحضور' : 'Database Reset & Operations'}
        </Text>
        <Text style={styles.headerSubtitle}>
          {isAr
            ? 'أدوات لإعادة ضبط عداد الحضور، مسح حضور تاريخ معين، أو إعادة الضبط الشاملة للاختبار'
            : 'Tools to reset attendance counters, clear specific dates, or perform a full master reset'}
        </Text>
      </View>

      {}
      <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="stats-chart-outline" size={22} color={theme.iconColor} style={{ marginRight: 8 }} />
          <Text style={styles.cardTitle}>
            {isAr ? 'تصفير عداد الحضور فقط' : 'Reset Attendance Counters'}
          </Text>
        </View>
        <Text style={styles.cardDesc}>
          {isAr
            ? 'يعيد عداد الحضور وتواريخ الغياب والحضور لجميع المخدومين إلى 0 دون حذف بيانات المخدومين.'
            : 'Resets attendance counters and last attendance dates to 0 for all students without deleting student profiles.'}
        </Text>
        <TouchableOpacity
          style={[styles.warningBtn, loading && styles.disabledBtn]}
          onPress={confirmAndResetCounters}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.btnText}>
              {isAr ? 'تصفير عداد الحضور للجميع' : 'Reset Attendance Counters'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Reset Logs Card */}
      <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="document-text-outline" size={22} color={theme.iconColor} style={{ marginRight: 8 }} />
          <Text style={styles.cardTitle}>
            {isAr ? 'مسح سجلات النظام' : 'Reset Logs'}
          </Text>
        </View>
        <Text style={styles.cardDesc}>
          {isAr
            ? 'يمسح جميع سجلات العمليات والنظام بالكامل لتنظيف قاعدة البيانات.'
            : 'Deletes all system operation logs and history completely from the database.'}
        </Text>
        <TouchableOpacity
          style={[styles.warningBtn, loading && styles.disabledBtn]}
          onPress={confirmAndResetLogs}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.btnText}>
              {isAr ? 'مسح كافة السجلات' : 'Clear All Logs'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Reset Tayo Card */}
      <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="star-outline" size={22} color={theme.iconColor} style={{ marginRight: 8 }} />
          <Text style={styles.cardTitle}>
            {isAr ? 'تصفير طايو' : 'Reset Taio'}
          </Text>
        </View>
        <Text style={styles.cardDesc}>
          {isAr
            ? 'يقوم بتصفير جميع أرصدة طايو ومسح سجلات طايو لجميع المخدومين.'
            : 'Resets all Taio balances to 0 and clears Taio history logs for all students.'}
        </Text>
        <TouchableOpacity
          style={[styles.warningBtn, loading && styles.disabledBtn]}
          onPress={confirmAndResetTayo}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.btnText}>
              {isAr ? 'تصفير أرصدة طايو' : 'Reset Taio Balances'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {}
      <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }, styles.dangerCard]}>
        <View style={styles.cardHeader}>
          <Ionicons name="trash-bin-outline" size={22} color="#d9534f" style={{ marginRight: 8 }} />
          <Text style={[styles.cardTitle, { color: '#d9534f' }]}>
            {isAr ? 'إعادة الضبط الشاملة (Master Reset)' : 'Master Reset All Data'}
          </Text>
        </View>
        <Text style={styles.cardDesc}>
          {isAr
            ? 'يقوم بمسح وحذف كلي لكافة المخدومين وسجلات الحضور وقوائم الفصول للبدء واختبار استيراد ملفات الإكسل من جديد.'
            : 'Deletes all student profiles, attendance records, and class lists to provide a completely clean database for testing Excel imports.'}
        </Text>
        <TouchableOpacity
          style={[styles.dangerBtn, loadingMaster && styles.disabledBtn]}
          onPress={confirmAndMasterReset}
          disabled={loadingMaster}
        >
          {loadingMaster ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="flame-outline" size={20} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.btnText}>
                {isAr ? 'مسح وإعادة ضبط جميع البيانات' : 'Wipe & Reset All Data'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {}
      <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="calendar-outline" size={22} color={theme.iconColor} style={{ marginRight: 8 }} />
          <Text style={styles.cardTitle}>
            {isAr ? 'مسح حضور فصل في تاريخ معين' : 'Reset Class for Specific Date'}
          </Text>
        </View>

        <Text style={styles.inputLabel}>{isAr ? 'اختر الفصل:' : 'Select Class:'}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {classes.map(c => (
            <TouchableOpacity
              key={c._id}
              onPress={() => setSelectedClass(c._id)}
              style={[
                styles.classPill,
                selectedClass === c._id && styles.classPillSelected
              ]}
            >
              <Text style={[styles.classPillText, selectedClass === c._id && styles.classPillTextSelected]}>
                {c.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.inputLabel}>{isAr ? 'اختر التاريخ:' : 'Select Date:'}</Text>
        {Platform.OS === 'web' ? (
          <View style={styles.webDateWrap}>
            <Text style={{ color: '#333', fontSize: 14 }}>
              {selectedDate ? formatDateDDMMYYYY(selectedDate) : 'dd/mm/yyyy'}
            </Text>
            <input
              type="date"
              value={selectedDate instanceof Date ? selectedDate.toISOString().split('T')[0] : ''}
              onChange={(e) => {
                const d = new Date(e.target.value);
                if (!isNaN(d.getTime())) setSelectedDate(d);
              }}
              style={styles.hiddenWebDateInput}
            />
          </View>
        ) : (
          <>
            <TouchableOpacity onPress={() => setDatePickerVisible(true)} style={styles.nativeDateBtn}>
              <Text style={{ fontSize: 14, color: '#333' }}>{formatDateDDMMYYYY(selectedDate)}</Text>
            </TouchableOpacity>
            {DateTimePickerModal && (
              <DateTimePickerModal
                isVisible={isDatePickerVisible}
                mode="date"
                date={selectedDate || new Date()}
                onConfirm={(date) => { setSelectedDate(date); setDatePickerVisible(false); }}
                onCancel={() => setDatePickerVisible(false)}
              />
            )}
          </>
        )}

        <TouchableOpacity
          style={[styles.secondaryBtn, (!selectedClass || loading) && styles.disabledBtn]}
          onPress={resetForClassDate}
          disabled={!selectedClass || loading}
        >
          <Text style={styles.btnText}>
            {isAr ? 'مسح حضور التاريخ المحدد' : 'Clear Date Attendance'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: 'center',
  },
  headerCard: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(217, 83, 79, 0.2)',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fdf2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2f4360',
    textAlign: 'center',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.12)',
  },
  dangerCard: {
    borderColor: 'rgba(217, 83, 79, 0.3)',
    backgroundColor: '#fffdfd',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2f4360',
  },
  cardDesc: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
    marginBottom: 14,
  },
  warningBtn: {
    backgroundColor: '#e67e22',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtn: {
    backgroundColor: '#d9534f',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: {
    backgroundColor: '#2f4360',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  btnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444',
    marginBottom: 6,
  },
  classPill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#f0f4f8',
    borderRadius: 20,
    marginRight: 8,
  },
  classPillSelected: {
    backgroundColor: '#2f4360',
  },
  classPillText: {
    fontSize: 13,
    color: '#444',
  },
  classPillTextSelected: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  webDateWrap: {
    position: 'relative',
    height: 42,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    paddingLeft: 12,
    marginBottom: 10,
  },
  hiddenWebDateInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    cursor: 'pointer',
  },
  nativeDateBtn: {
    padding: 10,
    backgroundColor: '#f0f4f8',
    borderRadius: 8,
    marginBottom: 10,
  },
});
