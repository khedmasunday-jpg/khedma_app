import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Platform, ActivityIndicator } from 'react-native';
import axios from 'axios';
import { API_URL } from '../config/api';
import { getAuthToken, getAuthUser } from '../config/authSession';
import { logger } from '../utils/logger';
import { useLanguage } from '../utils/LanguageContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatDateDDMMYYYY } from '../utils/dateFormatter';
import SkeletonList from '../components/SkeletonLoader';
import { fetchWithCache, invalidateCache } from '../utils/apiCache';

let DateTimePickerModal = null;
if (Platform.OS !== 'web') {
  try {
    DateTimePickerModal = require('react-native-modal-datetime-picker').default;
  } catch (e) {
    DateTimePickerModal = null;
  }
}

export default function AttendanceScreen({ route, navigation }) {
  const { token: routeToken, role, userId, userName } = route.params || {};
  const token = routeToken || getAuthToken();
  const { t, locale } = useLanguage();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(false);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);

  const isRtl = locale === 'ar';

  const formatDateDDMMYYYY = (d) => {
    if (!d) return '-';
    try {
      const dateObj = (typeof d === 'string' || typeof d === 'number') ? new Date(d) : (d instanceof Date ? d : new Date(d));
      if (isNaN(dateObj.getTime())) return '-';
      const dd = String(dateObj.getDate()).padStart(2, '0');
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const yyyy = dateObj.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    } catch (e) {
      return '-';
    }
  };

  const notify = (title, message) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchWithCache(`${API_URL}/classes`, { headers: { Authorization: token } })
      .then(data => {
        setClasses(data);
        if (data && data.length > 0) {
          const user = getAuthUser() || {};
          if (role === 'teacher' && user.assignedclass) {
            const defaultClass = data.find(c => c._id === user.assignedclass || c.name === user.assignedclass);
            setSelectedClass(defaultClass ? defaultClass._id : data[0]._id);
          } else {
            setSelectedClass(data[0]._id);
          }
        }
      })
      .catch(err => {
        const msg = err?.response?.data?.msg || err.message || t('error');
        notify(t('error'), msg);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    setLoading(true);
    fetchWithCache(`${API_URL}/classes/${selectedClass}/students`, { headers: { Authorization: token } })
      .then(data => {
        const list = Array.isArray(data?.students) ? data.students : (Array.isArray(data) ? data : []);
        setStudents(list);
        setAttendance(Object.fromEntries(list.map(s => [s._id, 'absent'])));
      })
      .catch(err => {
        const msg = err?.response?.data?.msg || err.message || t('error');
        notify(t('error'), msg);
      })
      .finally(() => setLoading(false));
  }, [selectedClass]);

  const toggleAttendance = (id) => {
    setAttendance(prev => {
      const newStatus = prev[id] === 'present' ? 'absent' : 'present';
      if (newStatus === 'present') {
        const dateKey = selectedDate ? (selectedDate instanceof Date ? selectedDate.toISOString().split('T')[0] : new Date(selectedDate).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0];
        setStudents(prevStudents => prevStudents.map(s => s._id === id ? { ...s, lastAbsentDate: null, lastAttendanceDate: dateKey } : s));
      }
      return { ...prev, [id]: newStatus };
    });
  };

  const setAll = (status) => {
    setAttendance(Object.fromEntries(students.map(s => [s._id, status])));
    if (status === 'present') {
      const dateKey = selectedDate ? (selectedDate instanceof Date ? selectedDate.toISOString().split('T')[0] : new Date(selectedDate).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0];
      setStudents(prevStudents => prevStudents.map(s => ({ ...s, lastAbsentDate: null, lastAttendanceDate: dateKey })));
    }
  };

  const [submitting, setSubmitting] = useState(false);

  const registerAttendance = async () => {
    if (!selectedClass) {
      notify(t('error'), t('selectClassFirst'));
      return;
    }
    if (submitting) return;
    try {
      setSubmitting(true);
      const dateKey = selectedDate.toISOString().split('T')[0];
      const payload = {
        students: students.map(s => ({ studentId: s._id, status: attendance[s._id] })),
        performedBy: {
          id: userId || null,
          name: userName || null,
          role: role || null
        },
        targetClass: selectedClass,
        date: dateKey
      };

      await axios.post(`${API_URL}/attendance/${selectedClass}`, payload, { headers: { Authorization: token } });

      notify(t('success'), t('attendanceRegistered'));
      try {
        setLoading(true);
        const res = await axios.get(`${API_URL}/classes/${selectedClass}/students`, { headers: { Authorization: token } });
        const list = Array.isArray(res.data?.students) ? res.data.students : (Array.isArray(res.data) ? res.data : []);
        setStudents(list);
      } catch (e) {
        
      } finally {
        setLoading(false);
      }
    } catch (err) {
      const msg = err?.response?.data?.msg || err?.response?.data?.error || err.message || t('error');
      notify(t('error'), msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {}
      <Text style={[styles.label, { textAlign: isRtl ? 'right' : 'left' }]}>{t('selectClass')}</Text>
      <ScrollView horizontal style={styles.dropdown} showsHorizontalScrollIndicator={false}>
        {classes.map(cls => (
          <TouchableOpacity
            key={cls._id}
            style={[
              styles.classBtn,
              selectedClass === cls._id && styles.classBtnSelected
            ]}
            onPress={() => setSelectedClass(cls._id)}
          >
            <Text style={[
              styles.classBtnText,
              selectedClass === cls._id && styles.classBtnTextSelected
            ]}>{cls.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {}
      <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
        {loading ? (
          <SkeletonList count={5} />
        ) : students.length === 0 ? (
          <Text style={styles.noStudentsText}>{t('noStudents')}</Text>
        ) : (
          students.map(s => {
            const isPresent = attendance[s._id] === 'present';
            return (
              <View key={s._id} style={[styles.studentCard, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                <View style={[styles.studentInfo, { alignItems: isRtl ? 'flex-end' : 'flex-start' }]}>
                  <Text style={styles.studentName}>{s.fullName}</Text>
                  <Text style={styles.statsText}>
                    {t('totalAttendance')}: {s.totalAttendance || 0}
                  </Text>
                  <Text style={styles.statsText}>
                    {t('lastAttendance')}: {formatDateDDMMYYYY(s.lastAttendanceDate)}
                  </Text>
                </View>

                <TouchableOpacity 
                  onPress={() => toggleAttendance(s._id)} 
                  style={[styles.statusToggle, isPresent ? styles.statusPresent : styles.statusAbsent]}
                >
                  <Ionicons 
                    name={isPresent ? "checkmark-circle" : "close-circle"} 
                    size={28} 
                    color={isPresent ? "#2e7d32" : "#c62828"} 
                  />
                  <Text style={[styles.statusTextLabel, { color: isPresent ? "#2e7d32" : "#c62828" }]}>
                    {isPresent 
                      ? (isRtl ? ((s.gender === 'female' || s.gender === 'girl') ? 'حاضرة' : 'حاضر') : 'Present') 
                      : (isRtl ? ((s.gender === 'female' || s.gender === 'girl') ? 'غائبة' : 'غائب') : 'Absent')}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      {}
      <View style={styles.controlPanel}>
        <Text style={[styles.dateLabel, { textAlign: isRtl ? 'right' : 'left' }]}>{t('attendanceDate')}</Text>
        <View style={[styles.dateSelectorRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          <Ionicons name="calendar-outline" size={20} color="#2f4360" style={{ marginHorizontal: 8 }} />
          {Platform.OS === 'web' ? (
            <View style={{ flex: 1, position: 'relative', minHeight: 40, justifyContent: 'center' }}>
              <View style={{ paddingLeft: 12 }} pointerEvents="none">
                <Text style={{ color: selectedDate ? '#333' : '#a0a0a0', fontSize: 15 }}>
                  {selectedDate ? formatDateDDMMYYYY(selectedDate) : 'dd/mm/yyyy'}
                </Text>
              </View>
              <input
                type="date"
                value={(() => {
                  try {
                    if (!selectedDate) return '';
                    return selectedDate.toISOString().split('T')[0];
                  } catch (e) {
                    return '';
                  }
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
                  outlineStyle: 'none',
                  cursor: 'pointer',
                  zIndex: 2,
                }}
              />
            </View>
          ) : (
            <>
              <TouchableOpacity onPress={() => setDatePickerVisible(true)} style={styles.nativeDatePickerBtn}>
                <Text style={styles.datePickerText}>{formatDateDDMMYYYY(selectedDate)}</Text>
              </TouchableOpacity>
              {DateTimePickerModal && (
                <DateTimePickerModal
                  isVisible={isDatePickerVisible}
                  mode="date"
                  date={selectedDate || new Date()}
                  onConfirm={(date) => { setSelectedDate(date); setDatePickerVisible(false); }}
                  onCancel={() => setDatePickerVisible(false)}
                />
              )}
            </>
          )}
        </View>

        {}
        <View style={[styles.bulkActionsRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity style={[styles.bulkBtn, styles.btnPresent]} onPress={() => setAll('present')}>
            <Ionicons name="checkmark-done" size={18} color="#ffffff" style={{ marginHorizontal: 4 }} />
            <Text style={styles.bulkBtnText}>{t('allPresent')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.bulkBtn, styles.btnAbsent]} onPress={() => setAll('absent')}>
            <Ionicons name="close" size={18} color="#ffffff" style={{ marginHorizontal: 4 }} />
            <Text style={styles.bulkBtnText}>{t('allAbsent')}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.7 }]} onPress={registerAttendance} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={20} color="#ffffff" style={{ marginHorizontal: 6 }} />
              <Text style={styles.submitBtnText}>{t('registerAttendance')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 16,
    backgroundColor: 'rgba(243, 237, 224, 0.75)'
  },
  label: { 
    fontWeight: 'bold', 
    fontSize: 16, 
    marginBottom: 8,
    color: '#2f4360',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  dropdown: { 
    flexDirection: 'row', 
    marginBottom: 12,
    maxHeight: 48,
  },
  classBtn: { 
    paddingVertical: 8,
    paddingHorizontal: 16, 
    backgroundColor: 'rgba(255, 252, 246, 0.95)', 
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.15)',
    borderRadius: 10,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#24364f',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 4px rgba(36, 54, 79, 0.08)',
      }
    }),
  },
  classBtnSelected: { 
    backgroundColor: '#2f4360',
    borderColor: '#2f4360',
  },
  classBtnText: {
    color: '#2f4360',
    fontWeight: '600',
    fontSize: 14,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  classBtnTextSelected: {
    color: '#ffffff',
  },
  listContainer: {
    flex: 1,
    marginTop: 10,
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
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Platform.select({
      ios: {
        shadowColor: '#24364f',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 4px 8px rgba(36, 54, 79, 0.06)',
      }
    }),
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2f4360',
    marginBottom: 4,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  statsText: {
    fontSize: 12,
    color: 'rgba(36, 54, 79, 0.7)',
    marginTop: 2,
  },
  statusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusPresent: {
    backgroundColor: 'rgba(46, 125, 50, 0.08)',
    borderColor: 'rgba(46, 125, 50, 0.3)',
  },
  statusAbsent: {
    backgroundColor: 'rgba(198, 40, 40, 0.08)',
    borderColor: 'rgba(198, 40, 40, 0.3)',
  },
  statusTextLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 6,
    marginRight: 6,
  },
  controlPanel: {
    backgroundColor: 'rgba(255, 252, 246, 0.98)',
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.16)',
    borderRadius: 20,
    padding: 16,
    marginTop: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#2f4360',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 -4px 12px rgba(47, 67, 96, 0.08)',
      }
    }),
  },
  dateLabel: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#2f4360',
    marginBottom: 6,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  dateSelectorRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(243, 237, 224, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.12)',
    borderRadius: 10,
    padding: 8,
    marginBottom: 12,
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
  bulkActionsRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  bulkBtn: {
    width: '48%',
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
      android: { elevation: 2 },
      ios: { shadowOpacity: 0.1, shadowRadius: 2 }
    })
  },
  btnPresent: {
    backgroundColor: '#2e7d32',
  },
  btnAbsent: {
    backgroundColor: '#c62828',
  },
  bulkBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  submitBtn: {
    backgroundColor: '#2f4360',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { boxShadow: '0 4px 6px rgba(47, 67, 96, 0.2)' },
      android: { elevation: 3 },
      ios: { shadowOpacity: 0.2, shadowRadius: 4 }
    })
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  }
});
