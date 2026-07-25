import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { createApiClient } from '../config/api';
import { getAuthToken } from '../config/authSession';
import { useLanguage } from '../utils/LanguageContext';
import { logger } from '../utils/logger';

export default function BackupScreen({ route, navigation }) {
  const { token: routeToken } = route.params || {};
  const token = routeToken || getAuthToken();
  const { locale } = useLanguage();
  const client = createApiClient(token);

  const [loadingStatus, setLoadingStatus] = useState(true);
  const [runningBackup, setRunningBackup] = useState(false);
  const [backupStatus, setBackupStatus] = useState(null);

  const isAr = locale === 'ar';

  const fetchStatus = async () => {
    try {
      setLoadingStatus(true);
      const res = await client.get('/backup/status');
      if (res.data && res.data.success) {
        setBackupStatus(res.data);
      }
    } catch (err) {
      logger.error('Error fetching backup status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const notify = (title, msg) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  };

  const confirmAndRunBackup = () => {
    const title = isAr ? 'تأكيد النسخ الاحتياطي' : 'Confirm Backup';
    const message = isAr
      ? 'هل أنت تأكد من تطبيق النسخ الاحتياطي لقاعدة البيانات الآن؟'
      : 'Are you sure you want to run a database backup now?';

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`${title}\n\n${message}`)) {
        doRunBackup();
      }
    } else {
      Alert.alert(
        title,
        message,
        [
          { text: isAr ? 'إلغاء' : 'Cancel', style: 'cancel' },
          { text: isAr ? 'بدء النسخ' : 'Start', onPress: () => doRunBackup() }
        ],
        { cancelable: true }
      );
    }
  };

  const doRunBackup = async () => {
    setRunningBackup(true);
    try {
      const res = await client.post('/backup/run', {});
      if (res.data && res.data.success) {
        const backupInfo = res.data.backup || {};
        const sizeMb = backupInfo.sizeBytes ? (backupInfo.sizeBytes / 1024 / 1024).toFixed(2) + ' MB' : '';
        const docCount = backupInfo.documentCount ? `${backupInfo.documentCount} ${isAr ? 'مستند' : 'documents'}` : '';

        notify(
          isAr ? 'تم بنجاح! 🚀' : 'Success! 🚀',
          isAr
            ? `تم إجراء النسخ الاحتياطي وحفظه بنجاح!\n\nاسم الملف:\n${backupInfo.fileName || ''}\n\nالحجم: ${sizeMb}\nعدد المستندات: ${docCount}`
            : `Database backup completed successfully!\n\nFile Name:\n${backupInfo.fileName || ''}\n\nSize: ${sizeMb}\nTotal Docs: ${docCount}`
        );
        fetchStatus();
      } else {
        notify(
          isAr ? 'خطأ' : 'Error',
          res.data?.msg || (isAr ? 'فشل إجراء النسخ الاحتياطي' : 'Backup execution failed')
        );
      }
    } catch (err) {
      logger.error('Error running manual backup:', err);
      const errMsg = err.response?.data?.msg || err.message || (isAr ? 'حدث خطأ أثناء إجراء النسخ الاحتياطي' : 'An error occurred during backup');
      notify(isAr ? 'خطأ' : 'Error', errMsg);
    } finally {
      setRunningBackup(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Banner */}
      <View style={styles.headerCard}>
        <View style={styles.iconCircle}>
          <Ionicons name="cloud-upload-outline" size={36} color="#2f4360" />
        </View>
        <Text style={styles.headerTitle}>
          {isAr ? 'نظام النسخ الاحتياطي لقاعدة البيانات' : 'Database Backup System'}
        </Text>
        <Text style={styles.headerSubtitle}>
          {isAr
            ? 'تصدير بيانات التطبيق ورفعها تلقائياً وآمناً على Google Drive وحفظها محلياً'
            : 'Export and securely store application database backups locally & on Google Drive'}
        </Text>
      </View>

      {/* Schedule Info Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="time-outline" size={22} color="#2f4360" style={{ marginRight: 8 }} />
          <Text style={styles.cardTitle}>
            {isAr ? 'جدولة النسخ الدوري التلقائي' : 'Automated Monthly Schedule'}
          </Text>
        </View>

        <Text style={styles.scheduleText}>
          🗓️ {isAr ? 'التكرار: أول كل شهر الساعة 3:00 صباحاً (0 3 1 * *)' : 'Frequency: 1st day of every month at 3:00 AM'}
        </Text>
        <Text style={styles.scheduleSubtext}>
          {isAr
            ? 'تُنفذ المهمة تلقائياً في الخلفية لاستخراج كافة البيانات وضغطها وحفظها مع الاحتفاظ بأحدث 10 نسخ.'
            : 'The background cron job runs automatically, exports all collections, compresses the archive, and retains the latest 10 backups.'}
        </Text>
      </View>

      {/* Last Backup Info Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="shield-checkmark-outline" size={22} color="#27ae60" style={{ marginRight: 8 }} />
          <Text style={styles.cardTitle}>
            {isAr ? 'حالة آخر نسخة احتياطية' : 'Last Backup Details'}
          </Text>
        </View>

        {loadingStatus ? (
          <ActivityIndicator size="small" color="#2f4360" style={{ marginVertical: 12 }} />
        ) : backupStatus?.lastBackup ? (
          <View style={styles.statusDetails}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>{isAr ? 'التاريخ والوقت:' : 'Timestamp:'}</Text>
              <Text style={styles.statusValue}>
                {backupStatus.lastBackup.timestamp
                  ? new Date(backupStatus.lastBackup.timestamp).toLocaleString(isAr ? 'ar-EG' : 'en-US')
                  : backupStatus.lastBackup.lastRunDate || (isAr ? 'غير مسجل' : 'N/A')}
              </Text>
            </View>

            {backupStatus.lastBackup.fileName && (
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>{isAr ? 'اسم الملف:' : 'File Name:'}</Text>
                <Text style={styles.statusValue}>{backupStatus.lastBackup.fileName}</Text>
              </View>
            )}

            {backupStatus.lastBackup.sizeBytes && (
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>{isAr ? 'حجم الأرشيف:' : 'Archive Size:'}</Text>
                <Text style={styles.statusValue}>
                  {(backupStatus.lastBackup.sizeBytes / 1024 / 1024).toFixed(2)} MB
                </Text>
              </View>
            )}

            {backupStatus.lastBackup.documentCount !== undefined && (
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>{isAr ? 'السجلات المحفوظة:' : 'Total Documents:'}</Text>
                <Text style={styles.statusValue}>
                  {backupStatus.lastBackup.documentCount} {isAr ? 'مستند' : 'docs'} ({backupStatus.lastBackup.collectionCount} {isAr ? 'مجموعة' : 'cols'})
                </Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.noStatusText}>
            {isAr ? 'جاهز لإجراء النسخ الاحتياطي' : 'Ready to create backup'}
          </Text>
        )}
      </View>

      {/* Manual Trigger Action Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="flash-outline" size={22} color="#e67e22" style={{ marginRight: 8 }} />
          <Text style={styles.cardTitle}>
            {isAr ? 'تشغيل نسخ احتياطي فوري' : 'Manual Immediate Backup'}
          </Text>
        </View>

        <Text style={styles.actionDescription}>
          {isAr
            ? 'اضغط على الزر أدناه لتطبيق نسخة احتياطية كاملة وشاملة لكافة بيانات التطبيق في الحال.'
            : 'Click the button below to create an immediate full backup of all application database collections.'}
        </Text>

        <TouchableOpacity
          style={[styles.primaryButton, runningBackup && styles.disabledButton]}
          onPress={confirmAndRunBackup}
          disabled={runningBackup}
        >
          {runningBackup ? (
            <View style={styles.btnRow}>
              <ActivityIndicator color="#ffffff" size="small" style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>
                {isAr ? 'جاري النسخ والضغط...' : 'Running Backup...'}
              </Text>
            </View>
          ) : (
            <View style={styles.btnRow}>
              <Ionicons name="play-circle-outline" size={22} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.primaryButtonText}>
                {isAr ? 'بدء النسخ الاحتياطي الآن' : 'Start Backup Now'}
              </Text>
            </View>
          )}
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
    borderColor: 'rgba(47, 67, 96, 0.12)',
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(0,0,0,0.05)' },
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 3 },
    }),
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#eef3f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2f4360',
    textAlign: 'center',
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
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
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
      android: { elevation: 2 },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2f4360',
  },
  scheduleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  scheduleSubtext: {
    fontSize: 12,
    color: '#777',
    lineHeight: 17,
  },
  statusDetails: {
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f7f7f7',
  },
  statusLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 13,
    color: '#222',
    fontWeight: '600',
    maxWidth: '65%',
    textAlign: 'right',
  },
  noStatusText: {
    fontSize: 13,
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  actionDescription: {
    fontSize: 13,
    color: '#555',
    marginBottom: 14,
    lineHeight: 18,
  },
  primaryButton: {
    backgroundColor: '#2f4360',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
