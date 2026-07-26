import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, FlatList, TextInput, Modal, Alert, KeyboardAvoidingView, ScrollView, ActivityIndicator } from 'react-native';
import Axios from 'axios';
import { API_URL } from '../config/api';
import { getAuthToken } from '../config/authSession';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLanguage } from '../utils/LanguageContext';

import SkeletonList from '../components/SkeletonLoader';
import { fetchWithCache, invalidateCache } from '../utils/apiCache';

export default function TayoGiveScreen({ navigation }) {
  const { t } = useLanguage();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [selectedLevel, setSelectedLevel] = useState('All');
  const [selectedClass, setSelectedClass] = useState('All');
  const [sortBy, setSortBy] = useState('name'); 

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const data = await fetchWithCache(`${API_URL}/tayo/students`, { headers: { Authorization: token } });
      setStudents(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const availableLevels = useMemo(() => {
    const levels = [...new Set(students.map(s => s.classLevel).filter(Boolean))].sort((a,b) => a - b);
    return ['All', ...levels];
  }, [students]);

  const availableClasses = useMemo(() => {
    const classes = [...new Set(students.map(s => s.classname).filter(Boolean))];
    return ['All', ...classes];
  }, [students]);

  const filteredAndSorted = useMemo(() => {
    let result = students;

    if (search) {
      result = result.filter(s => s.fullName && s.fullName.toLowerCase().includes(search.toLowerCase()));
    }
    if (selectedLevel !== 'All') {
      result = result.filter(s => s.classLevel === selectedLevel);
    }
    if (selectedClass !== 'All') {
      result = result.filter(s => s.classname === selectedClass);
    }

    result.sort((a, b) => {
      if (sortBy === 'balance') {
        return (b.tayoBalance || 0) - (a.tayoBalance || 0);
      } else {
        return (a.fullName || '').localeCompare(b.fullName || '', 'ar');
      }
    });

    return result;
  }, [students, search, selectedLevel, selectedClass, sortBy]);

  const openModal = (student) => {
    setSelectedStudent(student);
    setAmount('');
    setReason('');
    setModalVisible(true);
  };

  const submitTransaction = async () => {
    if (submitting) return;
    if (!amount || isNaN(amount) || parseInt(amount) <= 0) return Alert.alert(t('error'), t('invalidNumber'));
    if (!reason.trim()) return Alert.alert(t('error'), t('reasonRequired'));

    setSubmitting(true);
    const addVal = parseInt(amount);
    const targetId = selectedStudent._id;
    const previousStudents = [...students];

    setStudents(prev => prev.map(s => s._id === targetId ? { ...s, tayoBalance: (s.tayoBalance || 0) + addVal } : s));

    try {
      const token = getAuthToken();
      await Axios.post(`${API_URL}/tayo/transaction`, {
        studentId: targetId,
        amount: addVal,
        reason
      }, { headers: { Authorization: token } });
      
      invalidateCache('tayo/students');
      setModalVisible(false);
      Alert.alert(t('success'), t('tayoAddedSuccess'));
    } catch (err) {
      setStudents(previousStudents);
      Alert.alert(t('error'), t('tayoAddError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#2f4360" style={styles.searchIcon} />
        <TextInput 
          style={styles.searchInput} 
          placeholder={t('searchStudent')} 
          placeholderTextColor="rgba(47, 67, 96, 0.5)"
          value={search} 
          onChangeText={setSearch} 
        />
      </View>

      {}
      <View style={styles.filtersSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <Text style={styles.filterLabel}>{t('sortBy')}</Text>
          <TouchableOpacity style={[styles.pill, sortBy === 'name' && styles.pillActive]} onPress={() => setSortBy('name')}>
            <Text style={[styles.pillText, sortBy === 'name' && styles.pillTextActive]}>{t('alphabetical')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.pill, sortBy === 'balance' && styles.pillActive]} onPress={() => setSortBy('balance')}>
            <Text style={[styles.pillText, sortBy === 'balance' && styles.pillTextActive]}>{t('balance')}</Text>
          </TouchableOpacity>
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <Text style={styles.filterLabel}>{t('level')}</Text>
          {availableLevels.map(lvl => (
            <TouchableOpacity key={lvl} style={[styles.pill, selectedLevel === lvl && styles.pillActive]} onPress={() => setSelectedLevel(lvl)}>
              <Text style={[styles.pillText, selectedLevel === lvl && styles.pillTextActive]}>{lvl === 'All' ? t('all') : `${t('levelPrefix')}${lvl}`}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <Text style={styles.filterLabel}>{t('classFilter')}</Text>
          {availableClasses.map(cls => (
            <TouchableOpacity key={cls} style={[styles.pill, selectedClass === cls && styles.pillActive]} onPress={() => setSelectedClass(cls)}>
              <Text style={[styles.pillText, selectedClass === cls && styles.pillTextActive]}>{cls === 'All' ? t('all') : cls}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      {loading ? (
        <SkeletonList count={6} style={{ padding: 16 }} />
      ) : (
        <FlatList
          data={filteredAndSorted}
          keyExtractor={item => item._id}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => openModal(item)}>
              <View style={styles.cardLeft}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={24} color="#f3ede0" />
                </View>
                <View style={styles.infoWrapper}>
                  <Text style={styles.name}>{item.fullName}</Text>
                  <Text style={styles.info}>{item.classname} {item.classLevel ? `- ${t('levelPrefix')}${item.classLevel}` : ''}</Text>
                </View>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.balanceLabel}>{t('balance')}</Text>
                <Text style={styles.balance}>{item.tayoBalance || 0}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="gift" size={28} color="#2f4360" />
              <Text style={styles.modalTitle}>{t('giveTayo')}</Text>
            </View>
            <Text style={styles.modalSubtitle}>{selectedStudent?.fullName}</Text>
            
            <Text style={styles.inputLabel}>{t('amountToGive')}</Text>
            <TextInput style={styles.input} placeholder="5" keyboardType="numeric" value={amount} onChangeText={setAmount} />
            
            <Text style={styles.inputLabel}>{t('reasonPlaceholder')}</Text>
            <TextInput style={styles.input} placeholder={t('reasonPlaceholder')} value={reason} onChangeText={setReason} />
            
            <View style={styles.row}>
              <TouchableOpacity style={[styles.btn, styles.cancel]} onPress={() => setModalVisible(false)} disabled={submitting}>
                <Text style={styles.cancelBtnText}>{t('cancelBtn')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.save, submitting && { opacity: 0.7 }]} onPress={submitTransaction} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>{t('giveBtn')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3ede0' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 15, borderRadius: 12, paddingHorizontal: 15, borderWidth: 1, borderColor: 'rgba(47,67,96,0.1)' },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#2f4360', textAlign: 'right', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  filtersSection: { paddingHorizontal: 15, paddingBottom: 10, borderBottomWidth: 1, borderColor: 'rgba(47,67,96,0.05)' },
  filterScroll: { flexDirection: 'row', marginBottom: 12 },
  filterLabel: { color: '#2f4360', fontWeight: 'bold', alignSelf: 'center', marginRight: 10, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  pill: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: 'rgba(47,67,96,0.1)' },
  pillActive: { backgroundColor: '#2f4360', borderColor: '#2f4360' },
  pillText: { color: '#2f4360', fontWeight: '600' },
  pillTextActive: { color: '#fff' },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fffcf7', marginHorizontal: 15, marginTop: 12, padding: 15, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(47,67,96,0.1)', ...Platform.select({ ios: { shadowColor: '#2f4360', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8 }, android: { elevation: 3 } }) },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2f4360', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  infoWrapper: { flex: 1 },
  name: { fontSize: 16, fontWeight: 'bold', color: '#2f4360', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }), flexWrap: 'wrap' },
  info: { fontSize: 12, color: '#7f8c8d', marginTop: 4 },
  cardRight: { alignItems: 'center', paddingLeft: 10, borderLeftWidth: 1, borderColor: 'rgba(47,67,96,0.1)', minWidth: 60 },
  balanceLabel: { fontSize: 10, color: '#7f8c8d', marginBottom: 2 },
  balance: { fontSize: 20, fontWeight: 'bold', color: '#f39c12' },
  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#fffcf7', padding: 25, borderTopLeftRadius: 25, borderTopRightRadius: 25, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 10 }, android: { elevation: 10 } }) },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#2f4360', marginLeft: 8, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  modalSubtitle: { fontSize: 16, color: '#7f8c8d', textAlign: 'center', marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: 'bold', color: '#2f4360', marginBottom: 6, textAlign: 'right' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(47,67,96,0.2)', borderRadius: 12, padding: 12, marginBottom: 15, textAlign: 'right', fontSize: 16, color: '#2f4360' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  btn: { flex: 1, padding: 15, borderRadius: 12, alignItems: 'center', marginHorizontal: 5 },
  cancel: { backgroundColor: '#ebe6da' },
  cancelBtnText: { color: '#2f4360', fontWeight: 'bold', fontSize: 16 },
  save: { backgroundColor: '#2f4360' },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
