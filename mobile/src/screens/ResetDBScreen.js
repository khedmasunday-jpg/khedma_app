import React, { useState, useEffect } from 'react';
import { View, Text, Button, Alert, StyleSheet, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { createApiClient } from '../config/api';
import { getAuthToken } from '../config/authSession';
import { logger } from '../utils/logger';
import { formatDateDDMMYYYY } from '../utils/dateFormatter';

// Conditionally require modal date picker on native
let DateTimePickerModal = null;
if (Platform.OS !== 'web') {
  try { DateTimePickerModal = require('react-native-modal-datetime-picker').default; } catch (e) { DateTimePickerModal = null; }
}

export default function ResetDBScreen({ route, navigation }) {
  const { token: routeToken } = route.params || {};
  const token = routeToken || getAuthToken();
  const [loading, setLoading] = useState(false);

  const client = createApiClient(token);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);

  const confirmAndReset = () => {
    // Use a browser-friendly fallback because Alert.alert may not show interactive
    // buttons when running under react-native-web / browser.
    const title = 'Confirm Reset';
    const message = 'This will reset the attendance counters for all students to zero. This action cannot be undone. Continue?';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // window.confirm returns true when user presses OK
      if (window.confirm(message)) {
        doReset();
      }
    } else {
      Alert.alert(
        title,
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reset', style: 'destructive', onPress: () => doReset() }
        ],
        { cancelable: true }
      );
    }
  };

  const notify = (title, message) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const doReset = async () => {
    try {
  setLoading(true);
  const res = await client.post('/students/reset-attendance');
      const msg = res?.data?.msg || 'Reset completed';
      const count = res?.data?.modifiedCount;
      const text = `${msg}${typeof count === 'number' ? ` (modified: ${count})` : ''}`;
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(text);
      } else {
        Alert.alert('Done', text);
      }
    } catch (err) {
      logger.error('Reset error', err && err.message ? err.message : err);
      const message = err?.response?.data?.msg || err?.message || 'Failed to reset';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`Error: ${message}`);
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Load classes for per-class reset option
  useEffect(() => {
    (async () => {
      try {
        const res = await client.get('/classes');
        if (Array.isArray(res.data)) setClasses(res.data);
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const resetForClassDate = async () => {
    if (!selectedClass) return (Platform.OS === 'web' ? window.alert('Error:\n\nPlease select a class') : Alert.alert('Error', 'Please select a class'));
    if (!selectedDate) return (Platform.OS === 'web' ? window.alert('Error:\n\nPlease select a date') : Alert.alert('Error', 'Please select a date'));
    const dateKey = selectedDate.toISOString().split('T')[0];
    const confirmed = Platform.OS === 'web' && typeof window !== 'undefined' ? window.confirm(`Clear attendance for class and date ${dateKey}? This will delete attendance records for that class on that date and adjust student counters.`) : true;
    if (Platform.OS !== 'web') {
      // use Alert for native
      // NOTE: synchronous confirmation isn't available; we show an Alert and proceed on press
      Alert.alert(
        'Confirm',
        `Clear attendance for class and date ${dateKey}? This will delete attendance records for that class on that date and adjust student counters.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clear', style: 'destructive', onPress: async () => {
            await doResetForClassDate(selectedClass, dateKey);
          }}
        ]
      );
      return;
    }
    if (confirmed) await doResetForClassDate(selectedClass, dateKey);
  };

  const doResetForClassDate = async (classId, dateKey) => {
    try {
      setLoading(true);
      const payload = { classId: String(classId), date: dateKey };
      logger.log('Resetting attendance for payload:', payload);
      const res = await client.post('/attendance/reset', payload);
      const data = res?.data || {};
      const text = data?.msg ? `${data.msg} (deleted: ${data.deletedCount || 0}, adjusted: ${data.adjustedStudents || 0}, clearedLastAbsent: ${data.clearedLastAbsent || 0})` : 'Reset completed';
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(text); else Alert.alert('Done', text);
    } catch (err) {
      logger.error('Reset for class/date error response:', err.response?.data || err.message || err);
      const message = err?.response?.data?.msg || err?.message || 'Failed to reset for class/date';
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(`Error: ${message}`); else Alert.alert('Error', message);
    } finally { setLoading(false); }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={{ width: '100%', alignItems: 'center' }}>
        <Text style={styles.text}>Reset attendance counters for all students</Text>
        <Button title={loading ? 'Resetting...' : 'Reset Attendance Counters'} color="#d9534f" onPress={confirmAndReset} disabled={loading} />
      </View>

      <View style={{ height: 1, backgroundColor: '#eee', marginVertical: 18, width: '100%' }} />

      <View style={{ width: '100%' }}>
        <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Reset attendance for specific class and date</Text>

        <Text style={{ marginBottom: 6 }}>Select class:</Text>
        <ScrollView horizontal style={{ marginBottom: 8 }}>
          {classes.map(c => (
            <TouchableOpacity
              key={c._id}
              onPress={() => setSelectedClass(c._id)}
              style={{ padding: 8, backgroundColor: selectedClass === c._id ? '#cce5ff' : '#eee', borderRadius: 8, marginRight: 8 }}
            >
              <Text>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={{ marginBottom: 6 }}>Select date:</Text>
        {Platform.OS === 'web' ? (
          <View style={{ position: 'relative', width: 200, minHeight: 40, justifyContent: 'center', borderWidth: 1, borderRadius: 6, borderColor: '#ccc', backgroundColor: '#f5f5f5', marginBottom: 12, overflow: 'hidden' }}>
            <View style={{ paddingLeft: 12 }} pointerEvents="none">
              <Text style={{ color: selectedDate ? '#333' : '#a0a0a0', fontSize: 15 }}>
                {selectedDate ? formatDateDDMMYYYY(selectedDate) : 'dd/mm/yyyy'}
              </Text>
            </View>
            <input
              type="date"
              value={(() => {
                try {
                  if (!selectedDate) return '';
                  if (typeof selectedDate === 'string') return selectedDate.split('T')[0];
                  if (selectedDate instanceof Date) return selectedDate.toISOString().split('T')[0];
                  return String(selectedDate).split('T')[0];
                } catch (e) { return ''; }
              })()}
              onChange={(e) => {
                const v = e.target.value; if (!v) return setSelectedDate(new Date()); const d = new Date(v); if (isNaN(d.getTime())) return setSelectedDate(new Date()); setSelectedDate(d);
              }}
              onClick={(e) => {
                try { e.target.showPicker(); } catch (err) {}
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                outlineStyle: 'none',
                cursor: 'pointer',
                zIndex: 2,
              }}
            />
          </View>
        ) : (
          <>
            <TouchableOpacity onPress={() => setDatePickerVisible(true)} style={{ padding: 8, backgroundColor: '#eee', borderRadius: 6, marginBottom: 12, alignSelf: 'flex-start' }}>
              <Text>{formatDateDDMMYYYY(selectedDate)}</Text>
            </TouchableOpacity>
            {DateTimePickerModal && (
              <DateTimePickerModal
                isVisible={isDatePickerVisible}
                mode="date"
                date={selectedDate || new Date()}
                onConfirm={(date) => { setSelectedDate(date); setDatePickerVisible(false); }}
                onCancel={() => setDatePickerVisible(false)}
              />
            )}
          </>
        )}

        <Button title={loading ? 'Clearing...' : 'Reset Class/Date'} color="#d9534f" onPress={resetForClassDate} disabled={loading || !selectedClass} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  text: { marginBottom: 12, fontSize: 16, textAlign: 'center' }
});
