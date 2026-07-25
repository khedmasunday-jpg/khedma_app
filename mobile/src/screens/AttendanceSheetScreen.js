import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import axios from 'axios';
import { logger } from '../utils/logger';
import { API_URL } from '../config/api';
import { getAuthToken } from '../config/authSession';
import { useLanguage } from '../utils/LanguageContext';
import Ionicons from '@expo/vector-icons/Ionicons';

let DateTimePickerModal = null;
if (Platform.OS !== 'web') {
  try {
    DateTimePickerModal = require('react-native-modal-datetime-picker').default;
  } catch (e) {
    DateTimePickerModal = null;
  }
}

export default function AttendanceSheetScreen({ route, navigation }) {
  const { token: routeToken, role, classId, className } = route.params || {};
  const token = routeToken || getAuthToken();
  const { t, locale } = useLanguage();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [students, setStudents] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [classes, setClasses] = useState([]);
  const [currentClassId, setCurrentClassId] = useState(classId || null);
  const [currentClassName, setCurrentClassName] = useState(className || null);
  const [loading, setLoading] = useState(false);

  const isRtl = locale === 'ar';

  const notify = (title, message) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  useEffect(() => {
    if (!currentClassId) fetchClasses();
  }, [currentClassId]);

  useEffect(() => {
    if (!currentClassId) return;
    fetchClassStudents();
  }, [currentClassId]);

  useEffect(() => {
    if (!currentClassId) return;
    fetchAttendanceForDate(selectedDate);
  }, [selectedDate, currentClassId]);

  const fetchClassStudents = async () => {
    if (!token) return notify(t('error'), 'Missing auth token');
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/classes/${currentClassId}/students`, { headers: { Authorization: token } });
      const list = Array.isArray(res.data?.students) ? res.data.students : (Array.isArray(res.data) ? res.data : []);
      setStudents(list);
    } catch (err) {
      const msg = err?.response?.data?.msg || err?.message || 'Failed to fetch students';
      notify(t('error'), msg);
    }
    setLoading(false);
  };

  const fetchClasses = async () => {
    if (!token) return notify(t('error'), 'Missing auth token');
    try {
      const res = await axios.get(`${API_URL}/classes`, { headers: { Authorization: token } });
      const list = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.classes) ? res.data.classes : []);
      setClasses(list);
      if (list.length > 0 && !currentClassId) {
        setCurrentClassId(list[0]._id);
        setCurrentClassName(list[0].name);
      }
    } catch (err) {
      const msg = err?.response?.data?.msg || err?.message || 'Failed to fetch classes';
      notify(t('error'), msg);
    }
  };

  const fetchAttendanceForDate = async (date) => {
    if (!token) return notify(t('error'), 'Missing auth token');
    if (!date) return;
    const dateKey = (date instanceof Date) ? date.toISOString().split('T')[0] : new Date(date).toISOString().split('T')[0];
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/attendance`, { headers: { Authorization: token }, params: { classId: currentClassId, date: dateKey } });
      const records = Array.isArray(res.data) ? res.data : [];
      
      const map = {};
      for (const r of records) {
        try {
          const sid = (r.student && (r.student._id || r.student)) ? (r.student._id || r.student) : null;
          const status = r.status || (r.status_enc ? 'present' : null);
          if (sid) map[sid] = status === 'absent' ? 'absent' : 'present';
        } catch (e) { /* ignore */ }
      }

      if (Array.isArray(students) && students.length > 0) {
        for (const s of students) {
          if (!map[s._id]) map[s._id] = 'absent';
        }
      }

      setAttendanceMap(map);
    } catch (err) {
      const msg = err?.response?.data?.msg || err?.message || 'Failed to fetch attendance';
      notify(t('error'), msg);
    }
    setLoading(false);
  };

  const onChangeDate = (date) => {
    setSelectedDate(date);
    setDatePickerVisible(false);
  };

  const formatDate = (d) => {
    try {
      const dateObj = (d instanceof Date) ? d : new Date(d);
      if (isNaN(dateObj.getTime())) return '';
      const dd = String(dateObj.getDate()).padStart(2, '0');
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const yyyy = dateObj.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    } catch (e) { return '' }
  };

  return (
    <View style={styles.container}>
      {/* Top Class and Date Header Panel */}
      <View style={styles.headerPanel}>
        <Text style={[styles.title, { textAlign: isRtl ? 'right' : 'left' }]}>
          {currentClassName || t('selectClass')}
        </Text>
        
        {/* Class switcher if classId wasn't preset */}
        {!classId && classes.length > 0 && (
          <ScrollView horizontal style={styles.classSelector} showsHorizontalScrollIndicator={false}>
            {classes.map(c => (
              <TouchableOpacity
                key={c._id}
                style={[styles.classBtn, currentClassId === c._id && styles.classBtnSelected]}
                onPress={() => { setCurrentClassId(c._id); setCurrentClassName(c.name); }}
              >
                <Text style={[styles.classBtnText, currentClassId === c._id && styles.classBtnTextSelected]}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Date Selector Row */}
        <View style={[styles.dateRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          <View style={[styles.dateInputWrapper, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
            <Ionicons name="calendar-outline" size={18} color="#2f4360" style={{ marginHorizontal: 6 }} />
            {Platform.OS === 'web' ? (
              <>
                <View style={{ flex: 1, minHeight: 40, justifyContent: 'center', paddingLeft: 6 }} pointerEvents="none">
                  <Text style={{ color: selectedDate ? '#333333' : '#a0a0a0', fontSize: 14, fontWeight: '600' }}>
                    {selectedDate ? formatDate(selectedDate) : 'dd/mm/yyyy'}
                  </Text>
                </View>
                <input
                  type="date"
                  value={(() => {
                    try {
                      if (!selectedDate) return '';
                      return selectedDate.toISOString().split('T')[0];
                    } catch (e) { return ''; }
                  })()}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return setSelectedDate(new Date());
                    const d = new Date(v);
                    if (!isNaN(d.getTime())) setSelectedDate(d);
                  }}
                  onClick={(e) => {
                    try { e.target.showPicker(); } catch (err) {}
                  }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer',
                    zIndex: 2,
                  }}
                />
              </>
            ) : (
              <>
                <TouchableOpacity onPress={() => setDatePickerVisible(true)} style={styles.nativeDatePickerBtn}>
                  <Text style={styles.datePickerText}>{formatDate(selectedDate)}</Text>
                </TouchableOpacity>
                {DateTimePickerModal && (
                  <DateTimePickerModal
                    isVisible={isDatePickerVisible}
                    mode="date"
                    date={selectedDate || new Date()}
                    onConfirm={onChangeDate}
                    onCancel={() => setDatePickerVisible(false)}
                  />
                )}
              </>
            )}
          </View>

          <TouchableOpacity 
            style={styles.refreshBtn} 
            onPress={() => fetchAttendanceForDate(selectedDate)}
          >
            <Ionicons name="refresh" size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Student List */}
      <ScrollView style={styles.studentsList} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color="#2f4360" style={{ marginTop: 20 }} />
        ) : students.length === 0 ? (
          <Text style={styles.noStudentsText}>{t('noStudents')}</Text>
        ) : (
          students.map(s => {
            const isPresent = attendanceMap[s._id] === 'present';
            return (
              <View key={s._id} style={styles.studentCard}>
                <View style={[styles.studentHeaderRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                  <Text style={[styles.studentName, { textAlign: isRtl ? 'right' : 'left' }]}>
                    {s.fullName}
                  </Text>
                  <View style={[styles.statusBadge, isPresent ? styles.badgePresent : styles.badgeAbsent]}>
                    <Ionicons 
                      name={isPresent ? "checkmark-circle-outline" : "close-circle-outline"} 
                      size={16} 
                      color={isPresent ? "#2e7d32" : "#c62828"} 
                      style={{ marginHorizontal: 4 }}
                    />
                    <Text style={[styles.statusText, { color: isPresent ? "#2e7d32" : "#c62828" }]}>
                      {isPresent ? (isRtl ? 'حاضر' : 'Present') : (isRtl ? 'غائب' : 'Absent')}
                    </Text>
                  </View>
                </View>
                
                <View style={[styles.detailRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                  <Text style={styles.detailLabel}>{t('lastAttendance')}:</Text>
                  <Text style={styles.detailValue}>
                    {s.lastAttendanceDate ? formatDate(s.lastAttendanceDate) : t('never')}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 16, 
    backgroundColor: 'rgba(243, 237, 224, 0.75)' 
  },
  headerPanel: { 
    backgroundColor: 'rgba(255, 252, 246, 0.98)', 
    padding: 16, 
    borderRadius: 20, 
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.15)',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#2f4360',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 4px 8px rgba(47, 67, 96, 0.08)',
      }
    }),
  },
  title: { 
    fontSize: 20, 
    fontWeight: 'bold',
    color: '#2f4360',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  classSelector: {
    marginTop: 8,
    maxHeight: 44,
  },
  classBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(243, 237, 224, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.12)',
    borderRadius: 8,
    marginRight: 8,
    justifyContent: 'center',
  },
  classBtnSelected: {
    backgroundColor: '#2f4360',
    borderColor: '#2f4360',
  },
  classBtnText: {
    fontSize: 13,
    color: '#2f4360',
    fontWeight: '600',
  },
  classBtnTextSelected: {
    color: '#ffffff',
  },
  dateRow: { 
    marginTop: 12, 
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateInputWrapper: {
    position: 'relative',
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(243, 237, 224, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.12)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    marginLeft: 8,
  },
  webDatePicker: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: '#2f4360',
    fontSize: 14,
    fontWeight: '600',
    outlineWidth: 0,
  },
  nativeDatePickerBtn: {
    flex: 1,
  },
  datePickerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2f4360',
  },
  refreshBtn: {
    backgroundColor: '#2f4360',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { boxShadow: '0 2px 4px rgba(47, 67, 96, 0.2)' },
      android: { elevation: 2 },
      ios: { shadowOpacity: 0.15, shadowRadius: 2 }
    })
  },
  studentsList: { 
    flex: 1 
  },
  noStudentsText: {
    textAlign: 'center',
    color: 'rgba(36, 54, 79, 0.6)',
    marginTop: 20,
    fontSize: 15,
  },
  studentCard: { 
    backgroundColor: 'rgba(255, 252, 246, 0.95)', 
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.12)',
    borderRadius: 16, 
    marginBottom: 10, 
    padding: 14,
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
  studentHeaderRow: { 
    alignItems: 'center', 
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(47, 67, 96, 0.06)',
    paddingBottom: 8,
    marginBottom: 8,
  },
  studentName: { 
    fontSize: 16, 
    fontWeight: 'bold',
    color: '#2f4360',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgePresent: {
    backgroundColor: 'rgba(46, 125, 50, 0.08)',
    borderColor: 'rgba(46, 125, 50, 0.25)',
  },
  badgeAbsent: {
    backgroundColor: 'rgba(198, 40, 40, 0.08)',
    borderColor: 'rgba(198, 40, 40, 0.25)',
  },
  statusText: { 
    fontSize: 12, 
    fontWeight: 'bold',
  },
  detailRow: { 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginTop: 4,
  },
  detailLabel: { 
    fontWeight: '600', 
    color: 'rgba(36, 54, 79, 0.7)',
    fontSize: 13,
  },
  detailValue: { 
    color: '#2f4360',
    fontSize: 13,
    fontWeight: '600',
  }
});
