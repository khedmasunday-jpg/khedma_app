import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, ActivityIndicator, ScrollView, Linking } from 'react-native';
import Axios from 'axios';
import Ionicons from '@expo/vector-icons/Ionicons';
import { API_URL } from '../config/api';
import { getAuthToken, getAuthUser } from '../config/authSession';
import { useLanguage } from '../utils/LanguageContext';
import { useTheme } from '../utils/ThemeContext';

export default function RssLinksScreen({ route, navigation }) {
  const { role } = route.params || {};
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOtherLinks, setShowOtherLinks] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [allowedLevels, setAllowedLevels] = useState([]);
  const [allowedUsers, setAllowedUsers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { t, locale } = useLanguage();
  const { theme, isDarkMode } = useTheme();
  
  const isAdmin = role === 'admin' || role === 'principal';

  useEffect(() => {
    fetchLinks();
    if (isAdmin) {
      fetchStaff();
    }
  }, []);

  const fetchLinks = async () => {
    try {
      const token = getAuthToken();
      const res = await Axios.get(`${API_URL}/rss`, {
        headers: { Authorization: token }
      });
      setLinks(res.data);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to fetch RSS links');
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const token = getAuthToken();
      const res = await Axios.get(`${API_URL}/users/staff-safe`, {
        headers: { Authorization: token }
      });
      setStaff(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setTitle('');
    setUrl('');
    setAllowedLevels([]);
    setAllowedUsers([]);
    setEditingId(null);
  };

  const handleEditClick = (item) => {
    setTitle(item.title);
    setUrl(item.url);
    setAllowedLevels(item.allowedLevels || []);
    setAllowedUsers(item.allowedUsers || []);
    setEditingId(item._id);
    setModalVisible(true);
  };

  const handleCreate = async () => {
    if (!title || !url) {
      Alert.alert('Error', 'Title and URL are required');
      return;
    }
    try {
      const token = getAuthToken();
      if (editingId) {
        await Axios.put(`${API_URL}/rss/${editingId}`, {
          title, url, allowedLevels, allowedUsers
        }, {
          headers: { Authorization: token }
        });
      } else {
        await Axios.post(`${API_URL}/rss`, {
          title, url, allowedLevels, allowedUsers
        }, {
          headers: { Authorization: token }
        });
      }
      closeModal();
      fetchLinks();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to save RSS link');
    }
  };

  const handleDelete = async (id) => {
    try {
      const token = getAuthToken();
      await Axios.delete(`${API_URL}/rss/${id}`, {
        headers: { Authorization: token }
      });
      fetchLinks();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to delete RSS link');
    }
  };

  const toggleLevel = (l) => {
    if (allowedLevels.includes(l)) {
      setAllowedLevels(allowedLevels.filter(level => level !== l));
    } else {
      setAllowedLevels([...allowedLevels, l]);
    }
  };

  const toggleUser = (userId) => {
    if (allowedUsers.includes(userId)) {
      setAllowedUsers(allowedUsers.filter(id => id !== userId));
    } else {
      setAllowedUsers([...allowedUsers, userId]);
    }
  };

  const renderItem = ({ item }) => (
    <View style={[styles.card, { backgroundColor: theme.cardBackground }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>
        {role === 'admin' && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => handleEditClick(item)} style={{ marginRight: 15 }}>
              <Ionicons name="pencil-outline" size={24} color={theme.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item._id)}>
              <Ionicons name="trash-outline" size={24} color="#e74c3c" />
            </TouchableOpacity>
          </View>
        )}
      </View>
      <TouchableOpacity onPress={() => Linking.openURL(item.url)}>
        <Text style={[styles.url, { color: theme.primary }]}>{item.url}</Text>
      </TouchableOpacity>
      {isAdmin && (
        <Text style={[styles.meta, { color: isDarkMode ? '#fff' : theme.textSecondary }]}>
          Levels: {item.allowedLevels.join(', ') || 'All'} | Users: {item.allowedUsers.length}
        </Text>
      )}
    </View>
  );

  const currentUser = getAuthUser() || {};
  
  const myLinks = links.filter(l => 
    isAdmin || 
    (l.allowedLevels && l.allowedLevels.includes(currentUser.assignedlevel)) || 
    (l.allowedUsers && l.allowedUsers.includes(currentUser._id)) ||
    (!l.allowedLevels?.length && !l.allowedUsers?.length)
  );

  const otherLinks = links.filter(l => !myLinks.includes(l));

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          {myLinks.length === 0 && otherLinks.length === 0 ? (
            <Text style={{ color: theme.text, textAlign: 'center', marginTop: 50 }}>No RSS links found</Text>
          ) : (
            myLinks.map(item => <React.Fragment key={item._id}>{renderItem({ item })}</React.Fragment>)
          )}

          {!isAdmin && otherLinks.length > 0 && (
            <View style={{ marginTop: 20 }}>
              <TouchableOpacity 
                style={{ backgroundColor: theme.cardBackground, padding: 15, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: theme.primary }} 
                onPress={() => setShowOtherLinks(!showOtherLinks)}
              >
                <Text style={{ color: theme.primary, fontWeight: 'bold', fontSize: 16 }}>
                  {locale === 'ar' ? 'مناهج اخري' : 'Other Resources'}
                </Text>
              </TouchableOpacity>
              
              {showOtherLinks && (
                <View style={{ marginTop: 15 }}>
                  {otherLinks.map(item => <React.Fragment key={item._id}>{renderItem({ item })}</React.Fragment>)}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {role === 'admin' && (
        <TouchableOpacity style={[styles.fab, { backgroundColor: theme.primary }]} onPress={() => {
          setEditingId(null);
          setTitle('');
          setUrl('');
          setAllowedLevels([]);
          setAllowedUsers([]);
          setModalVisible(true);
        }}>
          <Ionicons name="add" size={30} color="#fff" />
        </TouchableOpacity>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? theme.background : '#ffffff' }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{editingId ? 'Edit RSS Link' : 'Add RSS Link'}</Text>
            
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              placeholder="Title"
              placeholderTextColor={theme.textSecondary}
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              placeholder="URL"
              placeholderTextColor={theme.textSecondary}
              value={url}
              onChangeText={setUrl}
            />

            <Text style={[styles.sectionTitle, { color: theme.text }]}>Allowed Levels (Years):</Text>
            <View style={styles.roleContainer}>
              {[1, 2, 3].map(l => (
                <TouchableOpacity
                  key={l}
                  style={[styles.roleChip, { backgroundColor: allowedLevels.includes(l) ? theme.primary : theme.cardBackground }]}
                  onPress={() => toggleLevel(l)}
                >
                  <Text style={{ color: allowedLevels.includes(l) ? '#fff' : theme.text }}>Year {l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { color: theme.text }]}>Allowed Specific Users:</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border, marginBottom: 5 }]}
              placeholder="Search teachers..."
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <ScrollView style={styles.userList}>
              {staff
                .filter(u => (u.fullName || u.username).toLowerCase().includes(searchQuery.toLowerCase()))
                .sort((a, b) => {
                  const aSelected = allowedUsers.includes(a._id);
                  const bSelected = allowedUsers.includes(b._id);
                  if (aSelected && !bSelected) return -1;
                  if (!aSelected && bSelected) return 1;
                  return 0;
                })
                .map(user => (
                <TouchableOpacity
                  key={user._id}
                  style={[styles.userRow, { backgroundColor: allowedUsers.includes(user._id) ? theme.primary : theme.cardBackground }]}
                  onPress={() => toggleUser(user._id)}
                >
                  <Text style={{ color: allowedUsers.includes(user._id) ? '#fff' : theme.text }}>{user.fullName || user.username} ({user.role})</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.btn, { backgroundColor: '#e74c3c' }]} onPress={closeModal}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: theme.primary }]} onPress={handleCreate}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15 },
  card: { padding: 15, borderRadius: 10, marginBottom: 15, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: 'bold' },
  url: { fontSize: 16, marginTop: 10, textDecorationLine: 'underline' },
  meta: { fontSize: 12, marginTop: 10 },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 15, padding: 20, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 15 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, marginTop: 10 },
  roleContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 15 },
  roleChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 10, marginBottom: 10 },
  userList: { maxHeight: 150, marginBottom: 15 },
  userRow: { padding: 10, borderRadius: 8, marginBottom: 5 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  btn: { flex: 1, padding: 15, borderRadius: 8, alignItems: 'center', marginHorizontal: 5 }
});
