import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform, Linking } from 'react-native';
import axios from 'axios';
import { useLanguage } from '../utils/LanguageContext';
import { logger } from '../utils/logger';
import { getAuthToken, getAuthUser } from '../config/authSession';
import { API_URL } from '../config/api';
import SkeletonList from '../components/SkeletonLoader';
import { fetchWithCache } from '../utils/apiCache';

import { useTheme } from '../utils/ThemeContext';
export default function ClassDisplayScreen({ route, navigation }) {const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode);
  const { token: routeToken, role } = route.params || {};
  const token = routeToken || getAuthToken();
  const { t, locale } = useLanguage();

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

  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [classData, setClassData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedStudent, setExpandedStudent] = useState(null);

  useEffect(() => {
    fetchWithCache(`${API_URL}/classes?all=true`, { headers: { Authorization: token } })
      .then(data => {
        let sortedClasses = Array.isArray(data) ? [...data] : [];
        const user = getAuthUser() || {};
        
        const cleanUserClass = (user.assignedclass || '').replace(/^فصل\s+/, '').trim();
        let year = null;
        if (user.assignedlevel) {
           year = [1,2,3].includes(user.assignedlevel) ? user.assignedlevel : Math.ceil(user.assignedlevel / 2);
        }

        sortedClasses.sort((a, b) => {
          if (role === 'teacher') {
            const isAAssigned = user.assignedclass && (a._id === user.assignedclass || (a.name || '').replace(/^فصل\s+/, '').trim() === cleanUserClass);
            const isBAssigned = user.assignedclass && (b._id === user.assignedclass || (b.name || '').replace(/^فصل\s+/, '').trim() === cleanUserClass);
            if (isAAssigned && !isBAssigned) return -1;
            if (!isAAssigned && isBAssigned) return 1;
          }
          
          if (role === 'teacher' || role === 'co-principal') {
            const aYear = a.year || Math.ceil((a.level || 1)/2);
            const bYear = b.year || Math.ceil((b.level || 1)/2);
            const isASameLevel = year && (aYear === year);
            const isBSameLevel = year && (bYear === year);
            if (isASameLevel && !isBSameLevel) return -1;
            if (!isASameLevel && isBSameLevel) return 1;
          }
          
          return (a.level || 0) - (b.level || 0);
        });

        setClasses(sortedClasses);

        if (role === 'teacher' && sortedClasses.length > 0) {
           setSelectedClass(sortedClasses[0]._id);
           fetchClassDetails(sortedClasses[0]._id);
        }
      })
      .catch(() => Alert.alert(t('error'), locale === 'ar' ? 'فشل تحميل الفصول' : 'Failed to fetch classes'));
  }, []);

  const fetchClassDetails = async (classId) => {
    setLoading(true);
    try {
      const data = await fetchWithCache(`${API_URL}/classes/${classId}/students`, {
        headers: { Authorization: token }
      });
      setClassData(data);
    } catch (err) {
      Alert.alert(t('error'), locale === 'ar' ? 'فشل تحميل بيانات الفصل' : 'Failed to fetch class details');
    }
    setLoading(false);
  };

  const toggleStudentDetails = (studentId) => {
    setExpandedStudent(expandedStudent === studentId ? null : studentId);
  };

  const isRtl = locale === 'ar';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }, { backgroundColor: theme.background }]}>
      {}
      <Text style={[styles.label, { textAlign: 'left' }]}>{t('selectClass')}</Text>
      <ScrollView horizontal style={styles.dropdown} showsHorizontalScrollIndicator={false}>
        {(Array.isArray(classes) ? classes : []).map(cls => (
          <TouchableOpacity
            key={cls._id}
            style={[
              styles.classBtn,
              selectedClass === cls._id && styles.classBtnSelected
            ]}
            onPress={() => {
              setSelectedClass(cls._id);
              fetchClassDetails(cls._id);
            }}
          >
            <Text style={[
              styles.classBtnText,
              selectedClass === cls._id && styles.classBtnTextSelected
            ]}>{cls.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={styles.attendanceActionBtn}
          onPress={() => {
            const currentCls = classes?.find(c => c._id === selectedClass);
            navigation.navigate('AttendanceSheet', { 
              token, 
              role,
              classId: selectedClass,
              className: currentCls ? currentCls.name : null
            });
          }}
        >
          <Text style={styles.attendanceActionBtnText}>{t('viewAttendanceSheet')}</Text>
        </TouchableOpacity>
      </View>



      {}
      <ScrollView style={styles.studentsList} showsVerticalScrollIndicator={false}>
        {loading ? (
          <SkeletonList count={5} />
        ) : classData?.students?.map(student => (
          <View key={student._id} style={styles.studentCard}>
            {}
            <TouchableOpacity
              style={[styles.studentHeader, { flexDirection: 'row' }]}
              onPress={() => toggleStudentDetails(student._id)}
            >
              <View style={[styles.studentInfo, { alignItems: 'flex-start' }]}>
                <Text style={styles.studentName}>{student.fullName}</Text>
              </View>
              <Text style={styles.expandIcon}>
                {expandedStudent === student._id ? '▼' : '▶'}
              </Text>
            </TouchableOpacity>

            {}
            {expandedStudent === student._id && (
              <View style={styles.studentDetails}>
                <View style={[styles.detailRow, { flexDirection: 'row' }]}>
                  <Text style={styles.detailLabel}>{t('gradeLevel')}:</Text>
                  <Text style={styles.detailValue}>{student.classLevel}</Text>
                </View>
                <View style={[styles.detailRow, { flexDirection: 'row' }]}>
                  <Text style={styles.detailLabel}>{t('motherPhone')}:</Text>
                  {student.mother_phonenumber ? (
                    <TouchableOpacity onPress={() => Linking.openURL(`tel:${student.mother_phonenumber}`)}>
                      <Text style={[styles.detailValue, { color: '#3498db', textDecorationLine: 'underline' }]}>{student.mother_phonenumber}</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.detailValue}>N/A</Text>
                  )}
                </View>
                <View style={[styles.detailRow, { flexDirection: 'row' }]}>
                  <Text style={styles.detailLabel}>{t('fatherPhone')}:</Text>
                  {student.father_phonenumber ? (
                    <TouchableOpacity onPress={() => Linking.openURL(`tel:${student.father_phonenumber}`)}>
                      <Text style={[styles.detailValue, { color: '#3498db', textDecorationLine: 'underline' }]}>{student.father_phonenumber}</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.detailValue}>N/A</Text>
                  )}
                </View>
                <View style={[styles.detailRow, { flexDirection: 'row' }]}>
                  <Text style={styles.detailLabel}>{t('birthdate')}:</Text>
                  <Text style={styles.detailValue}>{student.birthdate ? formatDate(student.birthdate) : ''}</Text>
                </View>
                <View style={[styles.detailRow, { flexDirection: 'row' }]}>
                  <Text style={styles.detailLabel}>{t('lastAttendance')}:</Text>
                  <Text style={styles.detailValue}>{student.lastAttendanceDate ? formatDate(student.lastAttendanceDate) : t('never')}</Text>
                </View>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const getStyles = (theme, isDarkMode) => StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 16, 
    backgroundColor: theme.background 
  },
  label: { 
    fontWeight: 'bold', 
    fontSize: 18, 
    marginBottom: 10,
    color: theme.text,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  dropdown: { 
    flexDirection: 'row', 
    marginBottom: 16,
    maxHeight: 52,
  },
  classBtn: { 
    paddingVertical: 10,
    paddingHorizontal: 16, 
    backgroundColor: theme.cardBackground, 
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 12, 
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
    backgroundColor: theme.primary, 
    borderColor: '#2f4360', 
  },
  classBtnText: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  classBtnTextSelected: {
    color: '#ffffff',
  },
  actionContainer: {
    marginVertical: 12,
  },
  attendanceActionBtn: {
    width: '100%',
    padding: 14,
    backgroundColor: theme.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#2f4360',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 4px 8px rgba(47, 67, 96, 0.15)',
      }
    }),
  },
  attendanceActionBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  classInfo: { 
    backgroundColor: theme.cardBackground, 
    padding: 16, 
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 16, 
    marginBottom: 16,
  },
  classTitle: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: theme.text,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
    textAlign: 'center',
  },
  studentsList: { flex: 1 },
  studentCard: { 
    backgroundColor: theme.cardBackground, 
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 16, 
    marginBottom: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#24364f',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 4px 8px rgba(36, 54, 79, 0.05)',
      }
    }),
  },
  studentHeader: { 
    alignItems: 'center', 
    padding: 16,
    backgroundColor: theme.cardBackground,
  },
  studentInfo: { flex: 1 },
  studentName: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: theme.text,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  expandIcon: { 
    fontSize: 14, 
    color: theme.textMuted,
    paddingHorizontal: 8,
  },
  studentDetails: { 
    padding: 16, 
    backgroundColor: theme.cardBackground,
    borderTopWidth: 1,
    borderTopColor: 'rgba(47, 67, 96, 0.08)',
  },
  detailRow: { 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(47, 67, 96, 0.05)',
  },
  detailLabel: { 
    fontWeight: 'bold', 
    color: theme.text, 
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  detailValue: { 
    color: theme.text,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
});
