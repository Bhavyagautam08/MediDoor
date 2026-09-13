import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
  TextInput, Platform, Modal, Alert, ActivityIndicator, KeyboardAvoidingView, Image
} from 'react-native';
import { Plus, Search, Edit2, Trash2, X, Check, Camera, Upload, FileSpreadsheet } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import Papa from 'papaparse';
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';

export default function InventoryScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({
    name: '', stock: '', price: '', category: 'OTC',
    description: '', imgUri: '', requiresPrescription: false
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkItems, setBulkItems] = useState([]);
  const [bulkForm, setBulkForm] = useState({ name: '', stock: '', price: '' });

  const categories = ['Chronic', 'OTC', 'Digestion', 'First Aid', 'Supplements', 'Baby Care'];

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setLoading(false); return; }

    // Simple query without orderBy to avoid needing a composite index
    const q = query(collection(db, 'inventory'), where('pharmacyId', '==', uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = [];
      snapshot.forEach(d => items.push({ id: d.id, ...d.data() }));
      // Sort client-side
      items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setInventory(items);
      setLoading(false);
    }, (err) => {
      console.error('Inventory fetch error:', err);
      Alert.alert('Error', 'Could not load inventory: ' + err.message);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredInventory = inventory.filter(item =>
    item.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatus = (stock) => {
    if (stock <= 0) return 'Out of Stock';
    if (stock <= 20) return 'Low Stock';
    return 'In Stock';
  };

  const getStatusColor = (stock) => {
    if (stock <= 0) return '#EF4444';
    if (stock <= 20) return '#F59E0B';
    return '#0D9494';
  };

  const lowStockItems = inventory.filter(item => item.stock <= 20);

  const openAdd = () => {
    setForm({ name: '', stock: '', price: '', category: 'OTC', description: '', imgUri: '', requiresPrescription: false });
    setEditingItem(null);
    setShowAddModal(true);
  };

  const openEdit = (item) => {
    setForm({
      name: item.name || '',
      stock: String(item.stock || ''),
      price: String(item.price || ''),
      category: item.category || 'OTC',
      description: item.description || '',
      imgUri: item.imgUrl || '',
      requiresPrescription: item.requiresPrescription || false,
    });
    setEditingItem(item);
    setShowAddModal(true);
  };

  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Please allow access to your photo library.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled) {
        setUploadingImg(true);
        // Use local URI directly (no Firebase Storage needed)
        setTimeout(() => {
          setForm(f => ({ ...f, imgUri: result.assets[0].uri }));
          setUploadingImg(false);
        }, 500);
      }
    } catch (err) {
      console.error('Image pick error:', err);
      Alert.alert('Error', 'Could not pick image.');
      setUploadingImg(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.stock || !form.price) {
      Alert.alert('Error', 'Please fill in Name, Stock and Price.');
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        stock: parseInt(form.stock),
        price: parseFloat(form.price),
        category: form.category,
        description: form.description.trim(),
        imgUrl: form.imgUri || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80',
        requiresPrescription: form.requiresPrescription,
        pharmacyId: auth.currentUser?.uid,
      };
      if (editingItem) {
        await updateDoc(doc(db, 'inventory', editingItem.id), data);
      } else {
        await addDoc(collection(db, 'inventory'), data);
      }
      setShowAddModal(false);
      Alert.alert('Success', editingItem ? 'Medicine updated!' : 'Medicine added to inventory!');
    } catch (err) {
      console.error('Save error:', err);
      Alert.alert('Error', 'Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCsvUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const fileUri = result.assets[0].uri;
      const fileContent = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.UTF8 });

      Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const parsedItems = [];
          results.data.forEach(row => {
            const name = row.Name || row.name || '';
            const stock = parseInt(row.Stock || row.stock || row.Qty || row.qty || '0');
            const price = parseFloat(row.Price || row.price || '0');
            const category = row.Category || row.category || 'OTC';

            if (name.trim() && !isNaN(stock) && !isNaN(price)) {
              parsedItems.push({
                name: name.trim(),
                stock,
                price,
                category,
                description: row.Description || row.description || '',
                imgUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80',
                requiresPrescription: false,
                pharmacyId: auth.currentUser?.uid,
              });
            }
          });

          if (parsedItems.length === 0) {
            Alert.alert('Invalid CSV', 'Could not parse any valid items. Make sure your CSV has Name, Stock, and Price headers.');
            return;
          }

          setBulkItems(prev => [...prev, ...parsedItems]);
        },
        error: (error) => {
          Alert.alert('Error', 'Failed to parse CSV file.');
        }
      });
    } catch (err) {
      Alert.alert('Error', 'Failed to read file.');
    }
  };

  const handleSaveBulk = async () => {
    if (bulkItems.length === 0) return;
    setSaving(true);
    try {
      await Promise.all(bulkItems.map(item => addDoc(collection(db, 'inventory'), item)));
      setShowBulkModal(false);
      setBulkItems([]);
      Alert.alert('Success', `${bulkItems.length} items added to inventory!`);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to save bulk items.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item) => {
    Alert.alert('Delete Item', `Remove "${item.name}" from inventory?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteDoc(doc(db, 'inventory', item.id));
          } catch (err) {
            Alert.alert('Error', 'Failed to delete.');
          }
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Inventory</Text>
          <Text style={styles.headerSubtitle}>{inventory.length} items total</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity style={styles.bulkBtn} onPress={() => { setBulkItems([]); setBulkForm({name:'', stock:'', price:''}); setShowBulkModal(true); }}>
            <Text style={styles.bulkBtnText}>Bulk Add</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={openAdd}>
            <Plus color="#fff" size={20} />
            <Text style={styles.addButtonText}>Add New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && !loading && (
        <View style={styles.alertBanner}>
          <Text style={{ fontSize: 18, marginRight: 8 }}>⚠️</Text>
          <Text style={styles.alertText}>
            You have {lowStockItems.length} item{lowStockItems.length > 1 ? 's' : ''} low on stock or out of stock!
          </Text>
        </View>
      )}

      {/* Search */}
      <View style={styles.searchContainer}>
        <Search color="#9CA3AF" size={20} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search medicines..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator size="large" color="#0D9494" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {filteredInventory.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No inventory items yet.</Text>
              <Text style={styles.emptySubtext}>Tap "Add New" to add medicines.</Text>
            </View>
          ) : (
            filteredInventory.map(item => {
              const status = getStatus(item.stock);
              const statusColor = getStatusColor(item.stock);
              return (
                <View key={item.id} style={styles.itemCard}>
                  {item.imgUrl ? (
                    <Image source={{ uri: item.imgUrl }} style={styles.itemImg} />
                  ) : (
                    <View style={[styles.itemImg, styles.itemImgPlaceholder]}>
                      <Text style={{ fontSize: 22 }}>💊</Text>
                    </View>
                  )}
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemDetails}>
                      Stock: {item.stock} • ₹{parseFloat(item.price).toFixed(2)}
                    </Text>
                    <View style={styles.statusBadge}>
                      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                      <Text style={[styles.statusText, { color: statusColor }]}>{status}</Text>
                    </View>
                  </View>
                  <View style={styles.itemActions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)}>
                      <Edit2 size={18} color="#4B5563" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#FEF2F2' }]}
                      onPress={() => handleDelete(item)}
                    >
                      <Trash2 size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Bulk Add Modal */}
      <Modal visible={showBulkModal} transparent animationType="slide" onRequestClose={() => setShowBulkModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bulk Add Inventory</Text>
              <TouchableOpacity onPress={() => setShowBulkModal(false)} style={{ padding: 4 }}>
                <X color="#6B7280" size={24} />
              </TouchableOpacity>
            </View>
            
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <TouchableOpacity style={styles.csvUploadBtn} onPress={handleCsvUpload}>
                <FileSpreadsheet color="#1E3A8A" size={32} />
                <Text style={styles.csvUploadBtnText}>Select CSV File</Text>
                <Text style={styles.csvHintText}>Must contain Name, Stock, Price headers</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 1, backgroundColor: '#E5E7EB', marginBottom: 8 }} />
            <Text style={styles.fieldLabel}>Queue ({bulkItems.length} items)</Text>
            
            <ScrollView style={{maxHeight: 250, marginBottom: 16}}>
              {bulkItems.map((item, index) => (
                <View key={index} style={{flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: '#F9FAFB', borderRadius: 8, marginBottom: 8}}>
                  <Text style={{fontWeight: 'bold', color: '#374151', flex: 2}}>{item.name}</Text>
                  <Text style={{color: '#6B7280', flex: 1}}>Qty: {item.stock}</Text>
                  <Text style={{color: '#6B7280', flex: 1}}>₹{item.price}</Text>
                  <TouchableOpacity onPress={() => setBulkItems(bulkItems.filter((_, i) => i !== index))}>
                    <Trash2 color="#EF4444" size={18} />
                  </TouchableOpacity>
                </View>
              ))}
              {bulkItems.length === 0 && <Text style={{color: '#9CA3AF', textAlign: 'center', marginTop: 20}}>No items in queue.</Text>}
            </ScrollView>

            <TouchableOpacity style={[styles.saveBtn, bulkItems.length === 0 && {opacity: 0.5}]} onPress={handleSaveBulk} disabled={bulkItems.length === 0 || saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save All Items</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add/Edit Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modal}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 30 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingItem ? 'Edit Medicine' : 'Add New Medicine'}</Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)} style={{ padding: 4 }}>
                  <X color="#6B7280" size={24} />
                </TouchableOpacity>
              </View>

              {/* Image Picker */}
              <Text style={styles.fieldLabel}>Medicine Image</Text>
              <TouchableOpacity style={styles.imagePicker} onPress={pickImage} disabled={uploadingImg}>
                {uploadingImg ? (
                  <ActivityIndicator color="#0D9494" />
                ) : form.imgUri ? (
                  <Image source={{ uri: form.imgUri }} style={styles.imagePreview} />
                ) : (
                  <View style={styles.imagePickerPlaceholder}>
                    <Camera color="#9CA3AF" size={32} />
                    <Text style={styles.imagePickerText}>Tap to add image</Text>
                  </View>
                )}
              </TouchableOpacity>
              {form.imgUri ? (
                <TouchableOpacity onPress={() => setForm(f => ({ ...f, imgUri: '' }))} style={styles.removeImgBtn}>
                  <Text style={styles.removeImgText}>Remove Image</Text>
                </TouchableOpacity>
              ) : null}

              {/* Name */}
              <Text style={styles.fieldLabel}>Medicine Name *</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. Paracetamol 500mg"
                value={form.name}
                onChangeText={v => setForm({ ...form, name: v })}
              />

              {/* Stock & Price */}
              <View style={{ flexDirection: 'row' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.fieldLabel}>Stock (units) *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="100"
                    keyboardType="numeric"
                    value={form.stock}
                    onChangeText={v => setForm({ ...form, stock: v })}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.fieldLabel}>Price (₹) *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="12.50"
                    keyboardType="decimal-pad"
                    value={form.price}
                    onChangeText={v => setForm({ ...form, price: v })}
                  />
                </View>
              </View>

              {/* Category */}
              <Text style={styles.fieldLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {categories.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.categoryChip, form.category === c && styles.categoryChipActive]}
                    onPress={() => setForm({ ...form, category: c })}
                  >
                    <Text style={[styles.categoryText, form.category === c && styles.categoryTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Description */}
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. For fever and pain relief"
                value={form.description}
                onChangeText={v => setForm({ ...form, description: v })}
              />

              {/* Rx Toggle */}
              <View style={styles.toggleRow}>
                <Text style={styles.fieldLabel}>Requires Prescription (Rx)?</Text>
                <TouchableOpacity
                  style={[styles.toggleBtn, form.requiresPrescription && styles.toggleBtnActive]}
                  onPress={() => setForm({ ...form, requiresPrescription: !form.requiresPrescription })}
                >
                  <View style={[styles.toggleKnob, form.requiresPrescription && styles.toggleKnobActive]} />
                </TouchableOpacity>
              </View>

              {/* Save Button */}
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Check color="#fff" size={20} />
                }
                <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Medicine'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, paddingTop: Platform.OS === 'android' ? 40 : 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#111827', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 2, fontWeight: '500' },
  bulkBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, marginRight: 8,
    justifyContent: 'center', alignItems: 'center'
  },
  bulkBtnText: { color: '#374151', fontWeight: 'bold', fontSize: 13 },
  addButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#0D9494',
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
    shadowColor: '#0D9494', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4
  },
  addButtonText: { color: '#fff', fontWeight: 'bold', marginLeft: 6, fontSize: 14 },
  alertBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB',
    padding: 12, marginHorizontal: 16, marginTop: 16, borderRadius: 12,
    borderWidth: 1, borderColor: '#FEF3C7'
  },
  alertText: { color: '#B45309', fontWeight: '600', fontSize: 13, flex: 1 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    margin: 16, borderRadius: 12, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#F3F4F6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#111827' },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#374151' },
  emptySubtext: { color: '#9CA3AF', marginTop: 8 },
  itemCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4, elevation: 2,
  },
  itemImg: { width: 52, height: 52, borderRadius: 10, marginRight: 12 },
  itemImgPlaceholder: { backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: 'bold', color: '#111827', marginBottom: 3 },
  itemDetails: { fontSize: 13, color: '#6B7280', marginBottom: 6 },
  statusBadge: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  statusText: { fontSize: 12, fontWeight: '600' },
  itemActions: { flexDirection: 'row' },
  actionBtn: { padding: 8, marginLeft: 8, backgroundColor: '#F3F4F6', borderRadius: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '93%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  imagePicker: {
    width: '100%', height: 130, borderRadius: 14, marginBottom: 8,
    overflow: 'hidden', borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed',
  },
  imagePreview: { width: '100%', height: '100%' },
  imagePickerPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
  imagePickerText: { color: '#9CA3AF', fontSize: 13, marginTop: 8 },
  removeImgBtn: { alignItems: 'center', marginBottom: 16 },
  removeImgText: { color: '#EF4444', fontSize: 13, fontWeight: '600' },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  fieldInput: {
    backgroundColor: '#F3F4F6', borderRadius: 12, padding: 14,
    fontSize: 15, marginBottom: 16, color: '#111827',
  },
  categoryChip: {
    backgroundColor: '#F3F4F6', paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, marginRight: 8, height: 36, justifyContent: 'center',
  },
  categoryChipActive: { backgroundColor: '#111827' },
  categoryText: { color: '#6B7280', fontSize: 14, fontWeight: '500' },
  categoryTextActive: { color: '#fff' },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 24, marginTop: 4,
  },
  toggleBtn: { width: 50, height: 28, borderRadius: 14, backgroundColor: '#E5E7EB', padding: 2 },
  toggleBtnActive: { backgroundColor: '#0D9494' },
  toggleKnob: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2, shadowRadius: 1, elevation: 2,
  },
  toggleKnobActive: { transform: [{ translateX: 22 }] },
  saveBtn: {
    flexDirection: 'row', backgroundColor: '#0D9494', padding: 16,
    borderRadius: 12, justifyContent: 'center', alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  csvUploadBtn: { backgroundColor: '#EFF6FF', borderWidth: 2, borderColor: '#BFDBFE', borderStyle: 'dashed', borderRadius: 16, width: '100%', padding: 24, alignItems: 'center' },
  csvUploadBtnText: { color: '#1E3A8A', fontSize: 16, fontWeight: 'bold', marginTop: 12 },
  csvHintText: { color: '#60A5FA', fontSize: 12, marginTop: 4 },
});
