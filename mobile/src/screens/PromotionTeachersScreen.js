import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { useTheme } from '../utils/ThemeContext';
import { useLanguage } from '../utils/LanguageContext';
import Axios from 'axios';
import { getAuthToken } from '../config/authSession';
import { API_URL } from '../config/api';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function PromotionTeachersScreen() {
  const { theme } = useTheme();
  const { locale } = useLanguage();
  const isAr = locale === 'ar';
  
  const token = getAuthToken();

  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState([]);
  
  const levelMapping = {
    1: { year: isAr ? 'السنة الأولى' : 'Year 1', classes: 'الشاروبيم & السيرافيم' },
    2: { year: isAr ? 'السنة الثانية' : 'Year 2', classes: 'الملاك رفائيل & الملاك ميخائيل' },
    3: { year: isAr ? 'السنة الثالثة' : 'Year 3', classes: 'الملاك سوريال & الملاك غبريال' },
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await Axios.get(`${API_URL}/users`, { headers: { Authorization: token } });
      const staff = res.data.filter(u => u.role === 'teacher' || u.role === 'co-principal');
      setTeachers(staff);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flexGrow: 1, padding: 16, backgroundColor: theme.background },
    card: {
      backgroundColor: theme.cardBackground,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.borderColor,
      flexDirection: isAr ? 'row-reverse' : 'row',
      alignItems: 'center',
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.inputBackground,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: isAr ? 12 : 0,
      marginRight: isAr ? 0 : 12,
    },
    infoContainer: { flex: 1 },
    name: { fontSize: 16, fontWeight: 'bold', color: theme.text, textAlign: isAr ? 'right' : 'left' },
    role: { fontSize: 12, color: theme.textMuted, textAlign: isAr ? 'right' : 'left', marginBottom: 4 },
    assignmentBox: {
      marginTop: 8,
      backgroundColor: theme.inputBackground,
      padding: 8,
      borderRadius: 8,
    },
    yearText: { fontSize: 14, fontWeight: 'bold', color: theme.primary, textAlign: isAr ? 'right' : 'left' },
    classesText: { fontSize: 13, color: theme.text, textAlign: isAr ? 'right' : 'left', marginTop: 2 },
  });

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {teachers.map(t => {
        const mapping = levelMapping[t.assignedlevel] || { year: isAr ? 'غير محدد' : 'Unassigned', classes: '---' };
        return (
          <View key={t._id} style={styles.card}>
            <View style={styles.iconContainer}>
              <Ionicons name="person-outline" size={24} color={theme.iconColor} />
            </View>
            <View style={styles.infoContainer}>
              <Text style={styles.name}>{t.username}</Text>
              <Text style={styles.role}>{t.role === 'co-principal' ? (isAr ? 'أمين خدمة' : 'Co-Principal') : (isAr ? 'خادم' : 'Teacher')}</Text>
              
              <View style={styles.assignmentBox}>
                <Text style={styles.yearText}>{mapping.year} (Level {t.assignedlevel})</Text>
                <Text style={styles.classesText}>{mapping.classes}</Text>
              </View>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}
