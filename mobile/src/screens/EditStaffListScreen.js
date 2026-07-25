import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import axios from 'axios';
import { API_URL } from '../config/api';
import { logger } from '../utils/logger';
import { useLanguage } from '../utils/LanguageContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getAuthToken } from '../config/authSession';

export default function EditStaffListScreen({ route, navigation }) {
  const { token: routeToken, role } = route.params || {};
  const token = routeToken || getAuthToken();
  const { t, locale } = useLanguage();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  const isRtl = locale === 'ar';

  const fetchStaff = async () => {
    setLoading(true);
    try {
      let res;
      if (role === 'admin') {
        res = await axios.get(`${API_URL}/users/staff`, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        res = await axios.get(`${API_URL}/users/staff-safe`, { headers: { Authorization: `Bearer ${token}` } });
      }
      setStaff(res.data);
    } catch (err) {
      Alert.alert(t('error'), 'Failed to fetch staff');
    }
    setLoading(false);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchStaff);
    fetchStaff();
    return unsubscribe;
  }, [navigation]);

  const getLocalizedRole = (r) => {
    switch (r) {
      case 'admin': return t('roleAdmin');
      case 'principal': return t('rolePrincipal');
      case 'co-principal': return t('roleCoPrincipal');
      case 'teacher': return t('roleTeacher');
      default: return r;
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('EditStaffDetailScreen', { token, role, userId: item._id })}
    >
      <View style={[styles.cardHeader, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
        <View style={[styles.infoWrapper, { alignItems: isRtl ? 'flex-end' : 'flex-start' }]}>
          <Text style={styles.name}>{item.fullName}</Text>
          <Text style={styles.roleLabel}>{getLocalizedRole(item.role)}</Text>
        </View>
        <Ionicons 
          name={isRtl ? "chevron-back" : "chevron-forward"} 
          size={20} 
          color="rgba(47, 67, 96, 0.4)" 
        />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { textAlign: isRtl ? 'right' : 'left' }]}>
        {t('editStaff')}
      </Text>
      {loading ? (
        <ActivityIndicator size="large" color="#2f4360" style={{ marginTop: 20 }} />
      ) : staff.length === 0 ? (
        <Text style={styles.noStaffText}>No staff found.</Text>
      ) : (
        <FlatList
          data={staff}
          renderItem={renderItem}
          keyExtractor={item => item._id}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 16, 
    backgroundColor: 'rgba(243, 237, 224, 0.75)' 
  },
  title: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    marginBottom: 16,
    color: '#2f4360',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  noStaffText: {
    textAlign: 'center',
    color: 'rgba(36, 54, 79, 0.6)',
    marginTop: 20,
    fontSize: 15,
  },
  card: { 
    backgroundColor: 'rgba(255, 252, 246, 0.95)', 
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.12)',
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#24364f',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 4px 6px rgba(36, 54, 79, 0.05)',
      }
    }),
  },
  cardHeader: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoWrapper: {
    flex: 1,
  },
  name: { 
    fontSize: 17, 
    fontWeight: 'bold',
    color: '#2f4360',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  roleLabel: { 
    fontSize: 13, 
    color: '#2e7d32', 
    marginTop: 6,
    fontWeight: '600',
  },
});