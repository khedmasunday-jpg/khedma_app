import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import axios from 'axios';
import Constants from 'expo-constants';
import { logger } from '../utils/logger';
import { formatDateDDMMYYYY } from '../utils/dateFormatter';

import { getApiBase } from '../config/api';
import { getAuthToken } from '../config/authSession';

import { useTheme } from '../utils/ThemeContext';
export default function StaffListScreen({ route }) {const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode);
  const { token: routeToken } = route.params || {};
  const token = routeToken || getAuthToken();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  const formatDateNoYear = (dateStr) => {
    return formatDateDDMMYYYY(dateStr);
  };

  useEffect(() => {
    const API_URL = `${getApiBase()}/users/staff-safe`;
    axios.get(API_URL, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setStaff(res.data))
      .catch((err) => {
        logger.error('Failed to fetch staff', {
          message: err.message,
          code: err.code,
          url: err.config && err.config.url,
          response: err.response && { status: err.response.status, data: err.response.data }
        });
        Alert.alert('Error', 'Failed to fetch staff');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }, { color: theme.text }]}>Teachers & Stage Servants</Text>
      {loading ? <ActivityIndicator /> : (
        <ScrollView>
          {staff.map(user => (
            <View key={user._id} style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }]}>
              <Text style={styles.name}>{user.fullName}</Text>
              <Text style={styles.role}>{user.role === 'teacher' ? 'Teacher' : 'Stage Servant'}</Text>
              {}
              {user.birthdate && <Text style={styles.info}>Birthdate: {formatDateNoYear(user.birthdate)}</Text>}
              {user.isActive !== undefined && <Text style={styles.info}>Active: {user.isActive ? 'Yes' : 'No'}</Text>}
              {}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const getStyles = (theme, isDarkMode) => StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'transparent' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  card: { backgroundColor: theme.cardBackground, borderRadius: 8, padding: 16, marginBottom: 12, elevation: 2 },
  name: { fontSize: 18, fontWeight: 'bold' },
  role: { fontSize: 16, color: '#007bff', marginBottom: 4 },
  info: { fontSize: 14, color: theme.textMuted },
});
