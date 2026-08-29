import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform, ScrollView, Image } from 'react-native';
import axios from 'axios';
import { Picker } from '@react-native-picker/picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { API_URL } from '../config/api';
import { getAuthToken } from '../config/authSession';
import { useLanguage } from '../utils/LanguageContext';

import { useTheme } from '../utils/ThemeContext';
export default function TelegramTestScreen({ route, navigation }) {const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode);
  const { token: routeToken } = route.params || {};
  const token = routeToken || getAuthToken();
  const { t, locale } = useLanguage();
  const isRtl = locale === 'ar';

  const [status, setStatus] = useState('checking');
  const [telegramMode, setTelegramMode] = useState('');
  const [qrCode, setQrCode] = useState(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingStaff, setFetchingStaff] = useState(true);

  const getHeaders = () => {
    const cleanToken = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    return { Authorization: cleanToken };
  };

  const fetchStatus = async () => {
    try {
      const res = await axios.get(`${API_URL}/telegram/status`, { headers: getHeaders() });
      setStatus(res.data.status);
      setTelegramMode(res.data.mode);
      setQrCode(res.data.qr || null);

      // Auto-register Webhook with Telegram API so /start messages receive instant replies
      axios.post(`${API_URL}/telegram/setup-webhook`, {}, { headers: getHeaders() }).catch(() => {});
    } catch (err) {
      setStatus('error');
      setQrCode(null);
    }
  };

  const fetchStaff = async () => {
    setFetchingStaff(true);
    try {
      const res = await axios.get(`${API_URL}/users/staff`, { headers: getHeaders() });
      setStaffList(res.data || []);
    } catch (err) {
      
    }
    setFetchingStaff(false);
  };

  useEffect(() => {
    fetchStatus();
    fetchStaff();

    const interval = setInterval(() => {
      fetchStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleReconnect = async () => {
    setReconnecting(true);
    try {
      await axios.post(`${API_URL}/telegram/reconnect`, {}, { headers: getHeaders() });
      Alert.alert(
        isRtl ? 'نجاح' : 'Success',
        isRtl ? 'جاري إعادة تهيئة خدمة التليجرام لتوليد رمز QR جديد...' : 'Re-initializing Telegram service to generate a new QR code...'
      );
      fetchStatus();
    } catch (err) {
      const errMsg = err.response?.data?.msg || err.message || 'Server error';
      Alert.alert(
        isRtl ? 'خطأ' : 'Error',
        isRtl ? `فشل إعادة الاتصال: ${errMsg}` : `Failed to reconnect: ${errMsg}`
      );
    }
    setReconnecting(false);
  };

  const handleLogout = async () => {
    Alert.alert(
      isRtl ? 'تأكيد تسجيل الخروج' : 'Confirm Log Out',
      isRtl 
        ? 'هل أنت متأكد من رغبتك في تسجيل الخروج وقطع اتصال تليجرام؟ ستحتاج لمسح رمز QR جديد للاتصال مجدداً.' 
        : 'Are you sure you want to log out and disconnect Telegram? You will need to scan a new QR code to connect again.',
      [
        { text: isRtl ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRtl ? 'تسجيل خروج' : 'Log Out',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try {
              await axios.post(`${API_URL}/telegram/logout`, {}, { headers: getHeaders() });
              Alert.alert(
                isRtl ? 'نجاح' : 'Success',
                isRtl ? 'تم قطع الاتصال بنجاح. جاري توليد رمز QR جديد...' : 'Disconnected successfully. Generating a new QR code...'
              );
              fetchStatus();
            } catch (err) {
              const errMsg = err.response?.data?.msg || err.message || 'Server error';
              Alert.alert(
                isRtl ? 'خطأ' : 'Error',
                isRtl ? `فشل تسجيل الخروج: ${errMsg}` : `Failed to log out: ${errMsg}`
              );
            }
            setLoggingOut(false);
          }
        }
      ]
    );
  };

  const handleStaffSelect = (staffId) => {
    setSelectedStaffId(staffId);
    if (!staffId) {
      setPhoneNumber('');
      return;
    }
    const staffMember = staffList.find(s => s._id === staffId);
    if (staffMember && (staffMember.telegramChatId || staffMember.phonenumber)) {
      setPhoneNumber(staffMember.telegramChatId || staffMember.phonenumber);
    } else {
      setPhoneNumber('');
    }
  };

  const handleSend = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert(isRtl ? 'تنبيه' : 'Warning', isRtl ? 'برجاء إدخال رقم التليفون' : 'Please enter a phone number');
      return;
    }
    if (!message.trim()) {
      Alert.alert(isRtl ? 'تنبيه' : 'Warning', isRtl ? 'برجاء إدخال نص الرسالة' : 'Please enter a message');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/telegram/send-test`, {
        to: phoneNumber,
        message: message,
        userId: selectedStaffId || null
      }, { headers: getHeaders() });

      if (response.data && response.data.success) {
        Alert.alert(
          isRtl ? 'نجاح' : 'Success',
          isRtl ? 'تم إرسال الرسالة بنجاح!' : 'Message sent successfully!'
        );
        setMessage(''); 
      } else {
        throw new Error(response.data.msg || 'Unknown error');
      }
    } catch (err) {
      const errMsg = err.response?.data?.msg || err.message || 'Server error';
      Alert.alert(
        isRtl ? 'خطأ' : 'Error',
        isRtl ? `فشل إرسال الرسالة: ${errMsg}` : `Failed to send message: ${errMsg}`
      );
    }
    setLoading(false);
  };

  const [broadcastLoading, setBroadcastLoading] = useState(false);

  const handleBroadcast = async () => {
    if (!message.trim()) {
      Alert.alert(isRtl ? 'تنبيه' : 'Warning', isRtl ? 'برجاء إدخال نص الرسالة للتعميم' : 'Please enter message content for broadcast');
      return;
    }

    const confirmMsg = isRtl
      ? `هل أنت تأكد من إرسال هذا التعميم لجميع الخدام (${staffList.length} خادم)؟`
      : `Are you sure you want to broadcast this message to all staff members (${staffList.length} members)?`;

    const confirmed = await new Promise(resolve => {
      Alert.alert(
        isRtl ? 'تأكيد الإرسال' : 'Confirm Broadcast',
        confirmMsg,
        [
          { text: isRtl ? 'إلغاء' : 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: isRtl ? 'إرسال' : 'Send', onPress: () => resolve(true) }
        ],
        { cancelable: false }
      );
    });

    if (!confirmed) return;

    setBroadcastLoading(true);
    try {
      const response = await axios.post(`${API_URL}/telegram/broadcast`, {
        message: message.trim(),
        targetRole: 'all'
      }, { headers: getHeaders() });

      if (response.data && response.data.success) {
        Alert.alert(
          isRtl ? 'تمت إضافة التعميم بنجاح! 🚀' : 'Broadcast Queued! 🚀',
          response.data.msg || (isRtl ? 'تم جدولة الرسائل وإرسالها في الخلفية.' : 'Messages queued in background.')
        );
        setMessage('');
      } else {
        throw new Error(response.data.msg || 'Unknown error');
      }
    } catch (err) {
      const errMsg = err.response?.data?.msg || err.message || 'Server error';
      Alert.alert(
        isRtl ? 'خطأ' : 'Error',
        isRtl ? `فشل الإرسال: ${errMsg}` : `Broadcast error: ${errMsg}`
      );
    } finally {
      setBroadcastLoading(false);
    }
  };

  const [checkingAbsentees, setCheckingAbsentees] = useState(false);

  const handleCheckAbsentees = async () => {
    if (!selectedStaffId) {
      Alert.alert(isRtl ? 'تنبيه' : 'Warning', isRtl ? 'يرجى اختيار الخادم (المعلم) أولاً للتحقق من المخدومين المعينين له.' : 'Please select a teacher first to check their assigned students.');
      return;
    }
    
    setCheckingAbsentees(true);
    try {
      const response = await axios.post(`${API_URL}/telegram/check-absentees`, { userId: selectedStaffId }, { headers: getHeaders() });
      if (response.data && response.data.success) {
        Alert.alert(
          isRtl ? 'تم بنجاح' : 'Success',
          response.data.msg
        );
      } else {
        throw new Error(response.data.msg || 'Unknown error');
      }
    } catch (err) {
      const errMsg = err.response?.data?.msg || err.message || 'Server error';
      Alert.alert(
        isRtl ? 'تنبيه' : 'Notice',
        errMsg
      );
    } finally {
      setCheckingAbsentees(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'connected':
        return { label: isRtl ? 'متصل' : 'Connected', color: '#2ec4b6', bg: 'rgba(46, 196, 182, 0.15)' };
      case 'connecting':
        return { label: isRtl ? 'جاري الاتصال' : 'Connecting', color: '#ffb703', bg: 'rgba(255, 183, 3, 0.15)' };
      case 'disconnected':
        return { label: isRtl ? 'غير متصل' : 'Disconnected', color: '#e71d36', bg: 'rgba(231, 29, 54, 0.15)' };
      case 'error':
        return { label: isRtl ? 'خطأ في الخدمة' : 'Service Error', color: '#d90429', bg: 'rgba(217, 4, 41, 0.15)' };
      default:
        return { label: isRtl ? 'جاري التحقق...' : 'Checking...', color: '#707070', bg: 'rgba(112, 112, 112, 0.15)' };
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }]}>
        <View style={styles.header}>
          <View style={styles.logoWrap}>
            <Ionicons name="paper-plane" size={40} color={theme.iconColor} />
          </View>
          <Text style={[styles.title, { color: theme.text }, { color: theme.text }]}>{isRtl ? 'تجربة إرسال التليجرام' : 'Telegram API Testing'}</Text>
          <Text style={styles.subtitle}>
            {isRtl ? 'أداة اختبار إرسال الرسائل الفورية والمجدولة' : 'Instant & Scheduled Telegram message testing utility'}
          </Text>
        </View>

        {}
        <View style={styles.statusBox}>
          <Text style={styles.sectionTitle}>{isRtl ? 'حالة الخدمة' : 'Service Status'}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.badge, { backgroundColor: statusBadge.bg }]}>
              <View style={[styles.dot, { backgroundColor: statusBadge.color }]} />
              <Text style={[styles.badgeText, { color: statusBadge.color }]}>{statusBadge.label}</Text>
            </View>
            {telegramMode ? (
              <Text style={styles.modeText}>
                Mode: <Text style={styles.modeHighlight}>{telegramMode.toUpperCase()}</Text>
              </Text>
            ) : null}
          </View>
          {telegramMode === 'local' && status === 'connected' && (
            <TouchableOpacity
              style={styles.disconnectButton}
              onPress={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View style={styles.btnRow}>
                  <Ionicons name="log-out-outline" size={16} color={theme.iconColor} style={{ marginRight: 6 }} />
                  <Text style={styles.disconnectButtonText}>
                    {isRtl ? 'تسجيل الخروج (قطع اتصال التليجرام)' : 'Disconnect Telegram (Log Out)'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {}
        {telegramMode === 'local' && (status === 'disconnected' || status === 'connecting' || status === 'error') && (
          <View style={styles.qrBox}>
            <Text style={styles.qrSectionTitle}>
              {isRtl ? 'ربط الحساب (مسح الرمز)' : 'Connect Account (Scan QR Code)'}
            </Text>
            {qrCode ? (
              <View style={styles.qrAlign}>
                <Text style={styles.qrInstruction}>
                  {isRtl 
                    ? 'افتح تليجرام على هاتفك > الأجهزة المرتبطة > ربط جهاز، ثم قم بمسح الرمز التالي:' 
                    : 'Open Telegram on your phone > Linked Devices > Link a Device, then scan the QR code below:'}
                </Text>
                <View style={styles.qrWrapper}>
                  <Image
                    source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrCode)}` }}
                    style={styles.qrImage}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.qrFooterText}>
                  {isRtl ? 'الرمز يتغير تلقائياً كل بضعة ثوانٍ.' : 'The QR code updates automatically every few seconds.'}
                </Text>
              </View>
            ) : (
              <View style={styles.qrLoadingBox}>
                <ActivityIndicator size="small" color={theme.iconColor} />
                <Text style={styles.qrLoadingText}>
                  {isRtl 
                    ? 'جاري توليد رمز QR... قد يستغرق ذلك نصف دقيقة.' 
                    : 'Generating QR code... This may take up to 30 seconds.'}
                </Text>
              </View>
            )}
            
            {}
            <TouchableOpacity
              style={styles.reconnectButton}
              onPress={handleReconnect}
              disabled={reconnecting}
            >
              {reconnecting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.btnRow}>
                  <Ionicons name="refresh-outline" size={18} color={theme.iconColor} style={{ marginRight: 6 }} />
                  <Text style={styles.reconnectButtonText}>
                    {isRtl ? 'إعادة تشغيل الاتصال وتوليد رمز جديد' : 'Restart Connection & Regenerate QR'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {}
        <View style={styles.form}>
          {}
          <Text style={styles.inputLabel}>{isRtl ? 'اختار الخادم (المستلم)' : 'Select Servant (Recipient)'}</Text>
          {fetchingStaff ? (
            <ActivityIndicator size="small" color={theme.iconColor} style={styles.loader} />
          ) : (
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedStaffId}
                onValueChange={(itemValue) => handleStaffSelect(itemValue)}
                style={styles.picker}
              >
                <Picker.Item label={isRtl ? '-- اختار خادم --' : '-- Select a Servant --'} value="" />
                {staffList.map((s) => (
                  <Picker.Item key={s._id} label={`${s.fullName} (${s.role})`} value={s._id} />
                ))}
              </Picker>
            </View>
          )}

          {}
          <Text style={styles.inputLabel}>{isRtl ? 'رقم التليفون' : 'Phone Number'}</Text>
          <TextInput
            style={[styles.input, { textAlign: isRtl ? 'right' : 'left' }]}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="e.g. 201000000000"
            keyboardType="phone-pad"
            placeholderTextColor={theme.textMuted}
          />

          {}
          <Text style={styles.inputLabel}>{isRtl ? 'نص الرسالة' : 'Message Body'}</Text>
          <TextInput
            style={[styles.textArea, { textAlign: isRtl ? 'right' : 'left' }]}
            value={message}
            onChangeText={setMessage}
            placeholder={isRtl ? 'اكتب الرسالة التجريبية هنا...' : 'Type your test message here...'}
            multiline
            numberOfLines={4}
            placeholderTextColor={theme.textMuted}
          />

          {}
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSend}
            disabled={loading || broadcastLoading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.btnRow}>
                <Ionicons name="paper-plane-outline" size={20} color={theme.iconColor} style={{ marginRight: 6 }} />
                <Text style={styles.sendButtonText}>{isRtl ? 'إرسال لخادم محدد' : 'Send to Selected Person'}</Text>
              </View>
            )}
          </TouchableOpacity>

          {}
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: '#e67e22', marginTop: 10 }]}
            onPress={handleBroadcast}
            disabled={loading || broadcastLoading}
          >
            {broadcastLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.btnRow}>
                <Ionicons name="megaphone-outline" size={20} color={theme.iconColor} style={{ marginRight: 6 }} />
                <Text style={styles.sendButtonText}>
                  {isRtl ? `إرسال تعميم لجميع الخدام (${staffList.length} خادم)` : `Broadcast to All Staff (${staffList.length} Members)`}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: '#8e44ad', marginTop: 10 }]}
            onPress={handleCheckAbsentees}
            disabled={loading || broadcastLoading || checkingAbsentees}
          >
            {checkingAbsentees ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.btnRow}>
                <Ionicons name="people-outline" size={20} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.sendButtonText}>
                  {isRtl ? 'تحقق من غياب مخدومي الخادم المحدد (إرسال تنبيه له)' : 'Check Selected Teacher\'s Absentees (Alert Them)'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const getStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 550,
    backgroundColor: '#fffcf6',
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 24,
    padding: 24,
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
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.borderColor,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#707070',
    textAlign: 'center',
    marginTop: 4,
  },
  statusBox: {
    backgroundColor: 'rgba(47, 67, 96, 0.04)',
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  modeText: {
    fontSize: 12,
    color: theme.textMuted,
  },
  modeHighlight: {
    fontWeight: 'bold',
    color: theme.text,
  },
  form: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 6,
    marginTop: 14,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 12,
    backgroundColor: theme.cardBackground,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 12,
    padding: 12,
    backgroundColor: theme.cardBackground,
    color: theme.text,
    fontSize: 15,
  },
  textArea: {
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 12,
    padding: 12,
    backgroundColor: theme.cardBackground,
    color: theme.text,
    fontSize: 15,
    height: 100,
    textAlignVertical: 'top',
  },
  sendButton: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loader: {
    marginVertical: 10,
  },
  qrBox: {
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  qrSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 12,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  qrAlign: {
    alignItems: 'center',
    width: '100%',
  },
  qrInstruction: {
    fontSize: 12,
    color: theme.textMuted,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  qrWrapper: {
    padding: 8,
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  qrFooterText: {
    fontSize: 10,
    color: theme.textMuted,
    marginTop: 8,
    marginBottom: 16,
  },
  qrLoadingBox: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  qrLoadingText: {
    fontSize: 12,
    color: '#707070',
    marginTop: 10,
    textAlign: 'center',
  },
  reconnectButton: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    alignSelf: 'stretch',
  },
  reconnectButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  disconnectButton: {
    backgroundColor: '#d90429',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    alignSelf: 'stretch',
  },
  disconnectButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
