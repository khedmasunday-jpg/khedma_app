import React, { useEffect, useState } from 'react';
import { View, Text, Button, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import axios from 'axios';
import { getAuthToken } from '../config/authSession';
import { createApiClient } from '../config/api';
import { logger } from '../utils/logger';

export default function AssignStudentsScreen1({ navigation, route }) {
  const { token: routeToken } = route.params || {};
  const token = routeToken || getAuthToken();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    logger.log('Token in AssignStudentsScreen1:', token);
    const client = createApiClient(token);

    // First fetch the DB user record so we can confirm the server-side assignedlevel
    client.get('/auth/me')
      .then(userRes => {
        if (!mounted) return;
        logger.log('Auth /me response:', userRes.data);
      })
      .catch(err => {
        logger.warn('/auth/me failed:', err?.response?.data || err.message || err);
      })
      .finally(() => {
        // Then fetch the teachers list
        client.get('/classes/co-principal/teachers')
          .then(res => {
            if (!mounted) return;
            logger.log('Raw API response:', res.data);
        // Try to decode token payload for debugging, but do so safely
        try {
          if (typeof atob !== 'undefined') {
            const payload = JSON.parse(atob(token.split('.')[1]));
            logger.log('User role from token:', payload.role);
            logger.log('User assignedlevel from token:', payload.assignedlevel);
          } else {
            logger.log('Token payload decode not available in this environment');
          }
        } catch (e) {
          logger.log('Token decode failed:', e?.message || e);
        }
        setTeachers(Array.isArray(res.data) ? res.data : []);
          })
      .catch((err) => {
        logger.error('Failed to fetch teachers:', err?.response || err);
        logger.error('Error details:', {
          status: err?.response?.status,
          statusText: err?.response?.statusText,
          data: err?.response?.data,
          headers: err?.response?.headers
        });
        const msg = err?.response?.data?.msg || err?.message || 'Failed to fetch teachers';
        Alert.alert('Error', msg);
      })
          .finally(() => {
            if (mounted) setLoading(false);
          });
      });

    return () => { mounted = false; };
  }, [token]);

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 16 }}>Select a Teacher</Text>
      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop: 20 }} />
      ) : teachers.length === 0 ? (
        <View style={{ alignItems: 'center', marginTop: 20 }}>
          <Text style={{ color: '#666', marginBottom: 10 }}>No teachers found in your assigned level</Text>
          <Button title="Retry" onPress={() => {
            setLoading(true);
            const client = createApiClient(token);
            client.get('/classes/co-principal/teachers')
              .then(res => {
                logger.log('Teachers response:', res.data);
                setTeachers(Array.isArray(res.data) ? res.data : []);
              })
              .catch((err) => {
                logger.error('Failed to fetch teachers:', err?.response || err);
                const msg = err?.response?.data?.msg || err?.message || 'Failed to fetch teachers';
                Alert.alert('Error', msg);
              })
              .finally(() => setLoading(false));
          }} />
        </View>
      ) : (
        <ScrollView>
          {teachers.map(teacher => (
            <TouchableOpacity
              key={teacher._id}
              style={{ padding: 16, backgroundColor: '#eee', borderRadius: 8, marginBottom: 12 }}
              onPress={() => navigation.navigate('AssignStudentsScreen2', { token, teacher })}
            >
              <Text style={{ fontSize: 16 }}>{teacher.fullName}</Text>
              {teacher.assignedClass && (
                <Text style={{ color: '#666', marginTop: 4, fontSize: 14 }}>
                  Class: {teacher.assignedClass}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
