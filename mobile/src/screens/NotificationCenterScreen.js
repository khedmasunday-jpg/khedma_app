import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  ActivityIndicator, 
  Alert, 
  TouchableOpacity, 
  Platform 
} from 'react-native';
import axios from 'axios';
import { API_URL } from '../config/api';
import { getAuthToken } from '../config/authSession';
import { logger } from '../utils/logger';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLanguage } from '../utils/LanguageContext';

import { useTheme } from '../utils/ThemeContext';
const localTranslations = {
  en: {
    clearAll: "Clear All",
    noNotifications: "No notifications found",
    noNotificationsSub: "You are all caught up! Check back later.",
    birthday: "Birthday Greeting",
    weeklyFollowup: "Weekly Follow-up",
    generalNotification: "General Notification",
    confirmClearTitle: "Confirm Clear",
    confirmClearMsg: "Are you sure you want to delete all notifications? This action cannot be undone.",
    clearSuccess: "All notifications cleared successfully!",
    clearError: "Failed to clear notifications",
    fetchError: "Failed to load notifications",
  },
  ar: {
    clearAll: "مسح الكل",
    noNotifications: "لا توجد إشعارات حالياً",
    noNotificationsSub: "لقد قرأت جميع الإشعارات! تفقد هذه الصفحة لاحقاً.",
    birthday: "تهنئة عيد ميلاد",
    weeklyFollowup: "متابعة أسبوعية",
    generalNotification: "إشعار عام",
    confirmClearTitle: "تأكيد المسح",
    confirmClearMsg: "هل أنت متأكد من رغبتك في حذف جميع الإشعارات؟ لا يمكن التراجع عن هذا الإجراء.",
    clearSuccess: "تم مسح جميع الإشعارات بنجاح!",
    clearError: "فشل مسح الإشعارات",
    fetchError: "فشل تحميل الإشعارات",
  }
};

export default function NotificationCenterScreen({ route, navigation }) {const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode);
  const { token: routeToken } = route.params || {};
  const token = routeToken || getAuthToken();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t, locale } = useLanguage();
  const isRtl = locale === 'ar';

  const localT = (key) => {
    return localTranslations[locale]?.[key] || localTranslations['en'][key] || key;
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/notifications`, {
        headers: { Authorization: token }
      });
      setNotifications(res.data || []);
    } catch (err) {
      logger.error('Failed to fetch notifications:', err);
      Alert.alert(t('error'), localT('fetchError'));
    }
    setLoading(false);
  };

  const handleClearAll = () => {
    const performClear = async () => {
      try {
        await axios.delete(`${API_URL}/notifications/clear`, {
          headers: { Authorization: token }
        });
        setNotifications([]);
      } catch (err) {
        logger.error('Failed to clear notifications:', err);
        Alert.alert(t('error'), localT('clearError'));
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(localT('confirmClearMsg'));
      if (confirmed) performClear();
    } else {
      Alert.alert(
        localT('confirmClearTitle'),
        localT('confirmClearMsg'),
        [
          { text: t('cancel'), style: 'cancel' },
          { text: localT('clearAll'), style: 'destructive', onPress: performClear }
        ]
      );
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const getNotifIconInfo = (type) => {
    switch (type) {
      case 'birthday':
        return { name: 'gift-outline', color: '#e91e63' };
      case 'weekly_followup':
      case 'weekly':
        return { name: 'chatbubble-ellipses-outline', color: '#2f4360' };
      default:
        return { name: 'notifications-outline', color: '#666' };
    }
  };

  const getLocalizedType = (type) => {
    switch (type) {
      case 'birthday':
        return localT('birthday');
      case 'weekly_followup':
      case 'weekly':
        return localT('weeklyFollowup');
      default:
        return localT('generalNotification');
    }
  };

  const formatNotifDate = (dateStr) => {
    try {
      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) return '';
      
      return dateObj.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }, { backgroundColor: theme.background }]}>
      {}
      <View style={[styles.headerRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
        <Text style={styles.screenTitle}>{t('notifications')}</Text>
        {notifications.length > 0 && (
          <TouchableOpacity 
            style={[styles.clearBtn, { flexDirection: isRtl ? 'row-reverse' : 'row' }]} 
            onPress={handleClearAll}
          >
            <Ionicons name="trash-outline" size={16} color={theme.iconColor} style={isRtl ? { marginLeft: 4 } : { marginRight: 4 }} />
            <Text style={styles.clearBtnText}>{localT('clearAll')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {}
      <ScrollView 
        style={styles.scrollArea} 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.iconColor} />
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="notifications-off-outline" size={48} color="rgba(47, 67, 96, 0.25)" />
            </View>
            <Text style={styles.emptyTitle}>{localT('noNotifications')}</Text>
            <Text style={styles.emptySubtitle}>{localT('noNotificationsSub')}</Text>
          </View>
        ) : (
          notifications.map((notif, idx) => {
            const iconInfo = getNotifIconInfo(notif.type);
            return (
              <View 
                key={idx} 
                style={[styles.notifCard, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}
              >
                {}
                <View style={[styles.iconBadge, { backgroundColor: `${iconInfo.color}15` }]}>
                  <Ionicons name={iconInfo.name} size={22} color={iconInfo.color} />
                </View>

                {}
                <View style={[styles.textBlock, { alignItems: isRtl ? 'flex-end' : 'flex-start' }]}>
                  <View style={[styles.cardHeader, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                    <Text style={styles.notifType}>{getLocalizedType(notif.type)}</Text>
                  </View>
                  <Text style={[styles.notifMsg, { textAlign: isRtl ? 'right' : 'left' }]}>
                    {notif.message}
                  </Text>
                  <Text style={styles.notifDate}>{formatNotifDate(notif.createdAt)}</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const getStyles = (theme, isDarkMode) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: theme.background,
    padding: 16,
  },
  headerRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.text,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  clearBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(211, 47, 47, 0.25)',
    backgroundColor: 'rgba(211, 47, 47, 0.04)',
    ...Platform.select({
      web: { transition: 'background-color 0.2s ease, border-color 0.2s ease' }
    })
  },
  clearBtnText: {
    color: '#d32f2f',
    fontWeight: 'bold',
    fontSize: 13,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  center: {
    paddingVertical: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(47, 67, 96, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: 'rgba(47, 67, 96, 0.5)',
    textAlign: 'center',
    lineHeight: 20,
  },
  notifCard: { 
    backgroundColor: theme.cardBackground, 
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 12,
    gap: 14,
    alignItems: 'flex-start',
    ...Platform.select({
      ios: {
        shadowColor: '#24364f',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 4px 6px rgba(36, 54, 79, 0.05)',
      }
    }),
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textBlock: {
    flex: 1,
    gap: 6,
  },
  cardHeader: {
    justifyContent: 'space-between',
    width: '100%',
  },
  notifType: { 
    fontWeight: 'bold', 
    fontSize: 15, 
    color: theme.text,
  },
  notifMsg: { 
    fontSize: 14, 
    color: theme.textMuted,
    lineHeight: 20,
  },
  notifDate: { 
    fontSize: 11, 
    color: 'rgba(47, 67, 96, 0.45)',
    marginTop: 4,
    fontWeight: '600',
  },
});
