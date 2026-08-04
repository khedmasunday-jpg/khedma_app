

import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, Alert, StyleSheet, Platform } from 'react-native';
import axios from 'axios';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLanguage } from '../utils/LanguageContext';
import { logger } from '../utils/logger';
import { setAuthToken } from '../config/authSession';
import { getApiBase } from '../config/api';

export default function LoginScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { t, locale, toggleLanguage } = useLanguage();

  const handleLogin = async () => {
    const deviceId = Device.osInternalBuildId || Device.deviceName || 'unknown';
    const base = getApiBase();
    const url = `${base}/auth/login`;
    try {
      const res = await axios.post(url, {
        username,
        password,
        deviceId,
      });

      logger.log("✅ Login response:", res.data);

      setAuthToken(res.data.token, res.data.user);

      navigation.navigate('PostLogin', { 
        token: res.data.token, 
        role: res.data.user.role,
        fullName: res.data.user.fullName,
        isClassLeader: res.data.user.isClassLeader || false
      });
    } catch (err) {
      if (err.response?.status === 429) {
        Alert.alert(
          locale === 'ar' ? 'تم تجاوز عدد المحاولات' : 'Too Many Attempts',
          locale === 'ar'
            ? 'لقد تجاوزت عدد محاولات الدخول المسموح بها. يرجى الانتظار 15 دقيقة والمحاولة مرة أخرى.'
            : 'Too many login attempts. Please wait 15 minutes and try again.'
        );
      } else {
        Alert.alert(
          locale === 'ar' ? 'فشل تسجيل الدخول' : 'Login Failed',
          locale === 'ar' ? 'اسم المستخدم أو كلمة المرور غير صحيحة' : 'Invalid username or password'
        );
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.langToggleContainer, { right: 20 }]}>
        <TouchableOpacity style={styles.langToggle} onPress={toggleLanguage}>
          <Ionicons name="globe-outline" size={22} color="#2f4360" />
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.logoContainer}>
          <View style={styles.logoWrap}>
            <Ionicons name="book-outline" size={48} color="#2f4360" />
          </View>
          <Text style={styles.title}>{locale === 'ar' ? 'خدمه اولي تانيه تالته ابتدائي الاحد' : 'Khedma 1-2-3 Sunday'}</Text>
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="person-outline" size={20} color="#2f4360" style={styles.inputIcon} />
          <TextInput 
            placeholder={t('username')} 
            placeholderTextColor="rgba(36, 54, 79, 0.4)"
            value={username} 
            onChangeText={setUsername} 
            autoCapitalize="none"
            style={styles.input}
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color="#2f4360" style={styles.inputIcon} />
          <TextInput 
            placeholder={t('password')} 
            placeholderTextColor="rgba(36, 54, 79, 0.4)"
            value={password} 
            onChangeText={setPassword} 
            secureTextEntry 
            style={styles.input}
          />
        </View>
        
        <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
          <Text style={styles.loginButtonText}>{t('login')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(243, 237, 224, 0.65)',
  },
  langToggleContainer: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 20 : 50,
    zIndex: 99,
  },
  langToggle: {
    backgroundColor: 'rgba(255, 252, 246, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.2)',
    borderRadius: 24,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#2f4360',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 4px 6px rgba(47, 67, 96, 0.1)',
      }
    }),
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(255, 252, 246, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.16)',
    borderRadius: 24,
    padding: 30,
    ...Platform.select({
      ios: {
        shadowColor: '#24364f',
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.18,
        shadowRadius: 44,
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: '0 18px 44px rgba(36, 54, 79, 0.18)',
      }
    }),
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoWrap: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#2f4360',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.18,
        shadowRadius: 30,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 14px 30px rgba(47, 67, 96, 0.18)',
      }
    }),
    marginBottom: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2f4360',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(36, 54, 79, 0.7)',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    color: '#24364f',
    fontSize: 16,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  loginButton: {
    width: '100%',
    height: 54,
    borderRadius: 27,
    backgroundColor: '#2f4360',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#2f4360',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.22,
        shadowRadius: 24,
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: '0 10px 24px rgba(47, 67, 96, 0.22)',
      }
    }),
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  cardLangToggle: {
    marginTop: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(47, 67, 96, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.1)',
  },
  cardLangToggleText: {
    color: '#2f4360',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
});

