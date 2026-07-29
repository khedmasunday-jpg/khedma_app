import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, FlatList, TextInput, Modal, Alert, KeyboardAvoidingView, ScrollView } from 'react-native';
import Axios from 'axios';
import { API_URL } from '../config/api';
import { getAuthToken } from '../config/authSession';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLanguage } from '../utils/LanguageContext';

export default function TayoDisplayScreen({ navigation }) {
  const { t, locale } = useLanguage();
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  
  const [selectedLevel, setSelectedLevel] = useState('All');
  const [selectedClass, setSelectedClass] = useState('All');
  const [sortBy, setSortBy] = useState('balance'); 

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('logs'); 
  const [logs, setLogs] = useState([]);
  
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const token = getAuthToken();
      const res = await Axios.get(`${API_URL}/tayo/students`, { headers: { Authorization: token } });
      setStudents(res.data);
    } catch (err) {
      console.error(err);
    }
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

  const openModal = async (student) => {
    setSelectedStudent(student);
    setAmount('');
    setReason('');
    setActiveTab('logs');
    setModalVisible(true);
    fetchLogs(student._id);
  };

  const fetchLogs = async (id) => {
    try {
      const token = getAuthToken();
      const res = await Axios.get(`${API_URL}/tayo/logs/${id}`, { headers: { Authorization: token } });
      setLogs(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const submitDeduct = async () => {
    if (!amount || isNaN(amount) || parseInt(amount) <= 0) return Alert.alert(t('error'), t('invalidNumber'));

    try {
      const token = getAuthToken();
      await Axios.post(`${API_URL}/tayo/transaction`, {
        studentId: selectedStudent._id,
        amount: -parseInt(amount), 
        reason
      }, { headers: { Authorization: token } });
      
      Alert.alert(t('success'), t('tayoDeductSuccess'));
      fetchStudents();
      fetchLogs(selectedStudent._id);
      setAmount('');
      setReason('');
      setActiveTab('logs');
    } catch (err) {
      Alert.alert(t('error'), t('tayoDeductError'));
    }
  };

  return (
    <View style={styles.container}>
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
              <Text style={[styles.balance, { color: item.tayoBalance < 0 ? '#e74c3c' : '#f39c12' }]}>{item.tayoBalance || 0}</Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
          <View style={styles.modalContent}>
            
            <View style={styles.modalHeaderInfo}>
              <Text style={styles.modalTitle}>{selectedStudent?.fullName}</Text>
              <Text style={[styles.modalBalance, { color: (selectedStudent?.tayoBalance || 0) < 0 ? '#e74c3c' : '#f39c12' }]}>
                {selectedStudent?.tayoBalance || 0}
              </Text>
            </View>
            
            <View style={styles.tabRow}>
              <TouchableOpacity style={[styles.tabBtn, activeTab === 'logs' && styles.activeTab]} onPress={() => setActiveTab('logs')}>
                <Text style={[styles.tabText, activeTab === 'logs' && styles.activeTabText]}>{t('logsTab')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabBtn, activeTab === 'deduct' && styles.activeTab]} onPress={() => setActiveTab('deduct')}>
                <Text style={[styles.tabText, activeTab === 'deduct' && styles.activeTabText]}>{t('deductTayo')}</Text>
              </TouchableOpacity>
            </View>

            {activeTab === 'logs' ? (
              <FlatList
                data={logs}
                keyExtractor={item => item._id}
                style={{maxHeight: 300, marginTop: 10}}
                renderItem={({ item }) => (
                  <View style={styles.logCard}>
                    <View style={styles.logIconWrapper}>
                      <Ionicons name={item.amount > 0 ? "arrow-up-circle" : "arrow-down-circle"} size={24} color={item.amount > 0 ? '#2ecc71' : '#e74c3c'} />
                    </View>
                    <View style={styles.logDetails}>
                      <Text style={styles.logReason}>{item.reason}</Text>
                      <Text style={styles.logDate}>{new Date(item.date).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US')} • {item.givenBy?.name}</Text>
                    </View>
                    <Text style={[styles.logAmount, { color: item.amount > 0 ? '#2ecc71' : '#e74c3c' }]}>
                      {item.amount > 0 ? '+' : ''}{item.amount}
                    </Text>
                  </View>
                )}
                ListEmptyComponent={<Text style={{textAlign: 'center', marginTop: 20, color: '#7f8c8d'}}>{t('noLogs')}</Text>}
              />
            ) : (
              <View style={{marginTop: 20}}>
                <Text style={styles.inputLabel}>{t('amountToDeduct')}</Text>
                <TextInput style={styles.input} placeholder="5" keyboardType="numeric" value={amount} onChangeText={setAmount} />
                <Text style={styles.inputLabel}>{t('reasonPlaceholder')}</Text>
                <TextInput style={styles.input} placeholder={t('reasonPlaceholder')} value={reason} onChangeText={setReason} />
                <TouchableOpacity style={[styles.btn, styles.save]} onPress={submitDeduct}>
                  <Text style={styles.saveBtnText}>{t('confirmDeduct')}</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeModalText}>{t('closeModal')}</Text>
            </TouchableOpacity>
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
  balance: { fontSize: 20, fontWeight: 'bold' },
  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#fffcf7', padding: 25, borderTopLeftRadius: 25, borderTopRightRadius: 25, minHeight: '60%', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 10 }, android: { elevation: 10 } }) },
  modalHeaderInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 15, borderBottomWidth: 1, borderColor: 'rgba(47,67,96,0.1)' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#2f4360', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  modalBalance: { fontSize: 24, fontWeight: 'bold' },
  tabRow: { flexDirection: 'row', backgroundColor: 'rgba(47,67,96,0.05)', borderRadius: 12, padding: 4 },
  tabBtn: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#fff', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 }, android: { elevation: 1 } }) },
  tabText: { color: '#7f8c8d', fontWeight: 'bold', fontSize: 15 },
  activeTabText: { color: '#2f4360' },
  logCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: 'rgba(47,67,96,0.05)' },
  logIconWrapper: { marginRight: 12 },
  logDetails: { flex: 1 },
  logReason: { fontSize: 15, color: '#2f4360', fontWeight: '600' },
  logDate: { fontSize: 11, color: '#95a5a6', marginTop: 4 },
  logAmount: { fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
  inputLabel: { fontSize: 14, fontWeight: 'bold', color: '#2f4360', marginBottom: 6, textAlign: 'right' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(47,67,96,0.2)', borderRadius: 12, padding: 12, marginBottom: 15, textAlign: 'right', fontSize: 16, color: '#2f4360' },
  btn: { padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  save: { backgroundColor: '#e74c3c' },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  closeModalBtn: { marginTop: 20, padding: 15, alignItems: 'center', backgroundColor: '#ebe6da', borderRadius: 12 },
  closeModalText: { color: '#2f4360', fontWeight: 'bold', fontSize: 16 }
});
