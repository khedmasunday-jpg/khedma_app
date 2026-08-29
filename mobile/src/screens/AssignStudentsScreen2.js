import React, { useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import axios from 'axios';
import { createApiClient } from '../config/api';
import { logger } from '../utils/logger';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLanguage } from '../utils/LanguageContext';
import { getAuthToken } from '../config/authSession';

import { useTheme } from '../utils/ThemeContext';
const localTranslations = {
  en: {
    assignTo: "Assign Students to",
    currentlyAssigned: "Currently assigned:",
    students: "students",
    student: "student",
    unassignAll: "Unassign All Students",
    resetClass: "Reset This Teacher's Class",
    masterReset: "Reset All Teachers (Master)",
    removeSelected: "Remove Selected Assigned Students",
    availableTitle: "Available Students to Assign:",
    selectedCount: "selected",
    noAvailable: "No available students to assign",
    assignSelected: "Assign Selected Students",
    searchPlaceholder: "Search students by name...",
    adminActions: "Administrative Actions",
    confirmResetClass: "Reset this CLASS (all teachers in the class) will unassign all students from that class and move them back to Unassigned. Proceed?",
    confirmMasterReset: "This will unassign ALL students from all teachers and move everyone back to Unassigned. This action cannot be undone. Proceed?",
    resetComplete: "Reset complete",
    unassignedSuccess: "All students have been unassigned and moved back to available list!",
    removedSuccess: "Removed selected student(s) from this teacher",
    assignedSuccess: "Students assigned successfully!",
    noSelectedError: "Please select at least one student first",
    invalidIdsError: "Selected students do not contain valid DB ids. Please re-open the list and try again.",
    noSelectedRemoveError: "No students selected to remove",
    notAssignedRemoveError: "Selected students are not assigned to this teacher",
    resetClassTitle: "Confirm Reset Class",
    resetAllTitle: "Confirm Master Reset",
  },
  ar: {
    assignTo: "توزيع المخدومين على",
    currentlyAssigned: "الموزعين حالياً:",
    students: "مخدومين",
    student: "مخدوم",
    unassignAll: "إلغاء توزيع جميع المخدومين",
    resetClass: "إعادة ضبط فصل هذا الخادم",
    masterReset: "إعادة ضبط جميع الخدام (الكل)",
    removeSelected: "إزالة المخدومين الموزعين المحددين",
    availableTitle: "المخدومين المتاحين للتوزيع:",
    selectedCount: "محدد",
    noAvailable: "لا يوجد مخدومين متاحين للتوزيع",
    assignSelected: "توزيع المخدومين المحددين",
    searchPlaceholder: "بحث عن مخدوم بالاسم...",
    adminActions: "إجراءات التحكم الإدارية",
    confirmResetClass: "إعادة ضبط هذا الفصل (جميع الخدام في هذا الفصل) سيؤدي إلى إلغاء توزيع جميع المخدومين من هذا الفصل ونقلهم إلى قائمة غير الموزعين. هل تريد الاستمرار؟",
    confirmMasterReset: "سيؤدي هذا إلى إلغاء توزيع جميع المخدومين من جميع الخدام ونقلهم إلى قائمة غير الموزعين. لا يمكن التراجع عن هذا الإجراء. هل تريد الاستمرار؟",
    resetComplete: "تمت إعادة الضبط بنجاح",
    unassignedSuccess: "تم إلغاء توزيع جميع المخدومين وإعادتهم إلى قائمة المتاحين بنجاح!",
    removedSuccess: "تمت إزالة المخدومين المحددين من هذا الخادم",
    assignedSuccess: "تم توزيع المخدومين بنجاح!",
    noSelectedError: "يرجى تحديد مخدوم واحد على الأقل أولاً",
    invalidIdsError: "المخدومين المحددين لا يحتويون على معرفات صحيحة. يرجى إعادة فتح القائمة والمحاولة مرة أخرى.",
    noSelectedRemoveError: "لم يتم تحديد أي مخدومين للإزالة",
    notAssignedRemoveError: "المخدومين المحددين غير موزعين لهذا الخادم",
    resetClassTitle: "تأكيد إعادة الضبط",
    resetAllTitle: "تأكيد إعادة الضبط الشامل",
  }
};

