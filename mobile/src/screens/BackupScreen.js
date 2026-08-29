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
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

import { useTheme } from '../utils/ThemeContext';
export default function BackupScreen({ route, navigation }) {const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode);
  const { token: routeToken } = route.params || {};
  const token = routeToken || getAuthToken();
  const { locale } = useLanguage();
  const client = createApiClient(token);

  const [loadingStatus, setLoadingStatus] = useState(true);
  const [runningBackup, setRunningBackup] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);
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
    Alert.alert(title, msg);
  };

  const confirmAndRunBackup = () => {
    const title = isAr ? 'تأكيد النسخ الاحتياطي' : 'Confirm Backup';
    const message = isAr
      ? 'هل أنت تأكد من تطبيق النسخ الاحتياطي لقاعدة البيانات الآن؟'
      : 'Are you sure you want to run a database backup now?';

    Alert.alert(
      title,
      message,
      [
        { text: isAr ? 'إلغاء' : 'Cancel', style: 'cancel' },
        { text: isAr ? 'بدء النسخ' : 'Start', onPress: () => doRunBackup() }
      ],
      { cancelable: true }
    );
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

  const handleRestoreBackup = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', '*/*'],
        copyToCacheDirectory: true
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      let fileContent = '';

      if (Platform.OS === 'web') {
        const response = await fetch(asset.uri);
        fileContent = await response.text();
      } else {
        fileContent = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
      }

      const jsonData = JSON.parse(fileContent);
      if (!jsonData || !jsonData.collections) {
        notify(
          isAr ? 'خطأ في تنسيق الملف' : 'Invalid File Format',
          isAr ? 'ملف النسخة الاحتياطية غير صالح (يجب أن يحتوي على كائنات collections).' : 'Invalid backup JSON file (missing collections object).'
        );
        return;
      }

      const confirmMsg = isAr
        ? `هل أنت تأكد من استعادة كافة بيانات وقواعد واستعادة حسابات الخدام والمخدومين من ملف النسخة الاحتياطية "${asset.name}"؟`
        : `Are you sure you want to restore all user accounts, students, classes, and logs from backup file "${asset.name}"?`;

      const executeRestore = async () => {
        setRestoringBackup(true);
        try {
          const res = await client.post('/backup/restore', jsonData);
          if (res.data && res.data.success) {
            const details = res.data.details || {};
            notify(
              isAr ? 'تمت استعادة البيانات والحسابات بنجاح! 🚀' : 'Restore Successful! 🚀',
              isAr
                ? `تمت استعادة كافة البيانات وحسابات الخدام بنجاح!\nالمجموعات المستعادة: ${details.restoredCollectionsCount || 0}\nإجمالي المستندات: ${details.restoredDocsCount || 0}`
                : `Database and accounts successfully restored!\nCollections Restored: ${details.restoredCollectionsCount || 0}\nDocuments Restored: ${details.restoredDocsCount || 0}`
            );
            fetchStatus();
          } else {
            notify(isAr ? 'خطأ' : 'Error', res.data?.msg || 'Failed to restore backup');
          }
        } catch (err) {
          logger.error('Restore backup error:', err);
          notify(
            isAr ? 'خطأ' : 'Error',
            err.response?.data?.msg || err.message || (isAr ? 'فشل إجراء استعادة النسخة الاحتياطية' : 'Failed to restore JSON backup file')
          );
        } finally {
          setRestoringBackup(false);
        }
      };

      Alert.alert(
        isAr ? 'تأكيد الاستعادة' : 'Confirm Restore',
        confirmMsg,
        [
          { text: isAr ? 'إلغاء' : 'Cancel', style: 'cancel' },
          { text: isAr ? 'استعادة' : 'Restore', onPress: executeRestore }
        ],
        { cancelable: true }
      );
    } catch (err) {
      logger.error('File picker error:', err);
      notify(
        isAr ? 'خطأ' : 'Error',
        err.message || (isAr ? 'فشل قراءة الملف' : 'Failed to read file')
      );
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {}
      <View style={styles.headerCard}>
        <View style={styles.iconCircle}>
          <Ionicons name="cloud-upload-outline" size={36} color={theme.iconColor} />
        </View>
        <Text style={[styles.headerTitle, { color: theme.text }, { color: theme.text }]}>
          {isAr ? 'نظام النسخ الاحتياطي والاستعادة' : 'Database Backup & Restore'}
        </Text>
        <Text style={styles.headerSubtitle}>
          {isAr
            ? 'تصدير واستعادة بيانات التطبيق وحسابات الخدام والمخدومين وآمناً على Google Drive'
            : 'Export and restore application database backups, user accounts, and student records'}
        </Text>
      </View>

      {}
      <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="time-outline" size={22} color={theme.iconColor} style={{ marginRight: 8 }} />
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

      {}
      <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="shield-checkmark-outline" size={22} color={theme.iconColor} style={{ marginRight: 8 }} />
          <Text style={styles.cardTitle}>
            {isAr ? 'حالة آخر نسخة احتياطية' : 'Last Backup Details'}
          </Text>
        </View>

        {loadingStatus ? (
          <ActivityIndicator size="small" color={theme.iconColor} style={{ marginVertical: 12 }} />
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

      {}
      <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="flash-outline" size={22} color={theme.iconColor} style={{ marginRight: 8 }} />
          <Text style={styles.cardTitle}>
            {isAr ? 'تشغيل نسخ احتياطي فوري' : 'Manual Immediate Backup'}
          </Text>
        </View>

        <Text style={styles.actionDescription}>
          {isAr
            ? 'اضغط على الزر أدناه لتطبيق نسخة احتياطية كاملة وشاملة لكافة بيانات التطبيق وحسابات الخدام في الحال.'
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

      {}
      <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }, { borderColor: 'rgba(39, 174, 96, 0.3)', backgroundColor: '#fbfefc' }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="cloud-download-outline" size={22} color={theme.iconColor} style={{ marginRight: 8 }} />
          <Text style={[styles.cardTitle, { color: '#27ae60' }]}>
            {isAr ? 'استعادة ملف نسخة احتياطية (JSON Restore)' : 'Restore JSON Backup File'}
          </Text>
        </View>

        <Text style={styles.actionDescription}>
          {isAr
            ? 'اختر ملف النسخة الاحتياطية (.json) لاسترجاع كافة حسابات الخدام (26 حساب)، المخدومين، الفصول، والإشعارات دفعة واحدة.'
            : 'Select a JSON backup file (.json) to restore all user accounts (teachers/principals), students, classes, and logs.'}
        </Text>

        <TouchableOpacity
          style={[styles.restoreButton, restoringBackup && styles.disabledButton]}
          onPress={handleRestoreBackup}
          disabled={restoringBackup}
        >
          {restoringBackup ? (
            <View style={styles.btnRow}>
              <ActivityIndicator color="#ffffff" size="small" style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>
                {isAr ? 'جاري استعادة البيانات والحسابات...' : 'Restoring Database & Accounts...'}
              </Text>
            </View>
          ) : (
            <View style={styles.btnRow}>
              <Ionicons name="folder-open-outline" size={20} color={theme.iconColor} style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>
                {isAr ? 'اختيار ملف JSON واستعادة كافة الحسابات' : 'Pick JSON File & Restore All Accounts'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const getStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    padding: 16,
    alignItems: 'center',
  },
  headerCard: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.borderColor,
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
    color: theme.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: theme.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  card: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.borderColor,
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
    color: theme.text,
  },
  scheduleText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 6,
  },
  scheduleSubtext: {
    fontSize: 12,
    color: theme.textMuted,
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
    color: theme.textMuted,
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 13,
    color: theme.text,
    fontWeight: '600',
    maxWidth: '65%',
    textAlign: 'right',
  },
  noStatusText: {
    fontSize: 13,
    color: theme.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  actionDescription: {
    fontSize: 13,
    color: theme.textMuted,
    marginBottom: 14,
    lineHeight: 18,
  },
  primaryButton: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoreButton: {
    backgroundColor: '#27ae60',
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
    fontSize: 14,
  },
});
