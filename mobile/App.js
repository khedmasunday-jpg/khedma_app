import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ImageBackground, View, Platform, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { LanguageProvider, useLanguage } from './src/utils/LanguageContext';
import { ThemeProvider, useTheme } from './src/utils/ThemeContext';
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
      height: 100dvh !important;
    }
    select option {
      color: #000000 !important;
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
  const { theme, isDarkMode, toggleTheme } = useTheme();

  const CustomBackButton = ({ onPress, canGoBack }) => {
    if (!canGoBack) return null;
    return (
      <TouchableOpacity
        onPress={onPress}
        style={{
          marginLeft: 15,
          width: 44,
          height: 44,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.inputBackground,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: theme.borderColor,
          ...Platform.select({
            web: { boxShadow: `0 2px 4px ${theme.shadowColor}10`, cursor: 'pointer' },
            ios: { shadowColor: theme.shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3 },
            android: { elevation: 2 },
          }),
        }}
      >
        <Ionicons name="arrow-back-outline" size={22} color={theme.iconColor} />
      </TouchableOpacity>
    );
  };

  return (
    <Stack.Navigator 
      initialRouteName="Login"
      screenOptions={({ navigation }) => ({ 
        headerStyle: {
          backgroundColor: theme.headerBackground,
          borderBottomWidth: 1,
          borderBottomColor: theme.borderColor,
        },
        headerTintColor: theme.text,
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
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 15, gap: 10 }}>
            <TouchableOpacity 
              onPress={toggleTheme} 
              style={{ 
                width: 44,
                height: 44,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: theme.inputBackground, 
                borderRadius: 24,
                borderWidth: 1,
                borderColor: theme.borderColor,
                ...Platform.select({
                  ios: { shadowColor: theme.shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3 },
                  android: { elevation: 2 },
                  web: { boxShadow: `0 2px 4px ${theme.shadowColor}10` }
                }),
              }}
            >
              <Ionicons name={isDarkMode ? "sunny-outline" : "moon-outline"} size={22} color={theme.iconColor} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={toggleLanguage} 
              style={{ 
                width: 44,
                height: 44,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: theme.inputBackground, 
                borderRadius: 24,
                borderWidth: 1,
                borderColor: theme.borderColor,
                ...Platform.select({
                  ios: { shadowColor: theme.shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3 },
                  android: { elevation: 2 },
                  web: { boxShadow: `0 2px 4px ${theme.shadowColor}10` }
                }),
              }}
            >
              <Ionicons name="globe-outline" size={22} color={theme.iconColor} />
            </TouchableOpacity>
          </View>
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
      <Stack.Screen name="TayoScreen" component={TayoScreen} options={{ title: t('tayo') || 'الطايو' }} />
      <Stack.Screen name="TayoGiveScreen" component={TayoGiveScreen} options={{ title: t('giveTayo') || 'إعطاء الطايو' }} />
      <Stack.Screen name="TayoDisplayScreen" component={TayoDisplayScreen} options={{ title: t('displayDeductTayo') || 'عرض و خصم الطايو' }} />
      <Stack.Screen name="BackupScreen" component={BackupScreen} options={{ title: t('backupData') || 'النسخ الاحتياطي' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ThemeProvider>
          <LanguageProvider>
          <View style={styles.rootView}>
            <ImageBackground 
              source={require('./assets/pattern.webp')} 
              style={styles.backgroundImage}
              resizeMode="cover"
            >
              <View style={{ flex: 1 }}>
                <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom', 'left', 'right']}>
                  <NavigationContainer theme={MyTheme}>
                    <AppNavigator />
                  </NavigationContainer>
                </SafeAreaView>
              </View>
            </ImageBackground>
          </View>
          </LanguageProvider>
        </ThemeProvider>
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