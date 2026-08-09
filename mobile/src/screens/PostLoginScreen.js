import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Text, Alert, Platform, Modal, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Axios from 'axios';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLanguage } from '../utils/LanguageContext';
import { useTheme } from '../utils/ThemeContext';
import { API_URL } from '../config/api';
import { getAuthToken } from '../config/authSession';
import { logger } from '../utils/logger';

const BUTTONS = [
  { labelKey: 'takeAttendance', label: 'تسجيل حضور', minRank: 2 },
  { labelKey: 'birthdays', label: 'اعياد الميلاد', minRank: 2, excludeRanks: [4] },
  { labelKey: 'classDisplay', label: 'عرض الفصل', minRank: 2 },
  { labelKey: 'editVisitation', label: 'تعديل خدام الافتقاد', exactRank: 3 },
  { labelKey: 'addStudents', label: 'اضافه المخدومين', maxRank: 3 },
  { labelKey: 'addStaff', label: 'اضافه خدام', minRank: 1, maxRank: 2, excludeRanks: [4] },
  { labelKey: 'activateDeactivate', label: 'activate / deactivate', minRank: 1, maxRank: 2, excludeRanks: [3,4] },
  { labelKey: 'editStaff', label: 'تعديل بينات الخدام', maxRank: 2 },
  { labelKey: 'editStudents', label: 'تعديل بينات المخدومين', maxRank: 3 },
  { labelKey: 'tayo', label: 'الطايو', minRank: 1 },
  { labelKey: 'logs', label: 'Logs', exactRank: 1 },
  { labelKey: 'reset', label: 'Reset', exactRank: 1 },
  { labelKey: 'whatsappTest', label: 'Telegram Test', exactRank: 1 },
  { labelKey: 'backupData', label: 'النسخ الاحتياطي', exactRank: 1 },
  { labelKey: 'rssLinks', label: 'RSS Links', minRank: 1 },
];

const BUTTON_ICONS = {
  'notifications': { icon: 'notifications-outline', color: 'theme-text' },
  'takeAttendance': { icon: 'checkmark-done-circle-outline', color: 'theme-text' },
  'birthdays': { icon: 'gift-outline', color: 'theme-text' },
  'classDisplay': { icon: 'easel-outline', color: 'theme-text' },
  'editVisitation': { icon: 'git-network-outline', color: 'theme-text' },
  'addStudents': { icon: 'person-add-outline', color: 'theme-text' },
  'addStaff': { icon: 'people-outline', color: 'theme-text' },
  'activateDeactivate': { icon: 'toggle-outline', color: 'theme-text' },
  'editStaff': { icon: 'create-outline', color: 'theme-text' },
  'editStudents': { icon: 'pencil-outline', color: 'theme-text' },
  'tayo': { icon: 'star-outline', color: '#f39c12' },
  'logs': { icon: 'document-text-outline', color: 'theme-text' },
  'reset': { icon: 'refresh-circle-outline', color: 'theme-text' },
  'whatsappTest': { icon: 'paper-plane', color: '#25D366' },
  'backupData': { icon: 'cloud-upload-outline', color: '#27ae60' },
  'importData': { icon: 'cloud-download-outline', color: 'theme-text' },
  'rssLinks': { icon: 'logo-rss', color: '#e67e22' },
};

const roleToRank = {
  admin: 1,
  principal: 2,
  'co-principal': 3,
  teacher: 4,
};

