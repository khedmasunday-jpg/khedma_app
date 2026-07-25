import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import axios from 'axios';
import { useLanguage } from '../utils/LanguageContext';
import { logger } from '../utils/logger';
import { getAuthToken } from '../config/authSession';
import { API_URL } from '../config/api';

export default function ClassDisplayScreen({ route, navigation }) {
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

  // Fetch classes for the user
  useEffect(() => {
    axios.get(`${API_URL}/classes`, { headers: { Authorization: token } })
      .then(res => setClasses(res.data))
      .catch(() => Alert.alert(t('error'), locale === 'ar' ? 'فشل تحميل الفصول' : 'Failed to fetch classes'));
  }, []);

  // Fetch detailed student data for selected class
  const fetchClassDetails = async (classId) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/classes/${classId}/students`, {
        headers: { Authorization: token }
      });
      setClassData(res.data);
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
    <View style={styles.container}>
      {/* Class Dropdown */}
      <Text style={[styles.label, { textAlign: isRtl ? 'right' : 'left' }]}>{t('selectClass')}</Text>
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

      {/* View Attendance Sheet Action */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={styles.attendanceActionBtn}
          onPress={() => navigation.navigate('AttendanceSheet', { token, role })}
        >
          <Text style={styles.attendanceActionBtnText}>{t('viewAttendanceSheet')}</Text>
        </TouchableOpacity>
      </View>

      {/* Class Details Title */}
      {classData && (
        <View style={styles.classInfo}>
          <Text style={styles.classTitle}>{classData.className}</Text>
        </View>
      )}

      {/* Students List */}
      <ScrollView style={styles.studentsList} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color="#2f4360" style={{ marginTop: 20 }} />
        ) : classData?.students?.map(student => (
          <View key={student._id} style={styles.studentCard}>
            {/* Student Header */}
            <TouchableOpacity
              style={[styles.studentHeader, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}
              onPress={() => toggleStudentDetails(student._id)}
            >
              <View style={[styles.studentInfo, { alignItems: isRtl ? 'flex-end' : 'flex-start' }]}>
                <Text style={styles.studentName}>{student.fullName}</Text>
              </View>
              <Text style={styles.expandIcon}>
                {expandedStudent === student._id ? '▼' : '▶'}
              </Text>
            </TouchableOpacity>

            {/* Expanded Student Details (RTL supported) */}
            {expandedStudent === student._id && (
              <View style={styles.studentDetails}>
                <View style={[styles.detailRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                  <Text style={styles.detailLabel}>{t('gradeLevel')}:</Text>
                  <Text style={styles.detailValue}>{student.classLevel}</Text>
                </View>
                <View style={[styles.detailRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                  <Text style={styles.detailLabel}>{t('motherPhone')}:</Text>
                  <Text style={styles.detailValue}>{student.mother_phonenumber}</Text>
                </View>
                <View style={[styles.detailRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                  <Text style={styles.detailLabel}>{t('fatherPhone')}:</Text>
                  <Text style={styles.detailValue}>{student.father_phonenumber || 'N/A'}</Text>
                </View>
                <View style={[styles.detailRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                  <Text style={styles.detailLabel}>{t('birthdate')}:</Text>
                  <Text style={styles.detailValue}>{student.birthdate ? formatDate(student.birthdate) : ''}</Text>
                </View>
                <View style={[styles.detailRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
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

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 16, 
    backgroundColor: 'rgba(243, 237, 224, 0.75)' 
  },
  label: { 
    fontWeight: 'bold', 
    fontSize: 18, 
    marginBottom: 10,
    color: '#2f4360',
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
    backgroundColor: 'rgba(255, 252, 246, 0.9)', 
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.15)',
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
    backgroundColor: '#2f4360', 
    borderColor: '#2f4360', 
  },
  classBtnText: {
    color: '#2f4360',
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
    backgroundColor: '#2f4360',
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
    backgroundColor: 'rgba(255, 252, 246, 0.95)', 
    padding: 16, 
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.14)',
    borderRadius: 16, 
    marginBottom: 16,
  },
  classTitle: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#2f4360',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
    textAlign: 'center',
  },
  studentsList: { flex: 1 },
  studentCard: { 
    backgroundColor: 'rgba(255, 252, 246, 0.95)', 
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.14)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  studentInfo: { flex: 1 },
  studentName: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#24364f',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  expandIcon: { 
    fontSize: 14, 
    color: 'rgba(36, 54, 79, 0.6)',
    paddingHorizontal: 8,
  },
  studentDetails: { 
    padding: 16, 
    backgroundColor: '#ffffff',
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
    color: '#2f4360', 
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  detailValue: { 
    color: '#24364f',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
});
