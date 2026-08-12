import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform } from 'react-native';
import { useTheme } from '../utils/ThemeContext';
import { useLanguage } from '../utils/LanguageContext';

let globalAlertHandler = null;

export const showGlobalAlert = (title, message, buttons) => {
  if (globalAlertHandler) {
    globalAlertHandler(title, message, buttons);
  } else {
    console.warn("Global alert not mounted yet:", title, message);
    if (typeof window !== 'undefined' && window.alert) window.alert(`${title ? title + '\n\n' : ''}${message}`);
  }
};

export const GlobalAlert = () => {
  const [alertData, setAlertData] = useState(null);
  const { theme } = useTheme();
  const { locale } = useLanguage();
  const isAr = locale === 'ar';

  useEffect(() => {
    globalAlertHandler = (title, message, buttons) => {
      setAlertData({
        title,
        message,
        buttons: buttons && buttons.length > 0 ? buttons : [{ text: isAr ? 'حسناً' : 'OK', onPress: () => {} }]
      });
    };
    return () => { globalAlertHandler = null; };
  }, [isAr]);

  if (!alertData) return null;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.dialog, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }]}>
          {!!alertData.title && <Text style={[styles.title, { color: theme.text }]}>{alertData.title}</Text>}
          {!!alertData.message && <Text style={[styles.message, { color: theme.text }]}>{alertData.message}</Text>}
          <View style={[styles.buttonRow, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
            {alertData.buttons.map((btn, index) => {
              const isCancel = btn.style === 'cancel' || btn.text.toLowerCase().includes('cancel') || btn.text === 'إلغاء';
              return (
                <TouchableOpacity 
                  key={index}
                  style={[
                    styles.button, 
                    isCancel ? { backgroundColor: theme.inputBackground, borderWidth: 1, borderColor: theme.borderColor } : { backgroundColor: theme.primary }
                  ]}
                  onPress={() => {
                    setAlertData(null);
                    if (btn.onPress) btn.onPress();
                  }}
                >
                  <Text style={[styles.buttonText, isCancel ? { color: theme.text } : { color: '#ffffff' }]}>{btn.text}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    ...Platform.select({
      web: { backdropFilter: 'blur(4px)' }
    })
  },
  dialog: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center'
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24
  },
  buttonRow: {
    justifyContent: 'center',
    gap: 12
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  buttonText: {
    fontWeight: 'bold',
    fontSize: 16
  }
});