export default function PostLoginScreen({ route, navigation }) {
  const { token: routeToken, role, fullName: initialFullName, isClassLeader } = route.params || {};
  const token = routeToken || getAuthToken();
  const userRank = roleToRank[role];
  const [fullName, setFullName] = useState(initialFullName);
  const [unreadCount, setUnreadCount] = useState(0);
  const { t, locale, toggleLanguage } = useLanguage();
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const styles = getStyles(theme, isDarkMode);

  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [currentUsername, setCurrentUsername] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileSubmitting, setProfileSubmitting] = useState(false);

  const handleLogout = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  useFocusEffect(
    useCallback(() => {
      if (token) {
        Axios.get(`${API_URL}/notifications`, {
          headers: { Authorization: token }
        }).then(res => {
          const unread = res.data.filter(n => !n.read).length;
          setUnreadCount(unread);
        }).catch(() => setUnreadCount(0));
      }
    }, [token])
  );

  logger.log("🔍 PostLoginScreen params:", { token: !!token, role, fullName: initialFullName });
  logger.log("🔍 Route params:", route.params);

  useEffect(() => {
    if (token) {
      const fetchUserData = async () => {
        try {
          const response = await Axios.get(`${API_URL}/users/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (response.data) {
            if (response.data.fullName) {
              setFullName(response.data.fullName);
            }
            if (response.data.username) {
              setCurrentUsername(response.data.username);
              setNewUsername(response.data.username);
            }
            if (response.data.telegramChatId) {
              setTelegramChatId(response.data.telegramChatId);
            }
          }
        } catch (error) {
          logger.error('Failed to fetch user data:', error);
        }
      };
      fetchUserData();
    }
  }, [token]);

  const handleUpdateProfile = async () => {
    if (!newUsername.trim()) {
      Alert.alert(locale === 'ar' ? 'خطأ' : 'Error', locale === 'ar' ? 'اسم المستخدم مطلوب' : 'Username is required');
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      Alert.alert(locale === 'ar' ? 'خطأ' : 'Error', locale === 'ar' ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }

    setProfileSubmitting(true);
    try {
      const payload = { username: newUsername, telegramChatId };
      if (newPassword) payload.password = newPassword;

      await Axios.patch(`${API_URL}/users/me/update-credentials`, payload, {
        headers: { Authorization: token }
      });

      Alert.alert(
        locale === 'ar' ? 'تم بنجاح' : 'Success',
        locale === 'ar' ? 'تم تحديث بيانات الملف الشخصي بنجاح.' : 'Profile updated successfully.'
      );
      
      setCurrentUsername(newUsername);
      setNewPassword('');
      setConfirmPassword('');
      setProfileModalVisible(false);
    } catch (err) {
      logger.error('Error updating profile credentials:', err);
      Alert.alert(
        locale === 'ar' ? 'فشل التحديث' : 'Update Failed',
        err.response?.data?.msg || err.response?.data?.message || err.message || (locale === 'ar' ? 'حدث خطأ أثناء حفظ التعديلات' : 'An error occurred while saving updates')
      );
    } finally {
      setProfileSubmitting(false);
    }
  };

  if (!role || !roleToRank.hasOwnProperty(role)) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle}>⚠️ Role not detected</Text>
        <Text style={styles.errorSubtitle}>
          Check if backend is sending the role correctly.
        </Text>
      </View>
    );
  }

  const handleButtonPress = async (buttonKey) => {
    switch (buttonKey) {
      case 'notifications':
        try {
          await Axios.patch(`${API_URL}/notifications/mark-read`, {}, {
            headers: { Authorization: token }
          });
          setUnreadCount(0);
        } catch {}
        navigation.navigate('NotificationCenter');
        break;
      case 'takeAttendance':
        navigation.navigate('TakingAttendance', { role });
        break;
      case 'classDisplay':
        navigation.navigate('ClassDisplay', { role });
        break;
      case 'editVisitation':
        navigation.navigate('AssignStudentsScreen1');
        break;
      case 'birthdays':
        navigation.navigate('Birthdays', { role });
        break;
      case 'staffList':
        navigation.navigate('StaffList');
        break;
      case 'editStaff':
        navigation.navigate('EditStaffListScreen', { role });
        break;
      case 'rssLinks':
        navigation.navigate('RssLinksScreen', { role });
        break;
      case 'addStudents':
        navigation.navigate('AddStudentsScreen');
        break;
      case 'addStaff':
        navigation.navigate('AddStaff', { role });
        break;
      case 'editStudents':
        navigation.navigate('EditStudentListScreen', { role });
        break;
      case 'activateDeactivate':
        navigation.navigate('ActivateDeactivateScreen', { role });
        break;
      case 'tayo':
        navigation.navigate('TayoScreen', { role });
        break;
      case 'logs':
        navigation.navigate('LogsScreen');
        break;
      case 'reset':
        navigation.navigate('ResetDB');
        break;
      case 'whatsappTest':
        navigation.navigate('TelegramTestScreen');
        break;
      case 'backupData':
        navigation.navigate('BackupScreen');
        break;
      case 'importData':
        navigation.navigate('AddStudentsScreen', { autoPickExcel: true });
        break;
      default:
        Alert.alert(t('comingSoon'), t('development'));
    }
  };

  const availableButtons = BUTTONS.filter((btn) => {
    if (btn.labelKey === 'editVisitation' && isClassLeader) return true;
    if (btn.excludeRanks && btn.excludeRanks.includes(userRank)) return false;
    if (btn.exactRank !== undefined && userRank !== btn.exactRank) return false;
    if (btn.exactRank !== undefined && userRank === btn.exactRank) return true;
    
    if (btn.minRank !== undefined && userRank < btn.minRank) return false;
    if (btn.maxRank !== undefined && userRank > btn.maxRank) return false;
    
    if (btn.minRank === undefined && btn.maxRank === undefined && btn.exactRank === undefined) return true;
    
    return true;
  });

  const getLocalizedRole = (r) => {
    switch (r) {
      case 'admin': return t('roleAdmin');
      case 'principal': return t('rolePrincipal');
      case 'co-principal': return t('roleCoPrincipal');
      case 'teacher': return t('roleTeacher');
      default: return r;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.contentWrapper}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={{ width: '100%', marginBottom: 10, flexGrow: 0 }}
          contentContainerStyle={{ flexDirection: locale === 'ar' ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'flex-end', paddingVertical: 10, flexGrow: 1 }}
        >
          {role !== 'admin' && (
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: theme.inputBackground, borderColor: theme.borderColor }]} onPress={() => handleButtonPress('notifications')}>
              <Ionicons name="notifications-outline" size={22} color={theme.iconColor} />
              {unreadCount > 0 && <View style={styles.badgeDot} />}
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: theme.inputBackground, borderColor: theme.borderColor }]} onPress={() => setProfileModalVisible(true)}>
            <Ionicons name="person-circle-outline" size={22} color={theme.iconColor} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: theme.inputBackground, borderColor: theme.borderColor }]} onPress={toggleTheme}>
            <Ionicons name={isDarkMode ? "sunny-outline" : "moon-outline"} size={22} color={theme.iconColor} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: theme.inputBackground, borderColor: theme.borderColor }]} onPress={toggleLanguage}>
            <Ionicons name="globe-outline" size={22} color={theme.iconColor} />
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: theme.inputBackground, borderColor: theme.borderColor }]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color={theme.iconColor} />
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.header}>
          <View style={[styles.logoWrap, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }]}>
            <Ionicons name="book" size={32} color={theme.iconColor} />
          </View>
          <Text style={[styles.welcome, { color: theme.text }]}>{t('welcome')}، {fullName || role}</Text>
          <Text style={[styles.roleLabel, { color: theme.textMuted }]}>{getLocalizedRole(role).toUpperCase()}</Text>
        </View>
        
        <View style={[styles.gridContainer, { flexDirection: locale === 'ar' ? 'row-reverse' : 'row' }]}>
          {availableButtons.map((btn, idx) => {
            const iconInfo = BUTTON_ICONS[btn.labelKey] || { icon: 'apps-outline', color: theme.text };
            const isNotification = btn.labelKey === 'notifications';
            
            return (
              <TouchableOpacity
                key={idx}
                style={[styles.cardButton, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }]}
                onPress={() => handleButtonPress(btn.labelKey)}
              >
                <View style={styles.iconContainer}>
                  <Ionicons name={iconInfo.icon} size={36} color={iconInfo.color === '#2f4360' ? theme.iconColor : (iconInfo.color === 'theme-text' ? theme.text : iconInfo.color)} />
                  {isNotification && unreadCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{unreadCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.buttonLabel, { color: theme.text }]}>{t(btn.labelKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Modal
          animationType="fade"
          transparent={true}
          visible={profileModalVisible}
          onRequestClose={() => setProfileModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {locale === 'ar' ? 'الملف الشخصي' : 'Edit Profile'}
              </Text>
              
              <Text style={[styles.inputLabel, { color: theme.text }]}>
                {locale === 'ar' ? 'اسم المستخدم الجديد' : 'New Username'}
              </Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.borderColor }]}
                value={newUsername}
                onChangeText={setNewUsername}
                placeholder={locale === 'ar' ? 'أدخل اسم المستخدم' : 'Enter username'}
                placeholderTextColor={theme.textMuted}
                autoCapitalize="none"
              />

              <Text style={[styles.inputLabel, { color: theme.text }]}>
                {t('telegramChatIdLabel')}
              </Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.borderColor }]}
                value={telegramChatId}
                onChangeText={setTelegramChatId}
                placeholder={t('telegramChatIdPlaceholder')}
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
                autoCapitalize="none"
              />
              <Text style={{ fontSize: 11, color: theme.textMuted, marginTop: -6, marginBottom: 10, textAlign: locale === 'ar' ? 'right' : 'left' }}>
                💡 {t('telegramChatIdHint')}
              </Text>

              <Text style={[styles.inputLabel, { color: theme.text }]}>
                {locale === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'}
              </Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.borderColor }]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder={locale === 'ar' ? 'أدخل كلمة مرور جديدة' : 'Enter new password'}
                placeholderTextColor={theme.textMuted}
                secureTextEntry={true}
                autoCapitalize="none"
              />

              <Text style={[styles.inputLabel, { color: theme.text }]}>
                {locale === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm Password'}
              </Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.borderColor }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder={locale === 'ar' ? 'أعد كتابة كلمة المرور' : 'Retype new password'}
                placeholderTextColor={theme.textMuted}
                secureTextEntry={true}
                autoCapitalize="none"
              />

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => {
                    setNewUsername(currentUsername);
                    setNewPassword('');
                    setConfirmPassword('');
                    setProfileModalVisible(false);
                  }}
                  disabled={profileSubmitting}
                >
                  <Text style={styles.cancelBtnText}>
                    {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.saveBtn]}
                  onPress={handleUpdateProfile}
                  disabled={profileSubmitting}
                >
                  <Text style={styles.saveBtnText}>
                    {profileSubmitting 
                      ? (locale === 'ar' ? 'جاري الحفظ...' : 'Saving...') 
                      : (locale === 'ar' ? 'حفظ' : 'Save')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  iconBtn: {
    backgroundColor: 'rgba(255, 252, 246, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.2)',
    borderRadius: 24,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    marginRight: 4,
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#2f4360',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 4px 6px rgba(47, 67, 96, 0.1)',
      }
    }),
  },
  badgeDot: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'red',
  },
  topBtnText: {
    color: theme.text,
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 25,
  },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#2f4360',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 6px 10px rgba(47, 67, 96, 0.12)',
      }
    }),
    marginBottom: 12,
  },
  welcome: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.text,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
    textAlign: 'center',
  },
  roleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(36, 54, 79, 0.6)',
    letterSpacing: 1.5,
    marginTop: 4,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
    width: '100%',
  },
  cardButton: {
    width: '47%',
    aspectRatio: 1.1,
    backgroundColor: 'rgba(255, 252, 246, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.14)',
    borderRadius: 20,
    padding: 15,
    marginBottom: 15,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#24364f',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 8px 16px rgba(36, 54, 79, 0.08)',
      }
    }),
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#d9534f',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 252, 246, 0.95)',
  },
  badgeText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 10,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f3ede0',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#d9534f',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
    marginBottom: 10,
  },
  errorSubtitle: {
    fontSize: 16,
    color: 'rgba(36, 54, 79, 0.7)',
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    position: 'relative',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(47, 67, 96, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: theme.cardBackground,
    borderRadius: 20,
    width: '90%',
    maxWidth: 400,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.15)',
    ...Platform.select({
      ios: {
        shadowColor: '#2f4360',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 15,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 10px 25px rgba(47, 67, 96, 0.15)',
      }
    }),
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
    textAlign: 'center',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 6,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.2)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
    color: theme.text,
    fontSize: 15,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: 'rgba(235, 230, 218, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.12)',
    marginRight: 10,
  },
  cancelBtnText: {
    color: theme.textMuted,
    fontWeight: 'bold',
    fontSize: 15,
  },
  saveBtn: {
    backgroundColor: '#2f4360',
    marginLeft: 10,
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
