// utils/contactPicker.js
// Shared helper to open device contacts and pick a phone number.
// Works on iOS / Android. On web it shows a friendly message.

import { Platform } from 'react-native';

let Contacts = null;
if (Platform.OS !== 'web') {
  try {
    Contacts = require('expo-contacts');
  } catch (e) {
    Contacts = null;
  }
}

/**
 * Opens the device contacts and collects all contacts that have at least one
 * phone number. Returns an array of { name, phones: [{ label, number }] }
 * so the caller can present a picker modal.
 *
 * @param {Function} showAlert  – caller's alert helper (title, message)
 * @returns {Array|null}  – mapped contacts or null on failure / web
 */
export async function loadContactsForPicker(showAlert) {
  if (Platform.OS === 'web') {
    if ('contacts' in navigator && 'ContactsManager' in window) {
      try {
        const props = ['name', 'tel'];
        const opts = { multiple: true };
        const contacts = await navigator.contacts.select(props, opts);
        if (!contacts || contacts.length === 0) {
          return null;
        }
        
        const mappedContacts = contacts
          .filter(c => c.tel && c.tel.length > 0)
          .map(c => ({
            name: (c.name && c.name.length > 0) ? c.name[0] : 'Unknown',
            phones: c.tel.map(t => ({
              label: 'mobile',
              number: t.replace(/\s+/g, '')
            }))
          }));

        if (mappedContacts.length === 0) {
          showAlert('لا توجد جهات اتصال', 'جهات الاتصال المحددة لا تحتوي على أرقام هواتف.');
          return null;
        }
        return mappedContacts;
      } catch (ex) {
        return null; // Could be cancelled by user or permission denied
      }
    } else {
      showAlert(
        'غير مدعوم',
        'متصفحك الحالي أو نظام التشغيل لا يدعم استيراد جهات الاتصال. ميزة الاستيراد تعمل غالباً على متصفح Chrome للأندرويد.'
      );
      return null;
    }
  }

  if (!Contacts) {
    showAlert('Error', 'expo-contacts module is not available');
    return null;
  }

  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== 'granted') {
    showAlert(
      'إذن مرفوض',
      'يرجى السماح بالوصول إلى جهات الاتصال من إعدادات الجهاز.'
    );
    return null;
  }

  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
  });

  const withPhones = (data || []).filter(
    (c) => Array.isArray(c.phoneNumbers) && c.phoneNumbers.length > 0
  );

  if (withPhones.length === 0) {
    showAlert('لا توجد جهات اتصال', 'لم يتم العثور على جهات اتصال تحتوي على أرقام هاتف.');
    return null;
  }

  return withPhones.map((c) => ({
    name: c.name || 'Unknown',
    phones: c.phoneNumbers.map((p) => ({
      label: p.label || 'mobile',
      number: (p.number || '').replace(/\s+/g, ''),
    })),
  }));
}
