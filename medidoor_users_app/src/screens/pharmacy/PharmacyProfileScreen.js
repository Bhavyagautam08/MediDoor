import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
  Platform, ActivityIndicator, Alert, TextInput, Modal, KeyboardAvoidingView
} from 'react-native';
import { Store, User, LogOut, TrendingUp, Clock, MapPin } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import MapPickerModal from '../../components/MapPickerModal';

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_SLOTS = [
  '06:00 AM', '07:00 AM', '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM',
  '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM',
  '06:00 PM', '07:00 PM', '08:00 PM', '09:00 PM', '10:00 PM', '11:00 PM', '12:00 AM'
];

export default function PharmacyProfileScreen({ navigation }) {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    address: '',
    openTime: '09:00 AM',
    closeTime: '09:00 PM',
    openDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    open: false,
    latitude: 0,
    longitude: 0,
  });

  useEffect(() => {
    const fetchProfile = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      try {
        const snap = await getDoc(doc(db, 'pharmacies', currentUser.uid));
        if (snap.exists()) {
          setProfileData({ ...snap.data(), email: currentUser.email });
        } else {
          setProfileData({ email: currentUser.email, name: 'Pharmacy Partner', role: 'Pharmacy Admin' });
        }
      } catch (err) {
        console.error(err);
        Alert.alert('Error', String(err?.message || 'An unexpected error occurred'));
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const openEditModal = () => {
    setEditForm({
      name: profileData?.name || '',
      address: profileData?.address || '',
      openTime: profileData?.openTime || '09:00 AM',
      closeTime: profileData?.closeTime || '09:00 PM',
      openDays: profileData?.openDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      open: profileData?.open || false,
      latitude: profileData?.latitude || 0,
      longitude: profileData?.longitude || 0,
    });
    setShowEditModal(true);
  };

  const toggleDay = (day) => {
    setEditForm(f => {
      const days = f.openDays.includes(day)
        ? f.openDays.filter(d => d !== day)
        : [...f.openDays, day];
      return { ...f, openDays: days };
    });
  };

  const handleSaveProfile = async () => {
    if (!editForm.name.trim()) {
      Alert.alert('Error', 'Business name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      const currentUser = auth.currentUser;
      const dataToSave = {
        name: editForm.name.trim(),
        address: editForm.address.trim(),
        openTime: editForm.openTime,
        closeTime: editForm.closeTime,
        openDays: editForm.openDays,
        open: editForm.open,
        latitude: editForm.latitude,
        longitude: editForm.longitude,
        role: 'Pharmacy Admin',
      };
      await updateDoc(doc(db, 'pharmacies', currentUser.uid), dataToSave);
      setProfileData({ ...profileData, ...dataToSave });
      setShowEditModal(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out', style: 'destructive', onPress: async () => {
          await auth.signOut();
          navigation.reset({ index: 0, routes: [{ name: 'RoleSelection' }] });
        }
      }
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#00C853" />
      </SafeAreaView>
    );
  }

  const initials = (profileData?.name || 'P').substring(0, 2).toUpperCase();
  const hoursDisplay = profileData?.openTime && profileData?.closeTime
    ? `${profileData.openTime} – ${profileData.closeTime}`
    : 'Not Set';
  const daysDisplay = profileData?.openDays?.length
    ? profileData.openDays.join(', ')
    : 'Not Set';

  const checkIsOpen = () => {
    if (!profileData?.openTime || !profileData?.closeTime) return false;
    const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'short' });
    if (!profileData?.openDays?.includes(todayStr)) return false;

    const parseTime = (timeStr) => {
      if (!timeStr) return 0;
      const [time, period] = timeStr.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      return hours * 60 + minutes;
    };

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const openMins = parseTime(profileData.openTime);
    const closeMins = parseTime(profileData.closeTime);

    if (closeMins < openMins) return currentMins >= openMins || currentMins <= closeMins;
    return currentMins >= openMins && currentMins <= closeMins;
  };

  const isStoreOpen = checkIsOpen();

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#00C853', '#009624']} style={styles.headerBg}>
        <View style={styles.headerContent}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.pharmacyName}>{profileData?.name || 'Pharmacy Partner'}</Text>
          <Text style={styles.pharmacyEmail}>{profileData?.email}</Text>
          <View style={{flexDirection: 'row', gap: 12}}>
            <View style={styles.partnerBadge}>
              <Store color="#00C853" size={14} />
              <Text style={styles.partnerBadgeText}>Verified Partner</Text>
            </View>
            <View style={[styles.partnerBadge, {backgroundColor: '#FEF3C7'}]}>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#D97706' }}>
                ★ {profileData?.rating ? profileData.rating.toFixed(1) : 'New'}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <User color="#6B7280" size={20} />
            <View style={styles.infoTextGroup}>
              <Text style={styles.infoLabel}>Business Name</Text>
              <Text style={styles.infoValue}>{profileData?.name || '—'}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <TrendingUp color="#6B7280" size={20} />
            <View style={styles.infoTextGroup}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={styles.infoValue}>{profileData?.address || 'Not Set'}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Clock color="#6B7280" size={20} />
            <View style={styles.infoTextGroup}>
              <Text style={styles.infoLabel}>Opening Hours</Text>
              <Text style={styles.infoValue}>{hoursDisplay}</Text>
              <Text style={styles.infoSubValue}>{daysDisplay}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={{ fontSize: 20, color: isStoreOpen ? '#00C853' : '#EF4444' }}>●</Text>
            <View style={styles.infoTextGroup}>
              <Text style={styles.infoLabel}>Store Status</Text>
              <Text style={[styles.infoValue, { color: isStoreOpen ? '#00C853' : '#EF4444' }]}>
                {isStoreOpen ? 'OPEN NOW' : 'CLOSED'}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.editBtn} onPress={openEditModal}>
          <Text style={styles.editBtnText}>Edit Business Details</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut color="#EF4444" size={20} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal && !showMapPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modal}>
            <ScrollView
              keyboardShouldPersistTaps="always"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 30 }}
            >
              <Text style={styles.modalTitle}>Edit Business Details</Text>

              <Text style={styles.fieldLabel}>Business Name</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. Apollo Pharmacy"
                value={editForm.name}
                onChangeText={v => setEditForm({ ...editForm, name: v })}
              />

              <Text style={styles.fieldLabel}>Address</Text>
              <TouchableOpacity 
                style={[styles.fieldInput, { flexDirection: 'row', alignItems: 'center' }]} 
                onPress={() => {
                  setShowEditModal(false);
                  setTimeout(() => setShowMapPicker(true), 300); // Give Android time to dismiss first modal
                }}
              >
                <MapPin color="#6B7280" size={20} style={{ marginRight: 8 }} />
                <Text style={{ flex: 1, color: editForm.address ? '#111827' : '#9CA3AF' }} numberOfLines={2}>
                  {editForm.address || "Select on map"}
                </Text>
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Opening Hours</Text>
              <View style={{ marginBottom: 16 }}>
                <Text style={styles.subLabel}>Opens at</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
                  {TIME_SLOTS.map(time => (
                    <TouchableOpacity
                      key={`open-${time}`}
                      style={[styles.timeChip, editForm.openTime === time && styles.timeChipActive]}
                      onPress={() => setEditForm({ ...editForm, openTime: time })}
                    >
                      <Text style={[styles.timeChipText, editForm.openTime === time && styles.timeChipTextActive]}>{time}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={[styles.subLabel, { marginTop: 12 }]}>Closes at</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
                  {TIME_SLOTS.map(time => (
                    <TouchableOpacity
                      key={`close-${time}`}
                      style={[styles.timeChip, editForm.closeTime === time && styles.timeChipActive]}
                      onPress={() => setEditForm({ ...editForm, closeTime: time })}
                    >
                      <Text style={[styles.timeChipText, editForm.closeTime === time && styles.timeChipTextActive]}>{time}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <Text style={styles.fieldLabel}>Open Days</Text>
              <View style={styles.daysRow}>
                {ALL_DAYS.map(day => {
                  const selected = editForm.openDays.includes(day);
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[styles.dayChip, selected && styles.dayChipActive]}
                      onPress={() => toggleDay(day)}
                    >
                      <Text style={[styles.dayChipText, selected && styles.dayChipTextActive]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile} disabled={saving}>
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.saveBtnText}>Save Details</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEditModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <MapPickerModal
        visible={showMapPicker}
        onClose={() => {
          setShowMapPicker(false);
          setTimeout(() => setShowEditModal(true), 300);
        }}
        onSelectLocation={(loc) => {
          setEditForm({
            ...editForm,
            address: loc.address,
            latitude: loc.latitude,
            longitude: loc.longitude,
          });
          setShowMapPicker(false);
          setTimeout(() => setShowEditModal(true), 300);
        }}
        initialLocation={{
          address: editForm.address,
          latitude: editForm.latitude,
          longitude: editForm.longitude,
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBg: { paddingTop: Platform.OS === 'android' ? 40 : 20, paddingBottom: 40 },
  headerContent: { alignItems: 'center', paddingVertical: 20 },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center',
    justifyContent: 'center', borderWidth: 3, borderColor: '#fff', marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  pharmacyName: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  pharmacyEmail: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 12 },
  partnerBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  partnerBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#00C853', marginLeft: 6 },
  content: { padding: 20 },
  infoCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 },
  infoTextGroup: { marginLeft: 16, flex: 1 },
  infoLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 2 },
  infoValue: { fontSize: 16, fontWeight: '600', color: '#111827' },
  infoSubValue: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 8 },
  logoutBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#FEF2F2', borderRadius: 16, paddingVertical: 16,
    borderWidth: 1, borderColor: '#FECACA',
  },
  logoutText: { color: '#EF4444', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  editBtn: {
    backgroundColor: '#F3F4F6', borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB',
  },
  editBtnText: { color: '#111827', fontSize: 16, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '93%',
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 20 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  subLabel: { fontSize: 12, color: '#6B7280', marginBottom: 6 },
  fieldInput: {
    backgroundColor: '#F3F4F6', borderRadius: 12, padding: 14,
    fontSize: 15, marginBottom: 16, color: '#111827',
  },
  daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  dayChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  dayChipActive: { backgroundColor: '#00C853', borderColor: '#00C853' },
  dayChipText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  dayChipTextActive: { color: '#fff' },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 24, marginTop: 4,
  },
  toggleBtn: { width: 50, height: 28, borderRadius: 14, backgroundColor: '#E5E7EB', padding: 2 },
  toggleBtnActive: { backgroundColor: '#00C853' },
  toggleKnob: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2, shadowRadius: 1, elevation: 2,
  },
  toggleKnobActive: { transform: [{ translateX: 22 }] },
  saveBtn: { backgroundColor: '#00C853', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cancelBtn: { backgroundColor: '#F3F4F6', padding: 16, borderRadius: 12, alignItems: 'center' },
  cancelBtnText: { color: '#6B7280', fontSize: 16, fontWeight: 'bold' },
  timeChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#F3F4F6', marginRight: 8, borderWidth: 1, borderColor: '#E5E7EB'
  },
  timeChipActive: { backgroundColor: '#00C853', borderColor: '#00C853' },
  timeChipText: { fontSize: 14, color: '#4B5563', fontWeight: '500' },
  timeChipTextActive: { color: '#fff', fontWeight: 'bold' }
});
