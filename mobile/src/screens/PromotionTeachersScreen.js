import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, ActivityIndicator, Alert } from 'react-native';
import { useTheme } from '../utils/ThemeContext';
import { useLanguage } from '../utils/LanguageContext';
import Axios from 'axios';
import { getAuthToken } from '../config/authSession';
import { API_URL } from '../config/api';

export default function PromotionTeachersScreen() {
  const { theme } = useTheme();
  const { locale } = useLanguage();
  const isAr = locale === 'ar';
  
  const token = getAuthToken();

  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, classesRes] = await Promise.all([
        Axios.get(`${API_URL}/users`, { headers: { Authorization: token } }),
        Axios.get(`${API_URL}/classes`, { headers: { Authorization: token } })
      ]);
      
      const staff = usersRes.data.filter(u => u.role === 'teacher' || u.role === 'co-principal');
      setTeachers(staff);
      setClasses(classesRes.data);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const assignTeacherToClass = async (teacher, targetClass) => {
    try {
      setUpdating(true);
      // Backend usually updates user via PATCH /api/users/:id or similar
      const payload = {
        assignedclass: targetClass.name,
        assignedlevel: targetClass.level
      };
      
      await Axios.patch(`${API_URL}/users/${teacher._id}`, payload, { headers: { Authorization: token } });
      
      // Update local state
      setTeachers(prev => prev.map(t => {
        if (t._id === teacher._id) {
          return { ...t, assignedclass: targetClass.name, assignedlevel: targetClass.level };
        }
        return t;
      }));
      
      setSelectedTeacher({ ...teacher, assignedclass: targetClass.name, assignedlevel: targetClass.level });
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to assign class');
    } finally {
      setUpdating(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, flexDirection: isAr ? 'row-reverse' : 'row', backgroundColor: theme.background },
    leftPane: {
      flex: 1,
      borderRightWidth: isAr ? 0 : 1,
      borderLeftWidth: isAr ? 1 : 0,
      borderColor: theme.borderColor,
      backgroundColor: theme.cardBackground,
    },
    rightPane: {
      flex: 1.5,
      backgroundColor: theme.background,
      padding: 16,
    },
    header: {
      padding: 16,
      backgroundColor: theme.headerBackground,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderColor,
    },
    headerText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
      textAlign: 'center',
    },
    teacherItem: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderColor,
    },
    teacherItemSelected: {
      backgroundColor: theme.primary + '20', // 20% opacity
      borderLeftWidth: isAr ? 0 : 4,
      borderRightWidth: isAr ? 4 : 0,
      borderColor: theme.primary,
    },
    teacherName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      textAlign: isAr ? 'right' : 'left',
    },
    teacherRole: {
      fontSize: 12,
      color: theme.textMuted,
      textAlign: isAr ? 'right' : 'left',
      marginTop: 4,
    },
    emptyRight: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyRightText: {
      fontSize: 16,
      color: theme.textMuted,
    },
    classCard: {
      backgroundColor: theme.cardBackground,
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.borderColor,
      flexDirection: isAr ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    classCardSelected: {
      borderColor: theme.primary,
      backgroundColor: theme.primary + '10',
      borderWidth: 2,
    },
    className: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.text,
    },
    classYear: {
      fontSize: 14,
      color: theme.textMuted,
    },
    selectedBadge: {
      backgroundColor: theme.primary,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    selectedBadgeText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: 'bold',
    }
  });

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // Sort classes so the assigned one is at the top
  let displayClasses = [...classes];
  if (selectedTeacher) {
    const cleanUserClass = (selectedTeacher.assignedclass || '').replace(/^فصل\s+/, '').trim();
    displayClasses.sort((a, b) => {
      const isASelected = a.name === cleanUserClass || a.name === selectedTeacher.assignedclass;
      const isBSelected = b.name === cleanUserClass || b.name === selectedTeacher.assignedclass;
      if (isASelected && !isBSelected) return -1;
      if (!isASelected && isBSelected) return 1;
      return a.level - b.level;
    });
  }

  const getYearName = (level) => {
    if (level === 1 || level === 2) return isAr ? 'السنة الأولى' : 'Year 1';
    if (level === 3 || level === 4) return isAr ? 'السنة الثانية' : 'Year 2';
    if (level === 5 || level === 6) return isAr ? 'السنة الثالثة' : 'Year 3';
    return '';
  };

  return (
    <View style={styles.container}>
      {/* Left Pane: Teachers */}
      <View style={styles.leftPane}>
        <View style={styles.header}>
          <Text style={styles.headerText}>{isAr ? 'الخدام' : 'Teachers'}</Text>
        </View>
        <ScrollView>
          {teachers.map(t => (
            <TouchableOpacity 
              key={t._id} 
              style={[styles.teacherItem, selectedTeacher?._id === t._id && styles.teacherItemSelected]}
              onPress={() => setSelectedTeacher(t)}
            >
              <Text style={styles.teacherName}>{t.username}</Text>
              <Text style={styles.teacherRole}>{t.role === 'co-principal' ? (isAr ? 'أمين خدمة' : 'Co-Principal') : (isAr ? 'خادم' : 'Teacher')}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Right Pane: Classes */}
      <View style={styles.rightPane}>
        {!selectedTeacher ? (
          <View style={styles.emptyRight}>
            <Text style={styles.emptyRightText}>{isAr ? 'اختر خادماً لعرض وتعديل فصله' : 'Select a teacher to view/edit their class'}</Text>
          </View>
        ) : (
          <>
            <Text style={[styles.headerText, { marginBottom: 16, textAlign: isAr ? 'right' : 'left' }]}>
              {isAr ? `تعيين فصل لـ ${selectedTeacher.username}` : `Assign class for ${selectedTeacher.username}`}
            </Text>
            
            <ScrollView>
              {displayClasses.map(cls => {
                const cleanUserClass = (selectedTeacher.assignedclass || '').replace(/^فصل\s+/, '').trim();
                const isSelected = cls.name === cleanUserClass || cls.name === selectedTeacher.assignedclass;
                
                return (
                  <TouchableOpacity 
                    key={cls._id} 
                    style={[styles.classCard, isSelected && styles.classCardSelected]}
                    onPress={() => assignTeacherToClass(selectedTeacher, cls)}
                    disabled={isSelected || updating}
                  >
                    <View style={{ alignItems: isAr ? 'flex-end' : 'flex-start' }}>
                      <Text style={styles.className}>{cls.name}</Text>
                      <Text style={styles.classYear}>{getYearName(cls.level)}</Text>
                    </View>
                    
                    {isSelected && (
                      <View style={styles.selectedBadge}>
                        <Text style={styles.selectedBadgeText}>{isAr ? 'الفصل الحالي' : 'Selected'}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}
      </View>
    </View>
  );
}
