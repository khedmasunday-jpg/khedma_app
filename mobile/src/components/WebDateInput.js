import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatDateDDMMYYYY } from '../utils/dateFormatter';

export default function WebDateInput({ value, onChange, placeholder = 'dd/mm/yyyy', style = {} }) {
  return (
    <View style={[styles.container, style]}>
      {/* Visible styled text showing the formatted date */}
      <Text 
        style={[
          styles.text, 
          { color: value ? '#333333' : '#a0a0a0' }
        ]}
        pointerEvents="none"
      >
        {value ? formatDateDDMMYYYY(value) : placeholder}
      </Text>
      
      {/* Transparent native date input overlayed on top */}
      <input
        type="date"
        value={value ? value.split('T')[0] : ''}
        onChange={(e) => {
          const val = e.target.value;
          if (val) {
            const d = new Date(val);
            onChange(d.toISOString());
          } else {
            onChange('');
          }
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
          padding: 0,
          margin: 0,
          borderWidth: 0,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    minHeight: 40,
    justifyContent: 'center',
  },
  text: {
    position: 'absolute',
    left: 12,
    fontSize: 15,
    pointerEvents: 'none', // Allows clicks to pass through to the input beneath
  },
});
