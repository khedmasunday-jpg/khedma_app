import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  ActivityIndicator, 
  Alert, 
  TextInput, 
  TouchableOpacity, 
  Platform 
} from 'react-native';
import axios from 'axios';
import { API_URL } from '../config/api';
import { logger } from '../utils/logger';
import { useLanguage } from '../utils/LanguageContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getAuthToken } from '../config/authSession';

export default function LogsScreen({ route }) {
  const { token: routeToken } = route.params || {};
  const token = routeToken || getAuthToken();
  const { t, locale } = useLanguage();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTimeFilter, setSelectedTimeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLive, setIsLive] = useState(true);

  const timeFilters = [
    { id: 'all', labelKey: 'timeAll' },
    { id: 'week', labelKey: 'timeWeek' },
    { id: '2weeks', labelKey: 'time2Weeks' },
    { id: 'month', labelKey: 'timeMonth' },
    { id: 'year', labelKey: 'timeYear' },
    { id: 'custom', labelKey: 'timeCustom' },
  ];

  const isRtl = locale === 'ar';

  const fetchLogs = (pageNum = 1, silent = false) => {
    if (!silent && pageNum === 1) setLoading(true);
    const endpoint = `${API_URL}/users/logs/all?page=${pageNum}&limit=50`;

    axios.get(endpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
      .then(res => {
        let logsData = [];
        let fetchedHasMore = false;
        
        if (Array.isArray(res.data)) {
          logsData = res.data;
          fetchedHasMore = logsData.length === 50;
        } else if (res.data.logs && Array.isArray(res.data.logs)) {
          logsData = res.data.logs;
          fetchedHasMore = res.data.pagination ? res.data.pagination.hasMore : (logsData.length === 50);
        } else {
          logger.error('Invalid logs format:', res.data);
          Alert.alert('Error', 'Invalid logs data format');
        }

        if (pageNum === 1) {
          setLogs(logsData);
        } else {
          setLogs(prev => {
            const existingIds = new Set(prev.map(l => l._id || JSON.stringify(l)));
            const newItems = logsData.filter(l => !existingIds.has(l._id || JSON.stringify(l)));
            return [...prev, ...newItems];
          });
        }
        setHasMore(fetchedHasMore);
      })
      .catch((err) => {
        logger.error('Failed to fetch logs:', err);
        if (pageNum === 1) setLogs([]);
      })
      .finally(() => {
        if (!silent && pageNum === 1) setLoading(false);
      });
  };

  useEffect(() => {
    fetchLogs(page);
  }, [page]);

  useEffect(() => {
    let interval;
    if (isLive) {
      interval = setInterval(() => {
        if (page === 1) {
          fetchLogs(1, true);
        }
      }, 5000); 
    }
    return () => clearInterval(interval);
  }, [isLive, page]);

  const getLogCategory = (log) => {
    const action = (log.action || '').toLowerCase();
    const desc = (log.actionDescription || '').toLowerCase();

    if (action.includes('login') || desc.includes('login')) {
      return 'login';
    }
    
    if (
      action.includes('attendance') || 
      action.includes('assignment') || 
      desc.includes('attendance') ||
      desc.includes('assignment')
    ) {
      return 'attendance';
    }
    
    if (
      action.includes('user') || 
      action.includes('student') || 
      action.includes('staff') ||
      action.includes('teacher') ||
      desc.includes('user') || 
      desc.includes('student') || 
      desc.includes('staff') ||
      desc.includes('teacher')
    ) {
      return 'user';
    }
    
    return 'other';
  };

  const counts = {
    all: logs.length,
    login: logs.filter(l => getLogCategory(l) === 'login').length,
    attendance: logs.filter(l => getLogCategory(l) === 'attendance').length,
    user: logs.filter(l => getLogCategory(l) === 'user').length,
    other: logs.filter(l => getLogCategory(l) === 'other').length,
  };

  const getCategoryMeta = (category) => {
    switch (category) {
      case 'login':
        return {
          icon: 'log-in-outline',
          bg: 'rgba(0, 123, 255, 0.1)',
          color: '#007bff'
        };
      case 'attendance':
        return {
          icon: 'calendar-outline',
          bg: 'rgba(40, 167, 69, 0.1)',
          color: '#28a745'
        };
      case 'user':
        return {
          icon: 'person-add-outline',
          bg: 'rgba(111, 66, 193, 0.1)',
          color: '#6f42c1'
        };
      default:
        return {
          icon: 'settings-outline',
          bg: 'rgba(253, 126, 20, 0.1)',
          color: '#fd7e14'
        };
    }
  };

  const formatLogTimestamp = (dateInput) => {
    if (!dateInput) return '';
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return '';
      
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; 
      const strTime = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
      
      return `${day}/${month}/${year}, ${strTime}`;
    } catch (e) {
      return '';
    }
  };

  const translateAction = (action, isAr) => {
    if (!action) return '';
    if (!isAr) return action;
    const lower = action.toLowerCase();
    if (lower.includes('user login')) return 'تسجيل دخول';
    if (lower.includes('failed login')) return 'فشل تسجيل الدخول';
    if (lower.includes('added user') || lower.includes('create user')) return 'إضافة مستخدم';
    if (lower.includes('added student')) return 'إضافة مخدوم';
    if (lower.includes('added staff')) return 'إضافة خادم';
    if (lower.includes('deleted student')) return 'حذف مخدوم';
    if (lower.includes('deleted staff')) return 'حذف خادم';
    if (lower.includes('take_attendance') || lower.includes('take attendance')) return 'تسجيل الحضور';
    if (lower.includes('reset attendance')) return 'إعادة ضبط الحضور';
    if (lower.includes('changeassignment') || lower.includes('change assignment')) return 'تغيير تكليف';
    if (lower.includes('promoted teacher') || lower.includes('promote teacher')) return 'ترقية خادم';
    if (lower.includes('assigned students')) return 'توزيع المخدومين';
    if (lower.includes('exportgraduates')) return 'تصدير الخريجين';
    if (lower.includes('deletegraduates')) return 'حذف الخريجين';
    if (lower.includes('editstudentdata') || lower.includes('edit student')) return 'تعديل بيانات مخدوم';
    if (lower.includes('editstaffdata') || lower.includes('edit staff')) return 'تعديل بيانات خادم';
    if (lower.includes('updatestudentpassword')) return 'تحديث كلمة مرور مخدوم';
    if (lower.includes('updatestaffpassword')) return 'تحديث كلمة مرور خادم';
    return action;
  };

  const getLocalizedRole = (r) => {
    if (!r) return '';
    switch (r.toLowerCase()) {
      case 'admin': return t('roleAdmin');
      case 'principal': return t('rolePrincipal');
      case 'co-principal': return t('roleCoPrincipal');
      case 'teacher': return t('roleTeacher');
      default: return r;
    }
  };

  const filterPills = [
    { id: 'all', labelKey: 'filterAll', icon: 'list-outline' },
    { id: 'login', labelKey: 'filterLogins', icon: 'log-in-outline' },
    { id: 'attendance', labelKey: 'filterAttendance', icon: 'checkbox-outline' },
    { id: 'user', labelKey: 'filterUsers', icon: 'people-outline' },
    { id: 'other', labelKey: 'filterOthers', icon: 'ellipsis-horizontal-outline' },
  ];

  const matchesTimeFilter = (log) => {
    if (selectedTimeFilter === 'all') return true;
    const logDate = new Date(log.timestamp);
    if (isNaN(logDate.getTime())) return false;
    
    const now = new Date();
    if (selectedTimeFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return logDate >= weekAgo;
    }
    if (selectedTimeFilter === '2weeks') {
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      return logDate >= twoWeeksAgo;
    }
    if (selectedTimeFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return logDate >= monthAgo;
    }
    if (selectedTimeFilter === 'year') {
      const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      return logDate >= yearAgo;
    }
    if (selectedTimeFilter === 'custom') {
      let isAfterStart = true;
      let isBeforeEnd = true;
      if (startDate) {
        const start = new Date(startDate + 'T00:00:00');
        isAfterStart = isNaN(start.getTime()) || logDate >= start;
      }
      if (endDate) {
        const end = new Date(endDate + 'T23:59:59');
        isBeforeEnd = isNaN(end.getTime()) || logDate <= end;
      }
      return isAfterStart && isBeforeEnd;
    }
    return true;
  };

  const filteredLogs = logs.filter(log => {
    const cat = getLogCategory(log);
    const matchesFilter = selectedFilter === 'all' || cat === selectedFilter;
    
    if (!matchesFilter) return false;
    if (!matchesTimeFilter(log)) return false;
    
    if (!searchQuery) return true;
    
    const q = searchQuery.toLowerCase();
    const action = (log.action || '').toLowerCase();
    const desc = (log.actionDescription || '').toLowerCase();

    const performerName = log.performedByName || log.actorName || (log.performedBy && (log.performedBy.fullName || log.performedBy.username)) || 'Unknown';
    const performerRole = log.performedByRole || log.actorRole || (log.performedBy && log.performedBy.role) || 'Unknown';
    const perfName = performerName.toLowerCase();
    const perfRole = performerRole.toLowerCase();

  const filteredLogs = logs.filter(l => {
    if (selectedFilter !== 'all' && getLogCategory(l) !== selectedFilter) return false;
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const a = (l.action || '').toLowerCase();
      const d = (l.actionDescription || '').toLowerCase();
      const det = (l.details || '').toLowerCase();
      
      const pn = (l.performedByName || l.actorName || '').toLowerCase();
      const tn = (l.targetClassName || l.targetUserName || '').toLowerCase();
      
      if (!a.includes(q) && !d.includes(q) && !det.includes(q) && !pn.includes(q) && !tn.includes(q)) {
        return false;
      }
    }

    if (!matchesTimeFilter(l)) return false;

    return true;
  });

  const handleScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 50;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
      if (hasMore && !loading) {
        setPage(prev => prev + 1);
      }
    }
  };

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {}
      <View style={[styles.headerContainer, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
        <Text style={styles.title}>{t('logs')}</Text>
        <TouchableOpacity 
          style={[styles.liveBtn, isLive ? styles.liveBtnActive : styles.liveBtnInactive, { flexDirection: isRtl ? 'row-reverse' : 'row' }]} 
          onPress={() => setIsLive(!isLive)}
        >
          <View style={[styles.liveDot, isLive ? styles.liveDotActive : styles.liveDotInactive, isRtl ? { marginLeft: 6 } : { marginRight: 6 }]} />
          <Text style={[styles.liveBtnText, isLive ? styles.liveBtnTextActive : styles.liveBtnTextInactive]}>
            {isRtl ? 'تحديث مباشر' : 'Live Update'}
          </Text>
        </TouchableOpacity>
      </View>

      {}
      <View style={[styles.searchContainer, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
        <Ionicons name="search-outline" size={20} color="#2f4360" style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { textAlign: isRtl ? 'right' : 'left' }]}
          placeholder={t('search')}
          placeholderTextColor="rgba(47, 67, 96, 0.5)"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
            <Ionicons name="close-circle" size={18} color="rgba(47, 67, 96, 0.4)" />
          </TouchableOpacity>
        )}
      </View>

      {}
      <View style={[styles.filterContainer, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
        {filterPills.map((pill) => {
          const isActive = selectedFilter === pill.id;
          const count = counts[pill.id] || 0;
          return (
            <TouchableOpacity
              key={pill.id}
              onPress={() => setSelectedFilter(pill.id)}
              style={[
                styles.filterPill,
                isActive ? styles.filterPillActive : styles.filterPillInactive,
                { flexDirection: isRtl ? 'row-reverse' : 'row' }
              ]}
            >
              <Ionicons 
                name={pill.icon} 
                size={16} 
                color={isActive ? '#fff' : '#2f4360'} 
                style={isRtl ? { marginLeft: 6 } : { marginRight: 6 }} 
              />
              <Text style={[styles.filterPillText, isActive ? styles.filterPillTextActive : styles.filterPillTextInactive]}>
                {t(pill.labelKey)} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {}
      <View style={[styles.filterContainer, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
        {timeFilters.map((tFilter) => {
          const isActive = selectedTimeFilter === tFilter.id;
          return (
            <TouchableOpacity
              key={tFilter.id}
              onPress={() => setSelectedTimeFilter(tFilter.id)}
              style={[
                styles.filterPill,
                isActive ? styles.filterPillActive : styles.filterPillInactive,
                { flexDirection: isRtl ? 'row-reverse' : 'row' }
              ]}
            >
              <Ionicons 
                name={tFilter.id === 'custom' ? 'calendar-outline' : 'time-outline'} 
                size={16} 
                color={isActive ? '#fff' : '#2f4360'} 
                style={isRtl ? { marginLeft: 6 } : { marginRight: 6 }} 
              />
              <Text style={[styles.filterPillText, isActive ? styles.filterPillTextActive : styles.filterPillTextInactive]}>
                {t(tFilter.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* amount filters removed */}

      {}
      {selectedTimeFilter === 'custom' && (
        <View style={[styles.customDateContainer, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          <View style={[styles.customDateWrapper, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
            <Text style={styles.customDateLabel}>{isRtl ? 'من:' : 'From:'}</Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={styles.customDateInput}
              />
            ) : (
              <TextInput
                placeholder="YYYY-MM-DD"
                placeholderTextColor="rgba(47, 67, 96, 0.4)"
                value={startDate}
                onChangeText={setStartDate}
                style={{ color: '#2f4360', fontSize: 13, minWidth: 80, padding: 0 }}
              />
            )}
          </View>
          <View style={[styles.customDateWrapper, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
            <Text style={styles.customDateLabel}>{isRtl ? 'إلى:' : 'To:'}</Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={styles.customDateInput}
              />
            ) : (
              <TextInput
                placeholder="YYYY-MM-DD"
                placeholderTextColor="rgba(47, 67, 96, 0.4)"
                value={endDate}
                onChangeText={setEndDate}
                style={{ color: '#2f4360', fontSize: 13, minWidth: 80, padding: 0 }}
              />
            )}
          </View>
          {(startDate || endDate) && (
            <TouchableOpacity 
              style={styles.clearCustomBtn} 
              onPress={() => { setStartDate(''); setEndDate(''); }}
            >
              <Ionicons name="trash-outline" size={16} color="#d9534f" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {}
      <View style={styles.box}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#2f4360" />
          </View>
        ) : filteredLogs.length === 0           <View>
            {filteredLogs.map((log, idx) => {
              const category = getLogCategory(log);
              const meta = getCategoryMeta(category);

              const performerName = log.performedByName || log.actorName || (log.performedBy && (log.performedBy.fullName || log.performedBy.username)) || 'Unknown';
              const performerRole = log.performedByRole || log.actorRole || (log.performedBy && log.performedBy.role) || 'Unknown';

              const ip = log.ip || log.ipAddress || log.clientIp || log.requestIp || log.remoteAddr || log.actorIp || null;

              return (
                <View key={idx} style={[styles.logCard, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                  {}
                  <View style={[styles.badgeContainer, { backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon} size={22} color={meta.color} />
                  </View>

                  {}
                  <View style={[styles.cardContent, { alignItems: isRtl ? 'flex-end' : 'flex-start' }]}>
                    {}
                    <Text style={styles.actionTitle}>
                      {translateAction(log.actionDescription || log.action, isRtl)}
                    </Text>

                    {}
                    <Text style={styles.performer}>
                      <Text style={styles.label}>{t('performedByLabel')}</Text>
                      {performerName} ({getLocalizedRole(performerRole)})
                    </Text>

                    {}
                    {(log.targetClassName || log.targetUserName || log.targetUser) ? (
                      <Text style={styles.target}>
                        <Text style={styles.label}>
                          {log.targetClassName ? t('classLabel') : t('targetLabel')}
                        </Text>
                        {log.targetClassName 
                          ? log.targetClassName 
                          : `${log.targetUserName || (log.targetUser && (log.targetUser.fullName || log.targetUser.username)) || 'N/A'}`}
                        {log.targetUserRole ? ` (${getLocalizedRole(log.targetUserRole)})` : ''}
                      </Text>
                    ) : null}

                    {}
                    {log.details ? (
                      <View style={[styles.detailsBox, { alignSelf: 'stretch' }]}>
                        <Text style={[styles.detailsText, { textAlign: isRtl ? 'right' : 'left' }]}>
                          {log.details}
                        </Text>
                      </View>
                    ) : null}

                    {}
                    <View style={[styles.cardFooter, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                      <View style={[styles.footerItem, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                        <Ionicons name="time-outline" size={13} color="rgba(47, 67, 96, 0.5)" style={{ marginHorizontal: 2 }} />
                        <Text style={styles.footerText}>{formatLogTimestamp(log.timestamp)}</Text>
                      </View>
                      {ip ? (
                        <View style={[styles.footerItem, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                          <Ionicons name="globe-outline" size={13} color="rgba(47, 67, 96, 0.5)" style={{ marginHorizontal: 2 }} />
                          <Text style={styles.footerText}>{ip}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })}
            {hasMore && (
              <View style={{ padding: 16, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#2f4360" />
              </View>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: 'transparent' 
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  title: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    marginBottom: 16, 
    textAlign: 'center',
    color: '#2f4360',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  searchContainer: {
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 252, 246, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.12)',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#24364f',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0 2px 4px rgba(36, 54, 79, 0.03)',
      }
    }),
  },
  searchIcon: {
    opacity: 0.8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: '#2f4360',
    paddingHorizontal: 8,
  },
  clearSearchButton: {
    padding: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 12,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 4,
    marginVertical: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#24364f',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 1.5,
      },
      web: {
        boxShadow: '0 2px 3px rgba(36, 54, 79, 0.03)',
      }
    }),
  },
  filterPillActive: {
    backgroundColor: '#2f4360',
    borderColor: '#2f4360',
  },
  filterPillInactive: {
    backgroundColor: 'rgba(255, 252, 246, 0.95)',
    borderColor: 'rgba(47, 67, 96, 0.15)',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  filterPillTextActive: {
    color: '#fff',
  },
  filterPillTextInactive: {
    color: '#2f4360',
  },
  box: { 
    backgroundColor: 'rgba(255, 252, 246, 0.95)', 
    borderRadius: 18, 
    padding: 14, 
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.12)',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#24364f',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 4px 6px rgba(36, 54, 79, 0.05)',
      }
    }),
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  noLogsText: {
    marginTop: 10,
    fontSize: 15,
    color: 'rgba(47, 67, 96, 0.6)',
    fontWeight: '500',
  },
  logCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.08)',
    padding: 12,
    marginBottom: 10,
    alignItems: 'flex-start',
    ...Platform.select({
      ios: {
        shadowColor: '#24364f',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0 2px 3px rgba(36, 54, 79, 0.02)',
      }
    }),
  },
  badgeContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: 4,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2f4360',
    marginBottom: 4,
  },
  performer: {
    fontSize: 13,
    color: 'rgba(47, 67, 96, 0.8)',
    marginBottom: 2,
  },
  target: {
    fontSize: 13,
    color: '#2e7d32',
    marginBottom: 2,
  },
  label: {
    fontWeight: '600',
    color: '#2f4360',
  },
  detailsBox: {
    backgroundColor: 'rgba(243, 237, 224, 0.35)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.06)',
    padding: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  detailsText: {
    fontSize: 12.5,
    color: '#555',
    lineHeight: 16,
  },
  cardFooter: {
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(47, 67, 96, 0.05)',
    paddingTop: 6,
  },
  footerItem: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11.5,
    color: 'rgba(47, 67, 96, 0.55)',
  },
  customDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 8,
    alignSelf: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  customDateWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 252, 246, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  customDateLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2f4360',
  },
  customDateInput: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontSize: 13,
    color: '#2f4360',
    outlineStyle: 'none',
    cursor: 'pointer',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  clearCustomBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(217, 83, 79, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(217, 83, 79, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContainer: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  liveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  liveBtnActive: {
    backgroundColor: 'rgba(40, 167, 69, 0.1)',
    borderColor: 'rgba(40, 167, 69, 0.3)',
  },
  liveBtnInactive: {
    backgroundColor: 'rgba(47, 67, 96, 0.05)',
    borderColor: 'rgba(47, 67, 96, 0.1)',
  },
  liveBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  liveBtnTextActive: {
    color: '#28a745',
  },
  liveBtnTextInactive: {
    color: 'rgba(47, 67, 96, 0.6)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveDotActive: {
    backgroundColor: '#28a745',
    ...Platform.select({
      web: { boxShadow: '0 0 5px rgba(40,167,69,0.5)' }
    })
  },
  liveDotInactive: {
    backgroundColor: 'rgba(47, 67, 96, 0.3)',
  },
  fetchAllBtn: {
    backgroundColor: '#007bff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#007bff',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0, 123, 255, 0.2)',
      }
    }),
  },
  fetchAllBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
});