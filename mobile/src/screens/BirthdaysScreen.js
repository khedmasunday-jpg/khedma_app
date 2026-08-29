import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { createApiClient } from '../config/api';
import { logger } from '../utils/logger';
import { useLanguage } from '../utils/LanguageContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatDateDDMMYYYY } from '../utils/dateFormatter';
import { getAuthToken } from '../config/authSession';

import { useTheme } from '../utils/ThemeContext';
export default function BirthdaysScreen({ route }) {const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode);
  const { token: routeToken, role } = route.params || {};
  const token = routeToken || getAuthToken();
  const { t, locale } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);

  const isRtl = locale === 'ar';

  useEffect(() => {
    let mounted = true;
    const fetchBirthdays = async () => {
      try {
        const client = createApiClient(token);
        const res = await client.get('/birthdays');
        if (!mounted) return;
        setItems(res.data || []);
      } catch (e) {
        if (!mounted) return;
        const status = e.response && e.response.status;
        const msg = status ? `Request failed (${status})` : (e.message || 'Failed to load');
        setError(msg);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchBirthdays();
    return () => { mounted = false; };
  }, [token, role]);

  const getLocalizedRole = (r) => {
    switch (r) {
      case 'admin': return t('roleAdmin');
      case 'principal': return t('rolePrincipal');
      case 'co-principal': return t('roleCoPrincipal');
      case 'teacher': return t('roleTeacher');
      default: return r;
    }
  };

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color={theme.iconColor}/></View>
  );

  if (error) return (
    <View style={styles.center}><Text style={styles.error}>{error}</Text></View>
  );

  if (!items.length) return (
    <View style={styles.center}>
      <Ionicons name="gift-outline" size={48} color="rgba(47, 67, 96, 0.4)" />
      <Text style={styles.noDataText}>
        {locale === 'ar' ? 'لا توجد أعياد ميلاد هذا الشهر.' : 'No birthdays this month.'}
      </Text>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {items.map((it) => (
        <View key={String(it.id)} style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }]}>
          <View style={[styles.cardHeader, { flexDirection: 'row' }]}>
            <View style={[styles.infoWrapper, { alignItems: 'flex-start' }]}>
              <Text style={styles.name}>{it.name}</Text>
              <Text style={styles.meta}>
                {it.type === 'staff'
                  ? getLocalizedRole(it.role)
                  : `${t('classDisplay')}: ${it.classname || ''} • ${t('gradeLevel')}: ${it.classLevel || ''}`
                }
              </Text>
            </View>
            <View style={styles.giftIconWrapper}>
              <Ionicons name="gift" size={24} color={theme.iconColor} />
            </View>
          </View>

          <View style={[styles.dateRow, { flexDirection: 'row' }]}>
            <Ionicons name="calendar-outline" size={16} color="rgba(36, 54, 79, 0.6)" style={{ marginHorizontal: 4 }} />
            <Text style={styles.date}>{formatDateDDMMYYYY(it.birthdate)}</Text>
            <Text style={[styles.relative, { marginLeft: 8, marginRight: 0 }]}>
              ({it.relative})
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const getStyles = (theme, isDarkMode) => StyleSheet.create({
  container: { 
    padding: 16,
    backgroundColor: theme.background,
    flexGrow: 1,
  },
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  noDataText: {
    marginTop: 12,
    fontSize: 16,
    color: theme.text,
    fontWeight: 'bold',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  card: { 
    backgroundColor: theme.cardBackground, 
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 16, 
    padding: 16,
    marginBottom: 12, 
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
  cardHeader: {
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(47, 67, 96, 0.06)',
    paddingBottom: 8,
  },
  infoWrapper: {
    flex: 1,
  },
  giftIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(229, 169, 59, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { 
    fontSize: 17, 
    fontWeight: 'bold',
    color: theme.text,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  meta: { 
    color: theme.textMuted, 
    marginTop: 4,
    fontSize: 13,
  },
  dateRow: {
    marginTop: 10,
    alignItems: 'center',
  },
  date: { 
    color: theme.text,
    fontSize: 13,
    fontWeight: '600',
  },
  relative: { 
    fontWeight: '700', 
    color: '#2e7d32',
    fontSize: 13,
  },
  error: { color: '#c62828', fontWeight: 'bold' }
});
