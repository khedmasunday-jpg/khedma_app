import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform, TextInput, ScrollView } from 'react-native';
import axios from 'axios';
import { API_URL } from '../config/api';
import { logger } from '../utils/logger';
import { useLanguage } from '../utils/LanguageContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getAuthToken } from '../config/authSession';

import { useTheme } from '../utils/ThemeContext';
export default function EditStaffListScreen({ route, navigation }) {const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode);
  const { token: routeToken, role } = route.params || {};
  const token = routeToken || getAuthToken();
  const { t, locale } = useLanguage();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [selectedRole, setSelectedRole] = useState('All');
  const [selectedClass, setSelectedClass] = useState('All');

  const isRtl = locale === 'ar';
  const searchPlaceholder = isRtl ? 'بحث باسم الخادم...' : 'Search staff name...';

  const availableRoles = React.useMemo(() => {
    const roles = [...new Set(staff.map(s => s.role).filter(Boolean))];
    return ['All', ...roles];
  }, [staff]);

  const availableClasses = React.useMemo(() => {
    const classes = [...new Set(staff.map(s => s.assignedclass || s.classname).filter(Boolean))];
    return ['All', ...classes];
  }, [staff]);

  const filteredStaff = staff.filter(user => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch = !q || (user.fullName || '').toLowerCase().includes(q) || (user.username || '').toLowerCase().includes(q);
    const matchRole = selectedRole === 'All' || user.role === selectedRole;
    
    let matchClass = true;
    if (selectedRole === 'teacher' && selectedClass !== 'All') {
      matchClass = (user.assignedclass || user.classname) === selectedClass;
    }

    return matchSearch && matchRole && matchClass;
  });

  const fetchStaff = async () => {
    setLoading(true);
    try {
      let res;
      if (role === 'admin') {
        res = await axios.get(`${API_URL}/users/staff`, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        res = await axios.get(`${API_URL}/users/staff-safe`, { headers: { Authorization: `Bearer ${token}` } });
      }
      setStaff(res.data);
    } catch (err) {
      Alert.alert(t('error'), 'Failed to fetch staff');
    }
    setLoading(false);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchStaff);
    fetchStaff();
    return unsubscribe;
  }, [navigation]);

  const getLocalizedRole = (r) => {
    switch (r) {
      case 'admin': return t('roleAdmin');
      case 'principal': return t('rolePrincipal');
      case 'co-principal': return t('roleCoPrincipal');
      case 'teacher': return t('roleTeacher');
      default: return r;
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }]}
      onPress={() => navigation.navigate('EditStaffDetailScreen', { token, role, userId: item._id })}
    >
      <View style={[styles.cardHeader, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
        <View style={[styles.infoWrapper, { alignItems: isRtl ? 'flex-end' : 'flex-start' }]}>
          <Text style={styles.name}>{item.fullName}</Text>
          <Text style={styles.roleLabel}>{getLocalizedRole(item.role)}</Text>
        </View>
        <Ionicons 
          name={isRtl ? "chevron-back" : "chevron-forward"} 
          size={20} 
          color="rgba(47, 67, 96, 0.4)" 
        />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }, { backgroundColor: theme.background }]}>
      <View style={[styles.headerRow, { justifyContent: 'flex-end' }]}>
        <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity style={styles.iconButton} onPress={() => setShowSearch(!showSearch)}>
            <Ionicons name="search-outline" size={20} color={theme.iconColor} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => setShowFilter(!showFilter)}>
            <Ionicons name={showFilter ? "filter" : "filter-outline"} size={20} color={theme.iconColor} />
          </TouchableOpacity>
        </View>
      </View>

      {showFilter && (
        <View style={styles.filtersSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <Text style={styles.filterLabel}>{t('role') || (isRtl ? 'الرتبة' : 'Role')}</Text>
            {availableRoles.map(r => (
              <TouchableOpacity key={r} style={[styles.pill, selectedRole === r && styles.pillActive]} onPress={() => setSelectedRole(r)}>
                <Text style={[styles.pillText, selectedRole === r && styles.pillTextActive]}>
                  {r === 'All' ? (t('all') || (isRtl ? 'الكل' : 'All')) : getLocalizedRole(r)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {selectedRole === 'teacher' && (
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
          )}
        </View>
      )}

      {showSearch && (
        <View style={styles.searchContainer}>
        <View style={[styles.searchInputWrapper, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          <Ionicons name="search-outline" size={20} color={theme.iconColor} style={isRtl ? { marginLeft: 8 } : { marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { textAlign: isRtl ? 'right' : 'left' }]}
            placeholder={searchPlaceholder}
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={18} color={theme.iconColor} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      )}
      {loading ? (
        <ActivityIndicator size="large" color={theme.iconColor} style={{ marginTop: 20 }} />
      ) : filteredStaff.length === 0 ? (
        <Text style={styles.noStaffText}>No staff found.</Text>
      ) : (
        <FlatList
          data={filteredStaff}
          renderItem={renderItem}
          keyExtractor={item => item._id}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
        />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconButton: {
    backgroundColor: 'rgba(47, 67, 96, 0.06)',
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.borderColor,
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
    borderColor: theme.borderColor,
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
    color: theme.textMuted,
    marginTop: 20,
    fontSize: 15,
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoWrapper: {
    flex: 1,
  },
  name: { 
    fontSize: 17, 
    fontWeight: 'bold',
    color: theme.text,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  roleLabel: { 
    fontSize: 13, 
    color: '#2e7d32', 
    marginTop: 6,
    fontWeight: '600',
  },
  filtersSection: { paddingBottom: 10, borderBottomWidth: 1, borderColor: theme.borderColor, marginBottom: 16 },
  filterScroll: { flexDirection: 'row', marginBottom: 12 },
  filterLabel: { color: theme.text, fontWeight: 'bold', alignSelf: 'center', marginRight: 10, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  pill: { backgroundColor: theme.cardBackground, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: theme.borderColor },
  pillActive: { backgroundColor: theme.primary, borderColor: '#2f4360' },
  pillText: { color: theme.text, fontWeight: '600' },
  pillTextActive: { color: '#fff' },
});