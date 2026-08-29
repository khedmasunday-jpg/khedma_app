import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../utils/ThemeContext';
import { useLanguage } from '../utils/LanguageContext';
import Axios from 'axios';
import { getAuthToken } from '../config/authSession';
import { API_URL } from '../config/api';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function PromotionScreen({ navigation }) {
  const { theme, isDarkMode } = useTheme();
  const { locale } = useLanguage();
  const isAr = locale === 'ar';
  
  const token = getAuthToken();

  const handlePromote = async () => {
    Alert.alert(
      isAr ? 'تأكيد الترقية' : 'Confirm Promotion',
      isAr ? 'هل أنت متأكد من ترقية جميع الفصول وتصدير الخريجين؟' : 'Are you sure you want to promote all classes and export graduates?',
      [
        { text: isAr ? 'إلغاء' : 'Cancel', style: 'cancel' },
        { 
          text: isAr ? 'تأكيد' : 'Confirm', 
          onPress: async () => {
            try {
              if (Platform.OS === 'web') {
                const response = await Axios.post(`${API_URL}/promotion/promote-all`, {}, {
                  headers: { Authorization: token },
                  responseType: 'blob'
                });
                
                if (response.data.type === 'application/json') {
                   const text = await response.data.text();
                   const json = JSON.parse(text);
                   Alert.alert(isAr ? 'تمت الترقية' : 'Promoted', json.msg);
                   return;
                }

                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', 'graduates.xlsx');
                document.body.appendChild(link);
                link.click();
                link.remove();
                
                Alert.alert(isAr ? 'نجاح' : 'Success', isAr ? 'تمت الترقية وتحميل ملف الخريجين!' : 'Promoted and downloaded graduates!');
              } else {
                const fileUri = FileSystem.documentDirectory + 'graduates.xlsx';
                
                const response = await FileSystem.downloadAsync(
                  `${API_URL}/promotion/promote-all`,
                  fileUri,
                  { headers: { Authorization: token, 'Content-Type': 'application/json', 'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json' }, httpMethod: 'POST' }
                );

                if (response.headers['Content-Type']?.includes('application/json')) {
                   Alert.alert(isAr ? 'تمت الترقية' : 'Promoted', isAr ? 'تمت الترقية بنجاح. لا يوجد خريجون هذا العام.' : 'Promotion successful. No graduates this year.');
                   return;
                }
                
                if (await Sharing.isAvailableAsync()) {
                  await Sharing.shareAsync(fileUri);
                  Alert.alert(isAr ? 'نجاح' : 'Success', isAr ? 'تمت الترقية بنجاح!' : 'Promotion Successful!');
                }
              }
            } catch (err) {
              console.error('Promotion error:', err);
              Alert.alert('Error', 'Failed to run promotion');
            }
          }
        }
      ]
    );
  };

  const styles = StyleSheet.create({
    container: {
      flexGrow: 1,
      padding: 16,
      alignItems: 'center',
    },
    card: {
      width: '100%',
      maxWidth: 500,
      backgroundColor: theme.cardBackground,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.borderColor,
      ...Platform.select({
        web: { boxShadow: '0 4px 12px rgba(0,0,0,0.05)' },
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
        android: { elevation: 3 },
      }),
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: theme.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    instructions: {
      fontSize: 14,
      color: theme.textMuted,
      lineHeight: 22,
      textAlign: 'left',
      marginBottom: 20,
    },
    bold: {
      fontWeight: 'bold',
      color: theme.text,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.primary,
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      width: '100%',
    },
    buttonIcon: {
      marginRight: 12,
    },
    buttonTextContainer: {
      flex: 1,
    },
    buttonTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#fff',
      textAlign: 'left',
    },
    buttonSubtitle: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.8)',
      textAlign: 'left',
      marginTop: 2,
    },
  });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.headerTitle}>{isAr ? 'نظام الترقية للعام الجديد' : 'Annual Promotion System'}</Text>
        
        <Text style={styles.instructions}>
          {isAr ? 'دليل مسارات الترقية للمخدومين:' : 'Student Promotion Paths:'}
          {'\n'}- <Text style={styles.bold}>الشاروبيم</Text> ➡️ <Text style={styles.bold}>الملاك ميخائيل</Text> ➡️ <Text style={styles.bold}>الملاك غبريال</Text> (تخرج)
          {'\n'}- <Text style={styles.bold}>السيرافيم</Text> ➡️ <Text style={styles.bold}>الملاك رفائيل</Text> ➡️ <Text style={styles.bold}>الملاك سوريال</Text> (تخرج)
          {'\n\n'}
          {isAr ? 'دليل الخدام وأمناء الخدمة:' : 'Teachers & Co-Principals:'}
          {'\n'}- يتم تدويرهم بين المستويات <Text style={styles.bold}>1 ➡️ 2 ➡️ 3 ➡️ 1</Text> لتفريغ فصولهم للعام الجديد.
        </Text>

        <TouchableOpacity 
          style={styles.button} 
          onPress={() => navigation.navigate('SwitchStudentsScreen')}
        >
          <Ionicons name="people-circle-outline" size={32} color="#fff" style={styles.buttonIcon} />
          <View style={styles.buttonTextContainer}>
            <Text style={styles.buttonTitle}>{isAr ? 'نقل المخدومين بين فصول السنة الواحدة' : 'Switch Students Between Classes'}</Text>
            <Text style={styles.buttonSubtitle}>{isAr ? 'اختر السنة الدراسية وانقل المخدومين قبل تنفيذ الترقية' : 'Move students between the two classes of the same year before promoting'}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: '#e67e22' }]} 
          onPress={() => navigation.navigate('PromotionTeachersScreen')}
        >
          <Ionicons name="school-outline" size={32} color="#fff" style={styles.buttonIcon} />
          <View style={styles.buttonTextContainer}>
            <Text style={styles.buttonTitle}>{isAr ? 'الخدام و فصولهم' : 'Teachers & Classes'}</Text>
            <Text style={styles.buttonSubtitle}>{isAr ? 'استعراض الخدام وتوزيع فصولهم' : 'View teachers and their assigned years/classes'}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: '#27ae60' }]} 
          onPress={handlePromote}
        >
          <Ionicons name="trending-up-outline" size={32} color="#fff" style={styles.buttonIcon} />
          <View style={styles.buttonTextContainer}>
            <Text style={styles.buttonTitle}>{isAr ? 'تنفيذ الترقية الآن' : 'Execute Promotion'}</Text>
            <Text style={styles.buttonSubtitle}>{isAr ? 'تطبيق المسارات، تدوير الخدام، وتحميل ملف الخريجين' : 'Apply paths, rotate teachers, and download graduates Excel'}</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
