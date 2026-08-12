import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, ActivityIndicator, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../utils/ThemeContext';
import { useLanguage } from '../utils/LanguageContext';
import Axios from 'axios';
import { getAuthToken } from '../config/authSession';
import { API_URL } from '../config/api';

export default function SwitchStudentsScreen({ navigation }) {
  const { theme, isDarkMode } = useTheme();
  const { locale } = useLanguage();
  const isAr = locale === 'ar';
  
  const token = getAuthToken();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [yearPairs, setYearPairs] = useState([]);
  const [activeYearIndex, setActiveYearIndex] = useState(0);

  // Unsaved changes: map of studentId -> newClassId
  const [pendingChanges, setPendingChanges] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resClasses, resStudents] = await Promise.all([
        Axios.get(`${API_URL}/classes`, { headers: { Authorization: token } }),
        Axios.get(`${API_URL}/students`, { headers: { Authorization: token } })
      ]);
      
      const allC = resClasses.data;
      const allS = resStudents.data;
      setClasses(allC);
      setStudents(allS);

      // Group into year pairs (1&2, 3&4, 5&6 level)
      // Level 1: الشاروبيم, Level 2: السيرافيم
      // Level 3: الملاك رفائيل, Level 4: الملاك ميخائيل
      // Level 5: الملاك سوريال, Level 6: الملاك غبريال
      const classLevel1 = allC.find(c => c.level === 1);
      const classLevel2 = allC.find(c => c.level === 2);
      const classLevel3 = allC.find(c => c.level === 3);
      const classLevel4 = allC.find(c => c.level === 4);
      const classLevel5 = allC.find(c => c.level === 5);
      const classLevel6 = allC.find(c => c.level === 6);

      setYearPairs([
        { title: isAr ? 'السنة الأولى' : 'Year 1', pair: [classLevel1, classLevel2] },
        { title: isAr ? 'السنة الثانية' : 'Year 2', pair: [classLevel3, classLevel4] },
        { title: isAr ? 'السنة الثالثة' : 'Year 3', pair: [classLevel5, classLevel6] }
      ].filter(y => y.pair[0] && y.pair[1]));

    } catch (err) {
      console.error(err);
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'فشل جلب البيانات' : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const activePair = yearPairs[activeYearIndex]?.pair;

  const getStudentClassId = (student) => {
    if (pendingChanges[student._id]) return pendingChanges[student._id];
    return student.class;
  };

  const handleStudentPress = (student, currentClassId, targetClassId) => {
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
      // Create an array of updates
      const updates = changes.map(([studentId, newClassId]) => {
        const targetClass = classes.find(c => c._id === newClassId);
        return {
          id: studentId,
          class: newClassId,
          classname: targetClass.name,
          classLevel: targetClass.level
        };
      });

      // Update one by one or create a bulk endpoint. Since we don't have a bulk endpoint, we use the single update
      for (const update of updates) {
        await Axios.put(`${API_URL}/students/edit`, update, { headers: { Authorization: token } });
      }

      Alert.alert(isAr ? 'تم بنجاح' : 'Success', isAr ? 'تم حفظ التعديلات بنجاح' : 'Changes saved successfully');
      setPendingChanges({});
      fetchData(); // reload
    } catch (err) {
      console.error(err);
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'فشل حفظ التعديلات' : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    tabs: { flexDirection: 'row', backgroundColor: theme.cardBackground, elevation: 2 },
    tab: { flex: 1, padding: 15, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    activeTab: { borderBottomColor: theme.primary },
    tabText: { color: theme.textMuted, fontWeight: 'bold' },
    activeTabText: { color: theme.primary },
    pairContainer: { flexDirection: 'row', flex: 1, padding: 10, gap: 10 },
    classColumn: { flex: 1, backgroundColor: theme.cardBackground, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: theme.borderColor },
    classTitle: { fontSize: 16, fontWeight: 'bold', color: theme.text, textAlign: 'center', marginBottom: 10 },
    studentRow: { padding: 12, backgroundColor: theme.inputBackground, borderRadius: 8, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    studentName: { color: theme.text, fontSize: 14, flex: 1, textAlign: isAr ? 'right' : 'left' },
    saveBtn: { margin: 16, backgroundColor: theme.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  });

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {yearPairs.map((yp, idx) => (
          <TouchableOpacity 
            key={idx} 
            style={[styles.tab, activeYearIndex === idx && styles.activeTab]}
            onPress={() => setActiveYearIndex(idx)}
          >
            <Text style={[styles.tabText, activeYearIndex === idx && styles.activeTabText]}>{yp.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

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
                      onPress={() => handleStudentPress(s, cls._id, otherCls._id)}
                    >
                      {idx === 1 && <Ionicons name={isAr ? "chevron-forward" : "chevron-back"} size={16} color={theme.primary} />}
                      <Text style={styles.studentName} numberOfLines={1}>{s.firstname || s.name}</Text>
                      {idx === 0 && <Ionicons name={isAr ? "chevron-back" : "chevron-forward"} size={16} color={theme.primary} />}
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
