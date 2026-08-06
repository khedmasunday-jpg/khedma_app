import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  ActivityIndicator, 
  TouchableOpacity, 
  TextInput, 
  Modal, 
  Platform 
} from 'react-native';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../utils/LanguageContext';
import { logger } from '../utils/logger';
import { API_URL } from '../config/api';
import { getAuthToken } from '../config/authSession';
import SkeletonList from '../components/SkeletonLoader';
import { fetchWithCache, invalidateCache } from '../utils/apiCache';

import { useTheme } from '../utils/ThemeContext';
export default function ActivateDeactivateScreen({ route, navigation }) {
  const { theme, isDarkMode } = useTheme();
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

  const [customAlertVisible, setCustomAlertVisible] = useState(false);
  const [customAlertTitle, setCustomAlertTitle] = useState('');
  const [customAlertMessage, setCustomAlertMessage] = useState('');

  const isRtl = locale === 'ar';
  const titleText = isRtl ? 'تفعيل / تعطيل حسابات الخدام' : 'Activate / Deactivate Staff';
  const activeLabel = isRtl ? 'نشط' : 'Active';
  const inactiveLabel = isRtl ? 'غير نشط' : 'Inactive';
  const activateBtn = isRtl ? 'تفعيل' : 'Activate';
  const deactivateBtn = isRtl ? 'تعطيل' : 'Deactivate';
  const searchPlaceholder = isRtl ? 'بحث باسم الخادم...' : 'Search staff name...';
  const noStaffText = isRtl ? 'لا يوجد خدام تطابق البحث' : 'No staff match your search';
  const successTitle = isRtl ? 'تم بنجاح' : 'Success';
  const errorTitle = isRtl ? 'خطأ' : 'Error';

  const showAlert = (title, message) => {
    setCustomAlertTitle(title);
    setCustomAlertMessage(message || '');
    setCustomAlertVisible(true);
  };

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const endpoint = role === 'admin' ? '/users/staff' : '/users/staff-safe';
      const url = `${API_URL}${endpoint}`;
      const data = await fetchWithCache(url, { headers: { Authorization: token } });
      setStaff(data);
    } catch (err) {
      showAlert(errorTitle, isRtl ? 'فشل تحميل بيانات الخدام' : 'Failed to fetch staff data');
    }
    setLoading(false);
  };

  const updateStatus = async (userId, active) => {
    
    const previousStaff = [...staff];

    setStaff(prev => prev.map(u => u._id === userId ? { ...u, isActive: active } : u));

    try {
      const endpoint = `${API_URL}/users/${userId}/${active ? 'activate' : 'deactivate'}`;
      await axios.patch(endpoint, {}, { headers: { Authorization: token } });
      invalidateCache('users/staff');

      const userObj = previousStaff.find(u => u._id === userId);
      const name = userObj ? userObj.fullName : '';
      let successMsg = isRtl
        ? (active ? `تم تفعيل حساب الخادم ${name} بنجاح` : `تم تعطيل حساب الخادم ${name} بنجاح`)
        : `User ${name} was successfully ${active ? 'activated' : 'deactivated'}.`;
      
      showAlert(successTitle, successMsg);
    } catch (err) {
      
      setStaff(previousStaff);
      let errMsg = isRtl
        ? (active ? 'فشل تفعيل حساب الخادم' : 'فشل تعطيل حساب الخادم')
        : `Failed to ${active ? 'activate' : 'deactivate'} user account.`;
      showAlert(errorTitle, errMsg);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const getRoleName = (roleVal) => {
    switch (roleVal) {
      case 'principal': return isRtl ? 'أمين الخدمة' : 'Principal';
      case 'co-principal': return isRtl ? 'أمين مرحلة' : 'Year Leader';
      case 'teacher': return isRtl ? 'خادم فصل' : 'Teacher';
      default: return roleVal;
    }
  };

  const getRoleIcon = (roleVal) => {
    switch (roleVal) {
      case 'principal': return 'ribbon-outline';
      case 'co-principal': return 'school-outline';
      case 'teacher': return 'person-outline';
      default: return 'person-circle-outline';
    }
  };

  const getRoleColor = (roleVal) => {
    switch (roleVal) {
      case 'principal': return '#b8860b'; 
      case 'co-principal': return '#8a2be2'; 
      case 'teacher': return '#137333'; 
      default: return '#2f4360';
    }
  };

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
                  {r === 'All' ? (t('all') || (isRtl ? 'الكل' : 'All')) : getRoleName(r)}
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
          <Ionicons name="search-outline" size={20} color="#666" style={isRtl ? { marginLeft: 8 } : { marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { textAlign: isRtl ? 'right' : 'left' }]}
            placeholder={searchPlaceholder}
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={18} color="#999" />
            </TouchableOpacity>
          ) : null}
          </View>
        </View>
      )}

      {}
      <ScrollView contentContainerStyle={styles.listContainer}>
        {loading ? (
          <SkeletonList count={6} />
        ) : filteredStaff.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={60} color="#ccc" />
            <Text style={[styles.emptyText, { color: theme.textMuted }, { color: theme.textMuted }]}>{noStaffText}</Text>
          </View>
        ) : (
          filteredStaff.map(user => (
            <View key={user._id} style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
              {}
              <View style={isRtl ? { marginLeft: 12 } : { marginRight: 12 }}>
                <View style={[styles.avatarCircle, { backgroundColor: getRoleColor(user.role) + '15' }]}>
                  <Ionicons name={getRoleIcon(user.role)} size={22} color={getRoleColor(user.role)} />
                </View>
              </View>

              {}
              <View style={styles.cardMiddle}>
                <Text style={[styles.nameText, { color: theme.text }, { textAlign: isRtl ? 'right' : 'left' }]}>
                  {user.fullName}
                </Text>
                <View style={[styles.badgeRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                  <View style={[styles.roleBadge, { backgroundColor: getRoleColor(user.role) + '15' }]}>
                    <Text style={[styles.roleBadgeText, { color: getRoleColor(user.role) }]}>
                      {getRoleName(user.role)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, user.isActive ? styles.statusBadgeActive : styles.statusBadgeInactive]}>
                    <Text style={[styles.statusBadgeText, user.isActive ? styles.statusTextActive : styles.statusTextInactive]}>
                      {user.isActive ? activeLabel : inactiveLabel}
                    </Text>
                  </View>
                </View>
              </View>

              {}
              <View style={isRtl ? { marginRight: 8 } : { marginLeft: 8 }}>
                {(user.role !== 'principal' || role === 'admin') && (
                  <TouchableOpacity 
                    style={[styles.toggleBtn, user.isActive ? styles.toggleBtnDeactivate : styles.toggleBtnActivate]} 
                    onPress={() => updateStatus(user._id, !user.isActive)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={user.isActive ? "close-circle-outline" : "checkmark-circle-outline"} 
                      size={16} 
                      color="#fff" 
                      style={isRtl ? { marginLeft: 4 } : { marginRight: 4 }} 
                    />
                    <Text style={styles.toggleBtnText}>
                      {user.isActive ? deactivateBtn : activateBtn}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {}
      <Modal visible={customAlertVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }, { backgroundColor: theme.cardBackground }]}>
            <View style={[styles.modalHeader, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
              <Ionicons 
                name={customAlertTitle === successTitle ? 'checkmark-circle-outline' : 'information-circle-outline'} 
                size={24} 
                color={customAlertTitle === successTitle ? '#137333' : '#2f4360'} 
              />
              <Text style={[styles.modalTitle, { color: theme.text }, isRtl ? { marginRight: 8 } : { marginLeft: 8 }]}>
                {customAlertTitle}
              </Text>
            </View>
            <View style={styles.modalBody}>
              <Text style={[styles.modalBodyText, { color: theme.text }, { textAlign: isRtl ? 'right' : 'left' }]}>
                {customAlertMessage}
              </Text>
            </View>
            <View style={[styles.modalFooter, { justifyContent: isRtl ? 'flex-start' : 'flex-end' }]}>
              <TouchableOpacity 
                style={styles.modalPrimaryBtn} 
                onPress={() => setCustomAlertVisible(false)}
              >
                <Text style={styles.modalPrimaryBtnText}>{isRtl ? 'حسناً' : 'OK'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3ede0',
    padding: 16,
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
    borderColor: 'rgba(47, 67, 96, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2f4360',
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInputWrapper: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 252, 246, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    paddingVertical: 8,
  },
  clearButton: {
    padding: 4,
  },
  listContainer: {
    padding: 16,
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }
    })
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMiddle: {
    flex: 1,
    justifyContent: 'center',
  },
  nameText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2f4360',
    marginBottom: 4,
  },
  badgeRow: {
    alignItems: 'center',
    gap: 6,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeActive: {
    backgroundColor: '#e6f4ea',
  },
  statusBadgeInactive: {
    backgroundColor: '#fce8e6',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusTextActive: {
    color: '#137333',
  },
  statusTextInactive: {
    color: '#c5221f',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 95,
  },
  toggleBtnActivate: {
    backgroundColor: '#137333',
  },
  toggleBtnDeactivate: {
    backgroundColor: '#c5221f',
  },
  toggleBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    color: '#999',
    marginTop: 10,
  },
  loader: {
    marginTop: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
      }
    })
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#2f4360',
  },
  modalBody: {
    marginVertical: 14,
  },
  modalBodyText: {
    fontSize: 15,
    color: '#333333',
    lineHeight: 22,
  },
  modalFooter: {
    flexDirection: 'row',
  },
  modalPrimaryBtn: {
    backgroundColor: '#2f4360',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  modalPrimaryBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  filtersSection: { paddingHorizontal: 15, paddingBottom: 10, borderBottomWidth: 1, borderColor: 'rgba(47,67,96,0.05)' },
  filterScroll: { flexDirection: 'row', marginBottom: 12 },
  filterLabel: { color: '#2f4360', fontWeight: 'bold', alignSelf: 'center', marginRight: 10, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  pill: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: 'rgba(47,67,96,0.1)' },
  pillActive: { backgroundColor: '#2f4360', borderColor: '#2f4360' },
  pillText: { color: '#2f4360', fontWeight: '600' },
  pillTextActive: { color: '#fff' },
});
