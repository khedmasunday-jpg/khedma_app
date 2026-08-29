import React, { useEffect, useState } from 'react';
import { View, Text, Button, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Platform, StyleSheet } from 'react-native';
import axios from 'axios';
import { getAuthToken } from '../config/authSession';
import { createApiClient } from '../config/api';
import { logger } from '../utils/logger';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLanguage } from '../utils/LanguageContext';

import { useTheme } from '../utils/ThemeContext';

export default function AssignStudentsScreen1({ navigation, route }) {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode);
  const { token: routeToken } = route.params || {};
  const token = routeToken || getAuthToken();
  const { t, locale } = useLanguage();
  
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [selectedClass, setSelectedClass] = useState('All');

  const isRtl = locale === 'ar';
  const searchPlaceholder = isRtl ? 'بحث باسم الخادم...' : 'Search teacher name...';

  useEffect(() => {
    let mounted = true;
    logger.log('Token in AssignStudentsScreen1:', token);
    const client = createApiClient(token);

    client.get('/auth/me')
      .then(userRes => {
        if (!mounted) return;
        logger.log('Auth /me response:', userRes.data);
      })
      .catch(err => {
        logger.warn('/auth/me failed:', err?.response?.data || err.message || err);
      })
      .finally(() => {
        client.get('/classes/co-principal/teachers')
          .then(res => {
            if (!mounted) return;
            logger.log('Raw API response:', res.data);
            
            try {
              if (typeof atob !== 'undefined') {
                const payload = JSON.parse(atob(token.split('.')[1]));
                logger.log('User role from token:', payload.role);
                logger.log('User assignedlevel from token:', payload.assignedlevel);
              } else {
                logger.log('Token payload decode not available in this environment');
              }
            } catch (e) {
              logger.log('Token decode failed:', e?.message || e);
            }
            setTeachers(Array.isArray(res.data) ? res.data : []);
          })
          .catch((err) => {
            logger.error('Failed to fetch teachers:', err?.response || err);
            const msg = err?.response?.data?.msg || err?.message || 'Failed to fetch teachers';
            Alert.alert('Error', msg);
          })
          .finally(() => {
            if (mounted) setLoading(false);
          });
      });

    return () => { mounted = false; };
  }, [token]);

  const availableClasses = React.useMemo(() => {
    const classes = [...new Set(teachers.map(s => s.assignedClass || s.assignedclass || s.classname).filter(Boolean))];
    return ['All', ...classes];
  }, [teachers]);

  const filteredTeachers = teachers.filter(user => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch = !q || (user.fullName || '').toLowerCase().includes(q) || (user.username || '').toLowerCase().includes(q);
    
    let matchClass = true;
    if (selectedClass !== 'All') {
      matchClass = (user.assignedClass || user.assignedclass || user.classname) === selectedClass;
    }

    return matchSearch && matchClass;
  });

  return (
    <View style={styles.container}>
      <View style={[styles.headerRow, { justifyContent: 'flex-end' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity style={styles.iconButton} onPress={() => setShowSearch(!showSearch)}>
            <Ionicons name="search-outline" size={20} color={theme.iconColor || theme.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => setShowFilter(!showFilter)}>
            <Ionicons name={showFilter ? "filter" : "filter-outline"} size={20} color={theme.iconColor || theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {showFilter && (
        <View style={styles.filtersSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <Text style={styles.filterLabel}>{t('classFilter') || (isRtl ? 'الفصل:' : 'Class:')}</Text>
            {availableClasses.map(cls => (
              <TouchableOpacity key={cls} style={[styles.pill, selectedClass === cls && styles.pillActive]} onPress={() => setSelectedClass(cls)}>
                <Text style={[styles.pillText, selectedClass === cls && styles.pillTextActive]}>
                  {cls === 'All' ? (t('all') || (isRtl ? 'الكل' : 'All')) : cls}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {showSearch && (
        <View style={styles.searchContainer}>
          <View style={[styles.searchInputWrapper, { flexDirection: 'row' }]}>
            <Ionicons name="search-outline" size={20} color={theme.iconColor || theme.text} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { textAlign: 'left' }]}
              placeholder={searchPlaceholder}
              placeholderTextColor={theme.textMuted || '#999'}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Ionicons name="close-circle" size={18} color={theme.iconColor || theme.text} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop: 20 }} color={theme.text} />
      ) : teachers.length === 0 ? (
        <View style={{ alignItems: 'center', marginTop: 20 }}>
          <Text style={{ color: theme.text, marginBottom: 10 }}>No teachers found in your assigned level</Text>
          <Button title="Retry" onPress={() => {
            setLoading(true);
            const client = createApiClient(token);
            client.get('/classes/co-principal/teachers')
              .then(res => {
                logger.log('Teachers response:', res.data);
                setTeachers(Array.isArray(res.data) ? res.data : []);
              })
              .catch((err) => {
                logger.error('Failed to fetch teachers:', err?.response || err);
                const msg = err?.response?.data?.msg || err?.message || 'Failed to fetch teachers';
                Alert.alert('Error', msg);
              })
              .finally(() => setLoading(false));
          }} />
        </View>
      ) : filteredTeachers.length === 0 ? (
        <Text style={styles.noStaffText}>{isRtl ? 'لا يوجد معلمين مطابقين للبحث' : 'No teachers found.'}</Text>
      ) : (
        <ScrollView>
          {filteredTeachers.map(teacher => (
            <TouchableOpacity
              key={teacher._id}
              style={[styles.card, { backgroundColor: theme.cardBackground }]}
              onPress={() => navigation.navigate('AssignStudentsScreen2', { token, teacher })}
            >
              <Text style={{ fontSize: 16, color: theme.text, fontWeight: 'bold' }}>{teacher.fullName}</Text>
              {teacher.assignedClass && (
                <Text style={{ color: theme.text, opacity: 0.7, marginTop: 4, fontSize: 14 }}>
                  Class: {teacher.assignedClass}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const getStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: theme.background
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconButton: {
    backgroundColor: 'rgba(47, 67, 96, 0.06)',
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.borderColor || '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInputWrapper: {
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.borderColor || '#ccc',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: theme.text,
    paddingVertical: 8,
  },
  clearButton: {
    padding: 4,
  },
  noStaffText: {
    textAlign: 'center',
    color: theme.textMuted || '#666',
    marginTop: 20,
    fontSize: 15,
  },
  filtersSection: {
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: theme.borderColor || '#ccc',
    marginBottom: 16
  },
  filterScroll: {
    flexDirection: 'row',
    marginBottom: 12
  },
  filterLabel: {
    color: theme.text,
    fontWeight: 'bold',
    alignSelf: 'center',
    marginRight: 10,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' })
  },
  pill: {
    backgroundColor: theme.cardBackground,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.borderColor || '#ccc'
  },
  pillActive: {
    backgroundColor: theme.primary || '#007AFF',
    borderColor: '#2f4360'
  },
  pillText: {
    color: theme.text,
    fontWeight: '600'
  },
  pillTextActive: {
    color: '#fff'
  },
  card: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.borderColor || '#ccc',
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
  }
});
