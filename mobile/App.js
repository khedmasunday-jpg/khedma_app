import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ImageBackground, View, Platform, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { LanguageProvider, useLanguage } from './src/utils/LanguageContext';
import ErrorBoundary from './src/components/ErrorBoundary';

import { ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    body, html, #root {
      background-color: #ffffff !important;
      color-scheme: light !important;
    }
  `;
  document.head.appendChild(style);
}
import LoginScreen from './src/screens/LoginScreen';
import PostLoginScreen from './src/screens/PostLoginScreen';
import ClassDisplayScreen from './src/screens/ClassDisplayScreen';
import Takingattendance from './src/screens/Takingattendance';
import AttendanceSheetScreen from './src/screens/AttendanceSheetScreen';
import EditStaffListScreen from './src/screens/EditStaffListScreen';
import EditStaffDetailScreen from './src/screens/EditStaffDetailScreen';
import EditStudentListScreen from './src/screens/EditStudentListScreen';
import EditStudentDetailScreen from './src/screens/EditStudentDetailScreen';
import AddStudentsScreen from './src/screens/AddStudentsScreen';
import AddStaffScreen from './src/screens/AddStaffScreen';
import AssignStudentsScreen1 from './src/screens/AssignStudentsScreen1';
import AssignStudentsScreen2 from './src/screens/AssignStudentsScreen2';
import StaffListScreen from './src/screens/StaffListScreen';
import ActivateDeactivateScreen from './src/screens/ActivateDeactivateScreen';
import LogsScreen from './src/screens/LogsScreen';
import NotificationCenterScreen from './src/screens/NotificationCenterScreen';
import ResetDBScreen from './src/screens/ResetDBScreen';
import BirthdaysScreen from './src/screens/BirthdaysScreen';
import TelegramTestScreen from './src/screens/TelegramTestScreen';
import TayoScreen from './src/screens/TayoScreen';
import TayoGiveScreen from './src/screens/TayoGiveScreen';
import TayoDisplayScreen from './src/screens/TayoDisplayScreen';
import BackupScreen from './src/screens/BackupScreen';

try {
  const arabicAlert = require('./src/utils/arabicAlert');
  if (arabicAlert && arabicAlert.installArabicAlert) arabicAlert.installArabicAlert();
  try {
    if (typeof window !== 'undefined' && window.alert && arabicAlert.translate) {
      const oldWinAlert = window.alert;
      window.alert = function (msg) {
        try { return oldWinAlert(arabicAlert.translate(msg)); } catch (e) { return oldWinAlert(msg); }
      };
    }
  } catch (e) {}
} catch (e) {
  
}

const Stack = createStackNavigator();

const MyTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: 'transparent',
  },
};

function AppNavigator() {
  const { t, locale, toggleLanguage } = useLanguage();

  const CustomBackButton = ({ onPress, canGoBack }) => {
    if (!canGoBack) return null;
    return (
      <TouchableOpacity
        onPress={onPress}
        style={{
          marginLeft: 12,
          paddingVertical: 6,
          paddingHorizontal: 12,
          backgroundColor: '#ffffff',
          borderRadius: 14,
          borderWidth: 1,
          borderColor: 'rgba(47, 67, 96, 0.18)',
          flexDirection: 'row',
          alignItems: 'center',
          ...Platform.select({
            web: { boxShadow: '0 2px 4px rgba(47, 67, 96, 0.05)', cursor: 'pointer' },
            ios: { shadowColor: '#2f4360', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3 },
            android: { elevation: 2 },
          }),
        }}
      >
        <Text style={{ color: '#2f4360', fontWeight: 'bold', fontSize: 16, marginRight: 3 }}>←</Text>
        <Text style={{ color: '#2f4360', fontWeight: 'bold', fontSize: 13, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }) }}>
          {locale === 'ar' ? 'رجوع' : 'Back'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Stack.Navigator 
      initialRouteName="Login"
      screenOptions={({ navigation }) => ({ 
        headerStyle: {
          backgroundColor: '#efe5d2',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(47, 67, 96, 0.16)',
        },
        headerTintColor: '#2f4360',
        headerTitleStyle: {
          fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
          fontWeight: 'bold',
        },
        headerTitleAlign: 'center',
        headerBackVisible: false,
        headerLeft: ({ canGoBack }) => (
          <CustomBackButton
            canGoBack={canGoBack}
            onPress={() => navigation.goBack()}
          />
        ),
        headerRight: () => (
          <TouchableOpacity 
            onPress={toggleLanguage} 
            style={{ 
              marginRight: 15, 
              width: 44,
              height: 44,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: '#ffffff', 
              borderRadius: 24,
              borderWidth: 1,
              borderColor: 'rgba(47, 67, 96, 0.18)',
              ...Platform.select({
                ios: {
                  shadowColor: '#2f4360',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 3,
                },
                android: {
                  elevation: 2,
                },
                web: {
                  boxShadow: '0 2px 4px rgba(47, 67, 96, 0.05)',
                }
              }),
            }}
          >
            <Ionicons name="globe-outline" size={22} color="#2f4360" />
          </TouchableOpacity>
        ),
        cardStyle: { flex: 1, backgroundColor: 'transparent' } 
      })}
    >
      <Stack.Screen 
        name="Login" 
        component={LoginScreen} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="PostLogin" 
        component={PostLoginScreen} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="ClassDisplay" 
        component={ClassDisplayScreen} 
        options={{ title: t('classDisplay') }}
      />
      <Stack.Screen
        name="AttendanceSheet"
        component={AttendanceSheetScreen}
        options={{ title: t('attendanceSheet') }}
      />
      <Stack.Screen 
        name="TakingAttendance" 
        component={Takingattendance} 
        options={{ title: t('takeAttendance') }}
      />
      <Stack.Screen 
        name="EditStaffListScreen" 
        component={EditStaffListScreen} 
        options={{ title: t('editStaff') }}
      />
      <Stack.Screen 
        name="EditStaffDetailScreen" 
        component={EditStaffDetailScreen} 
        options={{ title: t('editStaff') }}
      />
      <Stack.Screen 
        name="EditStudentListScreen" 
        component={EditStudentListScreen} 
        options={{ title: t('editStudents') }}
      />
      <Stack.Screen 
        name="EditStudentDetailScreen" 
        component={EditStudentDetailScreen} 
        options={{ title: t('editStudents') }}
      />
      <Stack.Screen 
        name="AddStudentsScreen" 
        component={AddStudentsScreen} 
        options={{ title: t('addStudents') }}
      />
      <Stack.Screen 
        name="AddStaff" 
        component={AddStaffScreen} 
        options={{ title: t('addStaff') }}
      />
      <Stack.Screen 
        name="AssignStudentsScreen1" 
        component={AssignStudentsScreen1} 
        options={{ title: t('selectTeacher') }}
      />
      <Stack.Screen 
        name="AssignStudentsScreen2" 
        component={AssignStudentsScreen2} 
        options={{ title: t('assignStudents') }}
      />
      <Stack.Screen 
        name="StaffList" 
        component={StaffListScreen} 
        options={{ title: t('staffList') }}
      />
      <Stack.Screen 
        name="ActivateDeactivateScreen" 
        component={ActivateDeactivateScreen} 
        options={{ title: t('activateDeactivate') }}
      />
      <Stack.Screen 
        name="LogsScreen" 
        component={LogsScreen} 
        options={{ title: t('logs') }}
      />
      <Stack.Screen 
        name="NotificationCenter" 
        component={NotificationCenterScreen} 
        options={{ title: t('notifications') }}
      />
      <Stack.Screen
        name="ResetDB"
        component={ResetDBScreen}
        options={{ title: t('reset') }}
      />
      <Stack.Screen
        name="Birthdays"
        component={BirthdaysScreen}
        options={{ title: t('birthdays') }}
      />
      <Stack.Screen
        name="TelegramTestScreen"
        component={TelegramTestScreen}
        options={{ title: t('telegramTest') }}
      />
      <Stack.Screen name="TayoScreen" component={TayoScreen} options={{ title: 'طايو' }} />
      <Stack.Screen name="TayoGiveScreen" component={TayoGiveScreen} options={{ title: 'إعطاء طايو' }} />
      <Stack.Screen name="TayoDisplayScreen" component={TayoDisplayScreen} options={{ title: 'عرض / خصم طايو' }} />
      <Stack.Screen name="BackupScreen" component={BackupScreen} options={{ title: t('backupData') || 'النسخ الاحتياطي' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <LanguageProvider>
          <View style={styles.rootView}>
            <ImageBackground 
              source={require('./assets/pattern.webp')} 
              style={styles.backgroundImage}
              resizeMode="cover"
            >
              <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom', 'left', 'right']}>
                <NavigationContainer theme={MyTheme}>
                  <AppNavigator />
                </NavigationContainer>
              </SafeAreaView>
            </ImageBackground>
          </View>
        </LanguageProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  rootView: {
    flex: 1,
    width: '100%',
    minHeight: Platform.OS === 'web' ? '100vh' : '100%',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  }
});