export default function AssignStudentsScreen2({ route, navigation }) {const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode);
  const { token: routeToken, teacher } = route.params || {};
  const token = routeToken || getAuthToken();
  const [students, setStudents] = useState([]);
  const [assignedStudents, setAssignedStudents] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCoPrincipal, setIsCoPrincipal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { t, locale } = useLanguage();
  const isRtl = locale === 'ar';

  const localT = (key) => {
    return localTranslations[locale]?.[key] || localTranslations['en'][key] || key;
  };

  const showAlert = (title, message, onOk = null) => {
    Alert.alert(title, message, [{ text: t('ok'), onPress: onOk }]);
  };

  const client = createApiClient(token);

  const loadStudents = async () => {
    setLoading(true);
    try {
      let meAssignedLevel = null;
      try {
        const meRes = await client.get('/auth/me');
        setIsCoPrincipal(meRes.data.role === 'co-principal' || meRes.data.role === 'admin' || meRes.data.role === 'principal' || meRes.data.isClassLeader === true);
        meAssignedLevel = meRes.data.assignedlevel;
        logger.log('Auth check - role:', meRes.data.role, 'isCoPrincipal will be:', meRes.data.role === 'co-principal');
      } catch (e) {
        logger.log('Auth check failed:', e.message);
      }
      
      const teacherId = teacher._id || teacher.id || teacher.teacherId;
      const teacherAssignedClass = teacher.assignedClass || teacher.assignedclass || teacher.assignedclassName || teacher.assignedClassName || '';
      const teacherClassLevel = typeof teacher.classLevel !== 'undefined' ? teacher.classLevel : (teacher.classlevel || teacher.level);

      const resBoth = await client.get(`/classes/teacher/${teacherId}/available`);
      logger.log('loadStudents debug - teacher(normalized):', { teacherId, teacherAssignedClass, teacherClassLevel });
      logger.log('loadStudents debug - server response:', resBoth && resBoth.data ? { assigned: (resBoth.data.assigned || []).length, available: (resBoth.data.available || []).length } : resBoth);
      
      let assignedRes = { data: resBoth.data.assigned || [] };
      let availableRes = { data: resBoth.data.available || [] };

      if (meAssignedLevel !== null && typeof meAssignedLevel !== 'undefined') {
        const className = (teacherAssignedClass || '').trim();
        if (className) {
          const matchName = (s) => {
            const name = (s.classname || s.className || s.getClassname?.() || '').toString().trim();
            return name === className;
          };
          availableRes = { data: (availableRes.data || []).filter(s => matchName(s)) };
          logger.log('Filtering students by classname', className, 'assigned:', assignedRes.data.length, 'available:', availableRes.data.length);
        } else {
          let targetLevels;
          if (meAssignedLevel === 1) targetLevels = [1, 2];
          else if (meAssignedLevel === 2) targetLevels = [3, 4];
          else if (meAssignedLevel === 3) targetLevels = [5, 6];
          else {
            const year = Math.ceil((meAssignedLevel || 1) / 2);
            targetLevels = year === 1 ? [1, 2] : year === 2 ? [3, 4] : [5, 6];
          }

          const studentLevel = (s) => {
            const raw = (typeof s.getClassLevel === 'function') ? s.getClassLevel() : (s.classLevel ?? s.classlevel ?? s.yearLevel);
            const n = Number(raw);
            return Number.isFinite(n) ? n : undefined;
          };

          assignedRes = { data: (assignedRes.data || []).filter(s => {
            const lvl = studentLevel(s);
            return typeof lvl !== 'undefined' && targetLevels.includes(lvl);
          }) };

          availableRes = { data: (availableRes.data || []).filter(s => {
            const lvl = studentLevel(s);
            return typeof lvl !== 'undefined' && targetLevels.includes(lvl);
          }) };

          logger.log('Filtering students by co-principal levels', targetLevels, 'assigned:', assignedRes.data.length, 'available:', availableRes.data.length);
        }
      }

      const assignedIds = assignedRes.data.map((s) => String(s._id));
      setAssignedStudents(assignedRes.data);

      let available = availableRes.data;

      const assignedNormalized = assignedRes.data.map(s => ({ ...s, _id: String(s._id) }));
      const availableFiltered = available.filter(s => !assignedIds.includes(String(s._id))).map(s => ({ ...s, _id: String(s._id) }));
      const combined = [...assignedNormalized, ...availableFiltered];

      setSelected(assignedNormalized.map(s => String(s._id)));
      setStudents(combined);
    } catch (err) {
      logger.error('Error fetching students:', err);
      showAlert(
        t('error'),
        `Failed to fetch students: ${err.response?.status || err.message}\n` +
          `Server message: ${err.response?.data?.msg || 'No details available'}`
      );
    } finally {
      setLoading(false);
    }
  };

  const confirmAndResetClass = () => {
    logger.log('confirmAndResetClass called');
    Alert.alert(
      localT('resetClassTitle'),
      localT('confirmResetClass'),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: localT('resetClass'), style: 'destructive', onPress: resetClass }
      ]
    );
  };

  const resetClass = async () => {
    try {
      logger.log('Resetting class for teacher:', teacher._id);
      const res = await client.post('/classes/co-principal/reset-class-group', { teacherId: teacher._id });
      logger.log('Reset response:', res.data);
      showAlert(localT('resetComplete'), res.data.msg || 'Class group reset complete');
      await loadStudents();
    } catch (err) {
      logger.error('Error resetting class group:', err);
      const serverMsg = err.response?.data?.msg || err.message || 'Failed to reset class';
      showAlert(t('error'), serverMsg);
    }
  };

  const confirmAndResetAll = () => {
    Alert.alert(
      localT('resetAllTitle'),
      localT('confirmMasterReset'),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: localT('masterReset'), style: 'destructive', onPress: resetAll }
      ]
    );
  };

  const resetAll = async () => {
    try {
      logger.log('Resetting all teachers under this co-principal');
      const res = await client.post('/classes/co-principal/reset-all');
      logger.log('Reset all response:', res.data);
      showAlert(localT('resetComplete'), res.data.msg || 'All teachers reset');
      await loadStudents();
    } catch (err) {
      logger.error('Error performing master reset:', err);
      showAlert(t('error'), `Failed to reset all teachers: ${err.response?.data?.msg || err.message}`);
    }
  };

  useEffect(() => {
    loadStudents();
  }, [token, teacher._id]);

  useFocusEffect(
    React.useCallback(() => {
      loadStudents();
    }, [token, teacher._id])
  );

  const toggleSelect = (id) => {
    setSelected((prevSelected) =>
      prevSelected.includes(id)
        ? prevSelected.filter((sid) => sid !== id)
        : [...prevSelected, id]
    );
  };

  const isObjectId = (s) => typeof s === 'string' && /^[a-fA-F0-9]{24}$/.test(s);

  const removeStudents = async () => {
    try {
      logger.log('Unassigning all students from teacher:', teacher._id);
      await client.post('/classes/co-principal/remove-students', {
        teacherId: teacher._id,
        allClasses: true,
      });
      showAlert(t('success'), localT('unassignedSuccess'));
      await loadStudents();
    } catch (err) {
      logger.error('Error unassigning students:', err);
      const serverMsg = err.response?.data?.msg || err.message || 'Failed to unassign students';
      showAlert(t('error'), serverMsg);
    }
  };

  const removeSelected = async () => {
    if (selected.length === 0) {
      showAlert(t('error'), localT('noSelectedRemoveError'));
      return;
    }
    const assignedIdsSet = new Set(assignedStudents.map(s => String(s._id)));
    const toRemove = selected.filter(id => assignedIdsSet.has(id));
    if (toRemove.length === 0) {
      showAlert(t('error'), localT('notAssignedRemoveError'));
      return;
    }

    try {
      logger.log('Remove selected payload:', { teacherId: teacher._id, studentIds: toRemove });
      await client.post('/classes/co-principal/remove-students', {
        teacherId: teacher._id,
        studentIds: toRemove,
      });
      showAlert(t('success'), `${localT('removedSuccess')}: ${toRemove.length}`);
      setSelected(prev => prev.filter(id => !toRemove.includes(id)));
      await loadStudents();
    } catch (err) {
      logger.error('Error removing selected students:', err);
      showAlert(t('error'), `Failed to remove students: ${err.response?.data?.msg || err.message}`);
    }
  };

  const assign = async () => {
    if (selected.length === 0) {
      showAlert(t('error'), localT('noSelectedError'));
      return;
    }
    const payloadIds = selected.filter(isObjectId);
    if (payloadIds.length === 0) {
      showAlert(t('error'), localT('invalidIdsError'));
      logger.error('Invalid selected ids:', selected);
      return;
    }

    try {
      logger.log('Assign payload:', { teacherId: teacher._id, studentIds: payloadIds });
      await client.post('/classes/co-principal/assign', {
        teacherId: teacher._id,
        studentIds: payloadIds,
      });
      showAlert(t('success'), localT('assignedSuccess'));
      await loadStudents();
    } catch (err) {
      logger.error('Error assigning students:', err);
      const serverMsg = err.response?.data?.msg || JSON.stringify(err.response?.data) || err.message;
      showAlert(t('error'), `Failed to assign students: ${serverMsg}`);
    }
  };

  const filteredStudents = students.filter(student => {
    const name = student.fullName || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const assignedIdsSet = new Set(assignedStudents.map(s => String(s._id)));
  const assignedSelectedCount = selected.filter(id => assignedIdsSet.has(id)).length;
  const newSelectedCount = selected.filter(id => !assignedIdsSet.has(id)).length;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { backgroundColor: theme.background }, { backgroundColor: theme.background }]}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
        >
          {}
          <View style={styles.headerCard}>
            <View style={[styles.headerRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
              <Ionicons name="school" size={28} color={theme.iconColor} />
              <View style={[styles.headerTextContainer, { alignItems: isRtl ? 'flex-end' : 'flex-start' }]}>
                <Text style={[styles.headerTitle, { color: theme.text }, { color: theme.text }]}>
                  {localT('assignTo')} {teacher.fullName}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {localT('currentlyAssigned')} {assignedStudents.length} {localT('students')}
                </Text>
              </View>
            </View>
          </View>

          {}
          {isCoPrincipal && (
            <View style={styles.adminCard}>
              <View style={[styles.adminHeader, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                <Ionicons name="construct-outline" size={20} color={theme.iconColor} />
                <Text style={styles.adminTitle}>{localT('adminActions')}</Text>
              </View>

              <View style={styles.adminButtonsGrid}>
                {assignedStudents.length > 0 && (
                  <TouchableOpacity style={[styles.adminBtn, styles.btnRedOutline]} onPress={removeStudents}>
                    <Ionicons name="person-remove-outline" size={16} color="#ffffff" style={isRtl ? { marginLeft: 6 } : { marginRight: 6 }} />
                    <Text style={styles.btnTextRed}>{localT('unassignAll')}</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={[styles.adminBtn, styles.btnOrangeOutline]} onPress={confirmAndResetClass}>
                  <Ionicons name="refresh-outline" size={16} color="#ffffff" style={isRtl ? { marginLeft: 6 } : { marginRight: 6 }} />
                  <Text style={styles.btnTextOrange}>{localT('resetClass')}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.adminBtn, styles.btnDarkRedOutline]} onPress={confirmAndResetAll}>
                  <Ionicons name="alert-circle-outline" size={16} color="#ffffff" style={isRtl ? { marginLeft: 6 } : { marginRight: 6 }} />
                  <Text style={styles.btnTextDarkRed}>{localT('masterReset')}</Text>
                </TouchableOpacity>
              </View>

              {}
              {assignedSelectedCount > 0 && (
                <TouchableOpacity style={[styles.adminBtn, styles.btnRemoveSelected, { marginTop: 12 }]} onPress={removeSelected}>
                  <Ionicons name="trash-outline" size={18} color="#ffffff" style={isRtl ? { marginLeft: 6 } : { marginRight: 6 }} />
                  <Text style={styles.btnTextWhite}>
                    {isRtl 
                      ? `إزالة ${assignedSelectedCount} من المخدومين الموزعين` 
                      : `Remove ${assignedSelectedCount} Selected Assigned`
                    }
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {}
          <Text style={[styles.sectionTitle, { textAlign: isRtl ? 'right' : 'left' }]}>
            {localT('availableTitle')}
          </Text>

          {}
          <View style={[styles.searchWrapper, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
            <Ionicons name="search-outline" size={20} color={theme.iconColor} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { textAlign: isRtl ? 'right' : 'left' }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={localT('searchPlaceholder')}
              placeholderTextColor={theme.textMuted}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={theme.iconColor} style={{ paddingHorizontal: 8 }} />
              </TouchableOpacity>
            )}
          </View>

          {}
          {selected.length > 0 && (
            <View style={[styles.selectionBadge, { alignSelf: isRtl ? 'flex-end' : 'flex-start', flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
              <Ionicons name="checkmark-circle" size={16} color={theme.iconColor} style={isRtl ? { marginLeft: 6 } : { marginRight: 6 }} />
              <Text style={styles.selectionBadgeText}>
                {selected.length} {localT('selectedCount')} ({newSelectedCount} {isRtl ? 'جديد' : 'new'}, {assignedSelectedCount} {isRtl ? 'موزع' : 'assigned'})
              </Text>
            </View>
          )}

          {}
          {loading ? (
            <View style={{ paddingVertical: 40 }}>
              <ActivityIndicator size="large" color={theme.iconColor} />
            </View>
          ) : filteredStudents.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="rgba(47, 67, 96, 0.2)" />
              <Text style={[styles.emptyText, { color: theme.textMuted }, { color: theme.textMuted }]}>{localT('noAvailable')}</Text>
            </View>
          ) : (
            <View style={styles.listWrapper}>
              {filteredStudents.map((student) => {
                const id = student._id || student.studentId;
                const isSelected = selected.includes(id);
                const isCurrentlyAssigned = assignedIdsSet.has(id);
                
                return (
                  <TouchableOpacity
                    key={id}
                    activeOpacity={0.7}
                    style={[
                      styles.studentCard,
                      { flexDirection: isRtl ? 'row-reverse' : 'row' },
                      isSelected && styles.studentCardSelected,
                      isCurrentlyAssigned && styles.studentCardAssigned,
                    ]}
                    onPress={() => toggleSelect(id)}
                  >
                    <View style={[styles.studentInfoRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                      <View style={[styles.avatarIcon, isSelected && styles.avatarSelected]}>
                        <Ionicons 
                          name={isSelected ? "checkmark-circle" : "person"} 
                          size={18} 
                          color={isSelected ? "#fff" : "#2f4360"} 
                        />
                      </View>
                      
                      <View style={[styles.studentTextWrapper, { alignItems: isRtl ? 'flex-end' : 'flex-start' }]}>
                        <Text style={[styles.studentName, isSelected && styles.studentTextSelected]}>
                          {student.fullName}
                        </Text>
                        <Text style={styles.studentDetails}>
                          {t('gradeLevel')}: {student.classLevel || student.yearLevel || ''} | {student.classname || ''}
                        </Text>
                      </View>
                    </View>

                    {}
                    <View style={styles.checkboxContainer}>
                      {isSelected ? (
                        <Ionicons name="checkbox" size={24} color={theme.iconColor} />
                      ) : (
                        <Ionicons name="square-outline" size={24} color="rgba(47, 67, 96, 0.3)" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>

        {}
        {newSelectedCount > 0 && (
          <View style={styles.footerPanel}>
            <TouchableOpacity style={styles.btnAssign} onPress={assign}>
              <Ionicons name="checkmark-done" size={20} color={theme.iconColor} style={isRtl ? { marginLeft: 8 } : { marginRight: 8 }} />
              <Text style={styles.btnAssignText}>
                {isRtl 
                  ? `حفظ توزيع ${newSelectedCount} مخدوم(ين) جدد` 
                  : `Assign ${newSelectedCount} New Student${newSelectedCount > 1 ? 's' : ''}`
                }
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100, 
  },
  headerCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.borderColor,
    padding: 18,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#24364f',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 4px 6px rgba(36, 54, 79, 0.05)',
      }
    }),
  },
  headerRow: {
    alignItems: 'center',
    gap: 14,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#2e7d32',
    fontWeight: '600',
    marginTop: 4,
  },
  adminCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.borderColor,
    padding: 16,
    marginBottom: 20,
    ...Platform.select({
      web: { boxShadow: '0 4px 6px rgba(36, 54, 79, 0.05)' }
    })
  },
  adminHeader: {
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(47, 67, 96, 0.08)',
    paddingBottom: 8,
    marginBottom: 12,
  },
  adminTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.text,
  },
  adminButtonsGrid: {
    flexDirection: 'column',
    gap: 8,
  },
  adminBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  btnRedOutline: {
    borderColor: '#d32f2f',
    backgroundColor: 'rgba(211, 47, 47, 0.04)',
  },
  btnOrangeOutline: {
    borderColor: '#ef6c00',
    backgroundColor: 'rgba(239, 108, 0, 0.04)',
  },
  btnDarkRedOutline: {
    borderColor: '#c62828',
    backgroundColor: 'rgba(198, 40, 40, 0.04)',
  },
  btnRemoveSelected: {
    borderColor: '#dc3545',
    backgroundColor: '#dc3545',
  },
  btnTextRed: {
    color: '#d32f2f',
    fontWeight: 'bold',
    fontSize: 14,
  },
  btnTextOrange: {
    color: '#ef6c00',
    fontWeight: 'bold',
    fontSize: 14,
  },
  btnTextDarkRed: {
    color: '#c62828',
    fontWeight: 'bold',
    fontSize: 14,
  },
  btnTextWhite: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 10,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  searchWrapper: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 10,
    backgroundColor: theme.cardBackground,
    width: '100%',
    marginBottom: 12,
  },
  searchIcon: {
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingRight: 12,
    paddingLeft: 12,
    color: theme.text,
    fontSize: 15,
    borderWidth: 0,
    backgroundColor: 'transparent',
    ...Platform.select({
      web: { outlineStyle: 'none' }
    })
  },
  selectionBadge: {
    backgroundColor: 'rgba(47, 67, 96, 0.08)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 14,
  },
  selectionBadgeText: {
    color: theme.text,
    fontWeight: '700',
    fontSize: 13,
  },
  listWrapper: {
    gap: 8,
  },
  studentCard: {
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 14,
    padding: 14,
    justifyContent: 'space-between',
    alignItems: 'center',
    ...Platform.select({
      web: { transition: 'all 0.2s ease' }
    })
  },
  studentCardSelected: {
    borderColor: '#2f4360',
    backgroundColor: 'rgba(47, 67, 96, 0.04)',
  },
  studentCardAssigned: {
    borderStyle: 'dashed',
    borderColor: '#2f4360',
  },
  studentInfoRow: {
    flex: 1,
    alignItems: 'center',
    gap: 12,
  },
  avatarIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(47, 67, 96, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarSelected: {
    backgroundColor: theme.primary,
  },
  studentTextWrapper: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
  },
  studentTextSelected: {
    color: theme.text,
  },
  studentDetails: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 2,
  },
  checkboxContainer: {
    paddingHorizontal: 4,
  },
  emptyContainer: {
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    color: 'rgba(47, 67, 96, 0.6)',
    fontSize: 14,
  },
  footerPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.cardBackground,
    borderTopWidth: 1,
    borderTopColor: 'rgba(47, 67, 96, 0.12)',
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#24364f',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.08,
        shadowRadius: 5,
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: '0 -4px 10px rgba(36, 54, 79, 0.06)',
      }
    }),
  },
  btnAssign: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primary,
    borderRadius: 12,
    paddingVertical: 14,
    ...Platform.select({
      web: { transition: 'background-color 0.2s ease' }
    })
  },
  btnAssignText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
