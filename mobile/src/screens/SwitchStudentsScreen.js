import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, ActivityIndicator, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../utils/ThemeContext';
import { useLanguage } from '../utils/LanguageContext';
import Axios from 'axios';
import { getAuthToken } from '../config/authSession';
import { API_URL } from '../config/api';

export default function SwitchStudentsScreen({ navigation }) {
  const { theme } = useTheme();
  const { locale } = useLanguage();
  const isAr = locale === 'ar';
  
  const token = getAuthToken();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [yearPairs, setYearPairs] = useState([]);
  
  // null means show the 3 buttons, index means show that pair
  const [activeYearIndex, setActiveYearIndex] = useState(null);

  const [pendingChanges, setPendingChanges] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // FIXED: /api/students -> /api/students/data
      const [resClasses, resStudents] = await Promise.all([
        Axios.get(`${API_URL}/classes`, { headers: { Authorization: token } }),
        Axios.get(`${API_URL}/students/data`, { headers: { Authorization: token } })
      ]);
      
      const allC = resClasses.data;
      const allS = resStudents.data.data || resStudents.data; // Sometimes it returns { data: [...] }
      setClasses(allC);
      setStudents(allS);

      const classLevel1 = allC.find(c => c.level === 1);
      const classLevel2 = allC.find(c => c.level === 2);
      const classLevel3 = allC.find(c => c.level === 3);
      const classLevel4 = allC.find(c => c.level === 4);
      const classLevel5 = allC.find(c => c.level === 5);
      const classLevel6 = allC.find(c => c.level === 6);

      setYearPairs([
        { title: isAr ? 'السنة الأولى (الشاروبيم و السيرافيم)' : 'Year 1', pair: [classLevel1, classLevel2] },
        { title: isAr ? 'السنة الثانية (الملاك رفائيل و الملاك ميخائيل)' : 'Year 2', pair: [classLevel3, classLevel4] },
        { title: isAr ? 'السنة الثالثة (الملاك سوريال و الملاك غبريال)' : 'Year 3', pair: [classLevel5, classLevel6] }
      ].filter(y => y.pair[0] && y.pair[1]));

    } catch (err) {
      console.error(err);
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'فشل جلب البيانات' : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const getStudentClassId = (student) => {
    if (pendingChanges[student._id]) return pendingChanges[student._id];
    return student.class;
  };

  const handleStudentPress = (student, targetClassId) => {
    setPendingChanges(prev => ({
      ...prev,
      [student._id]: targetClassId
    }));
  };

  const saveChanges = async () => {
    const changes = Object.entries(pendingChanges);
    if (changes.length === 0) return;

    setSaving(true);
    try {
      const updates = changes.map(([studentId, newClassId]) => {
        const targetClass = classes.find(c => c._id === newClassId);
        return {
          id: studentId,
          class: newClassId,
          classname: targetClass.name,
          classLevel: targetClass.level
        };
      });

      for (const update of updates) {
        await Axios.put(`${API_URL}/students/edit`, update, { headers: { Authorization: token } });
      }

      Alert.alert(isAr ? 'تم بنجاح' : 'Success', isAr ? 'تم حفظ التعديلات بنجاح' : 'Changes saved successfully');
      setPendingChanges({});
      fetchData(); 
    } catch (err) {
      console.error(err);
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'فشل حفظ التعديلات' : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    homeContainer: { flex: 1, padding: 16, justifyContent: 'center', alignItems: 'center' },
    homeTitle: { fontSize: 24, fontWeight: 'bold', color: theme.text, marginBottom: 24, textAlign: 'center' },
    bigButton: {
      width: '100%',
      maxWidth: 500,
      backgroundColor: theme.cardBackground,
      padding: 24,
      borderRadius: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.borderColor,
      alignItems: 'center',
      ...Platform.select({
        web: { cursor: 'pointer' },
        ios: { shadowColor: theme.shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3 },
        android: { elevation: 2 },
      })
    },
    bigButtonText: { fontSize: 18, fontWeight: 'bold', color: theme.primary, marginTop: 12 },
    
    splitContainer: { flex: 1, flexDirection: 'column' },
    header: { padding: 16, flexDirection: isAr ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.headerBackground, borderBottomWidth: 1, borderBottomColor: theme.borderColor },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: theme.text },
    backBtn: { padding: 8 },
    
    instructions: { padding: 12, textAlign: 'center', color: theme.textMuted, fontSize: 14 },
    
    pairContainer: { flexDirection: isAr ? 'row-reverse' : 'row', flex: 1, padding: 10, gap: 10 },
    classColumn: { flex: 1, backgroundColor: theme.cardBackground, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: theme.borderColor },
    classTitle: { fontSize: 16, fontWeight: 'bold', color: theme.text, textAlign: 'center', marginBottom: 10 },
    
    studentRow: { padding: 12, backgroundColor: theme.inputBackground, borderRadius: 8, marginBottom: 8, flexDirection: isAr ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' },
    studentName: { color: theme.text, fontSize: 14, flex: 1, textAlign: isAr ? 'right' : 'left' },
    
    saveBtn: { margin: 16, backgroundColor: theme.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  });

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (activeYearIndex === null) {
    return (
      <ScrollView contentContainerStyle={styles.homeContainer}>
        <Text style={styles.homeTitle}>{isAr ? 'اختر السنة الدراسية لنقل المخدومين' : 'Select Year to Switch Students'}</Text>
        {yearPairs.map((yp, idx) => (
          <TouchableOpacity key={idx} style={styles.bigButton} onPress={() => setActiveYearIndex(idx)}>
            <Ionicons name="people-outline" size={48} color={theme.primary} />
            <Text style={styles.bigButtonText}>{yp.title}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }

  const activePair = yearPairs[activeYearIndex]?.pair;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setActiveYearIndex(null)}>
          <Ionicons name={isAr ? "arrow-forward" : "arrow-back"} size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{yearPairs[activeYearIndex].title}</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <Text style={styles.instructions}>
        {isAr ? 'انقر على اسم المخدوم لنقله للفصل الآخر' : 'Click on a student to move them to the other class'}
      </Text>

      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {activePair && (
          <View style={styles.pairContainer}>
            {activePair.map((cls, idx) => {
              const otherCls = idx === 0 ? activePair[1] : activePair[0];
              const colStudents = students.filter(s => getStudentClassId(s) === cls._id);

              return (
                <View key={cls._id} style={styles.classColumn}>
                  <Text style={styles.classTitle}>{cls.name} ({colStudents.length})</Text>
                  {colStudents.map(s => (
                    <TouchableOpacity 
                      key={s._id} 
                      style={styles.studentRow}
                      onPress={() => handleStudentPress(s, otherCls._id)}
                    >
                      {(!isAr ? idx === 1 : idx === 0) && <Ionicons name="arrow-back-outline" size={16} color={theme.primary} />}
                      <Text style={styles.studentName} numberOfLines={1}>{s.firstname || s.name}</Text>
                      {(!isAr ? idx === 0 : idx === 1) && <Ionicons name="arrow-forward-outline" size={16} color={theme.primary} />}
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {Object.keys(pendingChanges).length > 0 && (
        <TouchableOpacity style={styles.saveBtn} onPress={saveChanges} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{isAr ? 'حفظ التعديلات' : 'Save Changes'} ({Object.keys(pendingChanges).length})</Text>}
        </TouchableOpacity>
      )}
    </View>
  );
}
