import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLanguage } from '../utils/LanguageContext';

export default function TayoScreen({ navigation, route }) {
  const { role } = route.params || {};
  const { t } = useLanguage();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.buttonsContainer}>
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('TayoGiveScreen')}>
          <Ionicons name="gift-outline" size={32} color="#2f4360" style={styles.icon} />
          <Text style={styles.buttonText}>{t('giveTayo')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('TayoDisplayScreen')}>
          <Ionicons name="list-outline" size={32} color="#2f4360" style={styles.icon} />
          <Text style={styles.buttonText}>{t('displayDeductTayo')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, alignItems: 'center', backgroundColor: '#f3ede0' },
  header: { alignItems: 'center', marginVertical: 30 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#2f4360', marginTop: 10, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  buttonsContainer: { width: '100%', maxWidth: 400 },
  button: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffcf7',
    padding: 20, borderRadius: 15, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(47, 67, 96, 0.1)',
    ...Platform.select({
      ios: { shadowColor: '#2f4360', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 3 }, web: { boxShadow: '0 4px 8px rgba(47, 67, 96, 0.08)' }
    })
  },
  icon: { marginRight: 15 },
  buttonText: { fontSize: 18, fontWeight: 'bold', color: '#2f4360', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) }
});
