import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, FlatList, TextInput, Modal, Alert, KeyboardAvoidingView, ScrollView, ActivityIndicator } from 'react-native';
import Axios from 'axios';
import { API_URL } from '../config/api';
import { getAuthToken } from '../config/authSession';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLanguage } from '../utils/LanguageContext';

import SkeletonList from '../components/SkeletonLoader';
import { fetchWithCache, invalidateCache } from '../utils/apiCache';

import { useTheme } from '../utils/ThemeContext';
export default function TayoGiveScreen({ navigation }) {const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode);
  const { t } = useLanguage();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [selectedLevel, setSelectedLevel] = useState('All');
  const [selectedClass, setSelectedClass] = useState('All');
  const [sortBy, setSortBy] = useState('name'); 
  const [showSearch, setShowSearch] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [amount, setAmount] = useState('5');
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
    setAmount('5');
    setReason('');
    setModalVisible(true);
  };

  const submitTransaction = async () => {
    if (submitting) return;
    if (!amount || isNaN(amount) || parseInt(amount) <= 0) return Alert.alert(t('error'), t('invalidNumber'));

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
    <View style={[styles.container, { backgroundColor: theme.background }, { backgroundColor: theme.background }]}>
      <View style={[styles.headerRow, { justifyContent: 'flex-end' }]}>
        <View style={{ flexDirection: t('isRtl') ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity style={styles.iconButton} onPress={() => setShowSearch(!showSearch)}>
            <Ionicons name="search-outline" size={20} color={theme.iconColor} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => setShowFilter(!showFilter)}>
            <Ionicons name={showFilter ? "filter" : "filter-outline"} size={20} color={theme.iconColor} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => setShowSort(!showSort)}>
            <Ionicons name={showSort ? "list" : "list-outline"} size={20} color={theme.iconColor} />
          </TouchableOpacity>
        </View>
      </View>

      {showSearch && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={theme.iconColor} style={styles.searchIcon} />
          <TextInput 
            style={styles.searchInput} 
            placeholder={t('searchStudent')} 
            placeholderTextColor={theme.textMuted}
            value={search} 
            onChangeText={setSearch} 
          />
        </View>
      )}

      {showSort && (
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
        </View>
      )}

      {showFilter && (
        <View style={styles.filtersSection}>

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
      )}
      {loading ? (
        <SkeletonList count={6} style={{ padding: 16 }} />
      ) : (
        <FlatList
          data={filteredAndSorted}
          keyExtractor={item => item._id}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }]} onPress={() => openModal(item)}>
              <View style={styles.cardLeft}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={24} color={theme.iconColor} />
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
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Ionicons name="gift" size={28} color={theme.iconColor} />
              <Text style={[styles.modalTitle, { color: theme.text }, { color: theme.text }]}>{t('giveTayo')}</Text>
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

const getStyles = (theme, isDarkMode) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 15,
    paddingHorizontal: 15,
  },
  iconButton: {
    backgroundColor: 'rgba(47, 67, 96, 0.06)',
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.borderColor,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.cardBackground, marginHorizontal: 15, marginBottom: 15, borderRadius: 12, paddingHorizontal: 15, borderWidth: 1, borderColor: theme.borderColor },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: theme.text, textAlign: 'right', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  filtersSection: { paddingHorizontal: 15, paddingBottom: 10, borderBottomWidth: 1, borderColor: theme.borderColor },
  filterScroll: { flexDirection: 'row', marginBottom: 12 },
  filterLabel: { color: theme.text, fontWeight: 'bold', alignSelf: 'center', marginRight: 10, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  pill: { backgroundColor: theme.cardBackground, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: theme.borderColor },
  pillActive: { backgroundColor: theme.primary, borderColor: '#2f4360' },
  pillText: { color: theme.text, fontWeight: '600' },
  pillTextActive: { color: '#fff' },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fffcf7', marginHorizontal: 15, marginTop: 12, padding: 15, borderRadius: 16, borderWidth: 1, borderColor: theme.borderColor, ...Platform.select({ ios: { shadowColor: '#2f4360', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8 }, android: { elevation: 3 } }) },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  infoWrapper: { flex: 1 },
  name: { fontSize: 16, fontWeight: 'bold', color: theme.text, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }), flexWrap: 'wrap' },
  info: { fontSize: 12, color: '#7f8c8d', marginTop: 4 },
  cardRight: { alignItems: 'center', paddingLeft: 10, borderLeftWidth: 1, borderColor: theme.borderColor, minWidth: 60 },
  balanceLabel: { fontSize: 10, color: '#7f8c8d', marginBottom: 2 },
  balance: { fontSize: 20, fontWeight: 'bold', color: '#f39c12' },
  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#fffcf7', padding: 25, borderTopLeftRadius: 25, borderTopRightRadius: 25, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 10 }, android: { elevation: 10 } }) },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: theme.text, marginLeft: 8, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  modalSubtitle: { fontSize: 16, color: '#7f8c8d', textAlign: 'center', marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: 'bold', color: theme.text, marginBottom: 6, textAlign: 'right' },
  input: { backgroundColor: theme.cardBackground, borderWidth: 1, borderColor: theme.borderColor, borderRadius: 12, padding: 12, marginBottom: 15, textAlign: 'right', fontSize: 16, color: theme.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  btn: { flex: 1, padding: 15, borderRadius: 12, alignItems: 'center', marginHorizontal: 5 },
  cancel: { backgroundColor: '#ebe6da' },
  cancelBtnText: { color: theme.text, fontWeight: 'bold', fontSize: 16 },
  save: { backgroundColor: theme.primary },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
