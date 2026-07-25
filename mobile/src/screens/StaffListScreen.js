import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import axios from 'axios';
import Constants from 'expo-constants';
import { logger } from '../utils/logger';
import { formatDateDDMMYYYY } from '../utils/dateFormatter';

import { getApiBase } from '../config/api';
import { getAuthToken } from '../config/authSession';

export default function StaffListScreen({ route }) {
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
    <View style={styles.container}>
      <Text style={styles.title}>Teachers & Stage Servants</Text>
      {loading ? <ActivityIndicator /> : (
        <ScrollView>
          {staff.map(user => (
            <View key={user._id} style={styles.card}>
              <Text style={styles.name}>{user.fullName}</Text>
              <Text style={styles.role}>{user.role === 'teacher' ? 'Teacher' : 'Stage Servant'}</Text>
              {/* Add any other non-sensitive fields you want to display */}
              {user.birthdate && <Text style={styles.info}>Birthdate: {formatDateNoYear(user.birthdate)}</Text>}
              {user.isActive !== undefined && <Text style={styles.info}>Active: {user.isActive ? 'Yes' : 'No'}</Text>}
              {/* Add more fields as needed */}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'transparent' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 16, marginBottom: 12, elevation: 2 },
  name: { fontSize: 18, fontWeight: 'bold' },
  role: { fontSize: 16, color: '#007bff', marginBottom: 4 },
  info: { fontSize: 14, color: '#555' },
});
