import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform, TextInput } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import { API_URL } from '../config/api';
import { getAuthToken, getAuthUser } from '../config/authSession';
import { logger } from '../utils/logger';
import { useLanguage } from '../utils/LanguageContext';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '../utils/ThemeContext';
export default function EditStudentListScreen({ route, navigation }) {const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode);
  const { token: routeToken, role } = route.params || {};
  const token = routeToken || getAuthToken();
  const { t, locale } = useLanguage();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [serverClasses, setServerClasses] = useState([]);
  const user = getAuthUser() || {};
  const userLevel = user.assignedlevel;

  const [selectedGrade, setSelectedGrade] = useState(userLevel ? String(userLevel) : '');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showFilter, setShowFilter] = useState(false);

  const isRtl = locale === 'ar';

  const fetchStudents = async () => {
    setLoading(true);
    try {
      logger.log('Fetching students...');
      const res = await axios.get(`${API_URL}/students/data`, { 
        headers: { 
          Authorization: token,
          'Content-Type': 'application/json'
        } 
      });
      setStudents(res.data);
    } catch (err) {
      logger.error('Error fetching students:', err);
      Alert.alert(t('error'), 'Failed to fetch students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchStudents);
    fetchStudents();
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await axios.get(`${API_URL}/classes`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setServerClasses(res.data || []);
      } catch (err) {
        logger.error('Error fetching classes:', err);
      }
    })();
  }, [token]);

  const filteredStudents = students.filter(student => {
    const matchesGrade = selectedGrade ? student.classLevel === Number(selectedGrade) : true;
    const matchesClass = selectedClass ? student.classname === selectedClass : true;
    const matchesSearch = searchQuery 
      ? (student.fullName && student.fullName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (student.googlecode && student.googlecode.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;
    return matchesGrade && matchesClass && matchesSearch;
  });

  const toggleSelect = (id) => {
    const updated = new Set(selectedStudentIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedStudentIds(updated);
  };

  const handleBulkDelete = () => {
    const deleteAction = async () => {
      try {
        setLoading(true);
        await axios.delete(`${API_URL}/students`, {
          headers: { 
            Authorization: token,
            'Content-Type': 'application/json'
          },
          data: { ids: Array.from(selectedStudentIds) }
        });
        Alert.alert(isRtl ? 'تم بنجاح' : 'Success', isRtl ? 'تم حذف المخدومين بنجاح.' : 'Students deleted successfully.');
        setSelectionMode(false);
        setSelectedStudentIds(new Set());
        fetchStudents();
      } catch (err) {
        logger.error('Error bulk deleting students:', err);
        Alert.alert(t('error'), isRtl ? 'فشل حذف المخدومين' : 'Failed to delete students');
      } finally {
        setLoading(false);
      }
    };

    Alert.alert(
      isRtl ? 'حذف مخدومين' : 'Delete Students',
      isRtl 
        ? `هل أنت متأكد من حذف ${selectedStudentIds.size} مخدوم نهائياً؟` 
        : `Are you sure you want to permanently delete ${selectedStudentIds.size} students?`,
      [
        { text: isRtl ? 'إلغاء' : 'Cancel', style: 'cancel' },
        { text: isRtl ? 'حذف' : 'Delete', style: 'destructive', onPress: deleteAction }
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }, { backgroundColor: theme.background }]}>
      <View style={[styles.headerRow, { flexDirection: 'row' }]}>
        <View />
        
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity style={styles.iconButton} onPress={() => setShowSearch(!showSearch)}>
            <Ionicons name="search-outline" size={20} color={theme.iconColor} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => setShowFilter(!showFilter)}>
            <Ionicons name={showFilter ? "filter" : "filter-outline"} size={20} color={theme.iconColor} />
          </TouchableOpacity>
          
          {(role === 'principal' || role === 'admin') && students.length > 0 && (
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => {
                setSelectionMode(!selectionMode);
                setSelectedStudentIds(new Set());
              }}
            >
              <Ionicons
                name={selectionMode ? "close-circle-outline" : "checkmark-circle-outline"}
                size={18}
                color={theme.iconColor}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.selectButtonText}>
                {selectionMode 
                  ? (isRtl ? 'إلغاء التحديد' : 'Cancel') 
                  : (isRtl ? 'تحديد' : 'Select')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {showSearch && (
        <View style={styles.searchContainer}>
          <View style={[styles.searchInputWrapper, { flexDirection: 'row' }]}>
            <Ionicons name="search-outline" size={20} color="rgba(47, 67, 96, 0.5)" style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { textAlign: 'left' }]}
              placeholder={t('searchStudent') || (isRtl ? 'بحث...' : 'Search...')}
              placeholderTextColor={theme.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Ionicons name="close-circle" size={18} color="rgba(47, 67, 96, 0.4)" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {showFilter && (
        <View style={styles.filterCard}>
        <Text style={[styles.filterTitle, { textAlign: 'left' }]}>
          {isRtl ? 'تصفية حسب الفصل:' : 'Filter by Class:'}
        </Text>
        
        <View style={[styles.pickerRow, { flexDirection: 'row' }]}>
          {}
          <View style={styles.pickerWrapper}>
            {Platform.OS === 'web' ? (
              <select
                value={selectedGrade}
                onChange={(e) => {
                  setSelectedGrade(e.target.value);
                  setSelectedClass('');
                }}
                style={StyleSheet.flatten([styles.webSelect, { direction: 'ltr' }])}
                disabled={!!userLevel}
              >
                {!userLevel && <option value="">{t('selectLevel')}</option>}
                {(!userLevel || userLevel === 1) && <option value="1">{t('level1')}</option>}
                {(!userLevel || userLevel === 2) && <option value="2">{t('level2')}</option>}
                {(!userLevel || userLevel === 3) && <option value="3">{t('level3')}</option>}
              </select>
            ) : (
              <Picker
                selectedValue={selectedGrade}
                onValueChange={(v) => {
                  setSelectedGrade(v);
                  setSelectedClass('');
                }}
                style={styles.nativePicker}
                dropdownIconColor="#2f4360"
                enabled={!userLevel}
              >
                {!userLevel && <Picker.Item label={t('selectLevel')} value="" />}
                {(!userLevel || userLevel === 1) && <Picker.Item label={t('level1')} value="1" />}
                {(!userLevel || userLevel === 2) && <Picker.Item label={t('level2')} value="2" />}
                {(!userLevel || userLevel === 3) && <Picker.Item label={t('level3')} value="3" />}
              </Picker>
            )}
          </View>

          {}
          <View style={styles.pickerWrapper}>
            {Platform.OS === 'web' ? (
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                disabled={!selectedGrade}
                style={StyleSheet.flatten([styles.webSelect, { direction: 'ltr' }])}
              >
                <option value="">{t('selectClass')}</option>
                {serverClasses
                  .filter((c) => c.year === Number(selectedGrade))
                  .map((c) => (
                    <option key={c._id} value={c.name}>{c.name}</option>
                  ))}
              </select>
            ) : (
              <Picker
                selectedValue={selectedClass}
                onValueChange={(v) => setSelectedClass(v)}
                enabled={!!selectedGrade}
                style={styles.nativePicker}
                dropdownIconColor="#2f4360"
              >
                <Picker.Item label={t('selectClass')} value="" />
                {serverClasses
                  .filter((c) => c.year === Number(selectedGrade))
                  .map((c) => (
                    <Picker.Item key={c._id} label={c.name} value={c.name} />
                  ))}
              </Picker>
            )}
          </View>
        </View>
      </View>
      )}
      
      {loading ? (
        <ActivityIndicator size="large" color={theme.iconColor} style={{ marginTop: 20 }} />
      ) : filteredStudents.length === 0 ? (
        <Text style={styles.noStudentsText}>
          {selectedGrade || selectedClass 
            ? (isRtl ? 'لا يوجد مخدومين في هذا الفصل' : 'No students found in this class') 
            : t('noStudents')}
        </Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: selectionMode && selectedStudentIds.size > 0 ? 80 : 0 }}>
          {filteredStudents.map(student => {
            const isSelected = selectedStudentIds.has(student._id);
            return (
              <TouchableOpacity
                key={student._id}
                style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }, selectionMode && isSelected && styles.selectedCard]}
                onPress={() => {
                  if (selectionMode) {
                    toggleSelect(student._id);
                  } else {
                    navigation.navigate('EditStudentDetailScreen', { studentId: student._id });
                  }
                }}
              >
                <View style={[styles.cardSelectionWrapper, { flexDirection: 'row' }]}>
                  {selectionMode && (
                    <View style={styles.checkboxContainer}>
                      <Ionicons 
                        name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
                        size={24} 
                        color={isSelected ? "#d32f2f" : "rgba(47, 67, 96, 0.3)"} 
                      />
                    </View>
                  )}
                  
                  <View style={{ flex: 1 }}>
                    <View style={[styles.cardHeader, { flexDirection: 'row' }]}>
                      <View style={[styles.infoWrapper, { alignItems: 'flex-start' }]}>
                        <Text style={styles.name}>{student.fullName}</Text>
                        <Text style={styles.level}>{t('gradeLevel')}: {student.classLevel}</Text>
                        <Text style={styles.classname}>{t('classDisplay')}: {student.classname}</Text>
                      </View>
                      {!selectionMode && (
                        <Ionicons 
                          name={isRtl ? "chevron-back" : "chevron-forward"} 
                          size={20} 
                          color="rgba(47, 67, 96, 0.4)" 
                        />
                      )}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {}
      {selectionMode && selectedStudentIds.size > 0 && (
        <View style={[styles.floatingActionBar, { flexDirection: 'row' }]}>
          <Text style={styles.selectedCountText}>
            {isRtl 
              ? `تم تحديد ${selectedStudentIds.size} مخدوم` 
              : `${selectedStudentIds.size} selected`}
          </Text>
          <TouchableOpacity style={styles.deleteBulkButton} onPress={handleBulkDelete}>
            <Ionicons name="trash-outline" size={18} color={theme.iconColor} style={{ marginRight: 6 }} />
            <Text style={styles.deleteBulkButtonText}>
              {isRtl ? 'حذف المحدد' : 'Delete Selected'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const getStyles = (theme, isDarkMode) => StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 16, 
    backgroundColor: theme.background 
  },
  title: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    marginBottom: 16,
    color: theme.text,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  noStudentsText: {
    textAlign: 'center',
    color: theme.textMuted,
    marginTop: 20,
    fontSize: 15,
  },
  card: { 
    backgroundColor: theme.cardBackground, 
    borderWidth: 1,
    borderColor: theme.borderColor,
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
    color: theme.text,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  level: { 
    fontSize: 14, 
    color: '#2e7d32', 
    marginTop: 6,
    fontWeight: '600',
  },
  classname: { 
    fontSize: 13, 
    color: theme.textMuted,
    marginTop: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
  searchContainer: {
    marginBottom: 16,
  },
  searchInputWrapper: {
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: theme.text,
    paddingVertical: 8,
  },
  clearButton: {
    padding: 4,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(47, 67, 96, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  selectButtonText: {
    color: theme.text,
    fontSize: 13,
    fontWeight: 'bold',
  },
  cardSelectionWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkboxContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCard: {
    borderColor: 'rgba(211, 47, 47, 0.3)',
    backgroundColor: 'rgba(211, 47, 47, 0.02)',
  },
  floatingActionBar: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(47, 67, 96, 0.95)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    ...Platform.select({
      web: {
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
      }
    }),
  },
  selectedCountText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  deleteBulkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d32f2f',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  deleteBulkButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  filterCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 8,
  },
  pickerRow: {
    gap: 10,
    justifyContent: 'space-between',
  },
  pickerWrapper: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 8,
    backgroundColor: theme.cardBackground,
    overflow: 'hidden',
  },
  webSelect: {
    width: '100%',
    padding: 8,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontSize: 14,
    color: theme.text,
    outlineStyle: 'none',
  },
  nativePicker: {
    width: '100%',
    height: 40,
  },
});
