import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Heart, Star, Search, X } from 'lucide-react-native';
import { doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { LinearGradient } from 'expo-linear-gradient';
import { checkIsOpen } from '../../utils/pharmacyUtils';

export default function LikedPharmaciesScreen({ navigation }) {
  const [likedPharmacies, setLikedPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLikedPharmacies = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const userDoc = await getDoc(doc(db, 'customers', currentUser.uid));
      if (!userDoc.exists()) return;

      const likedIds = userDoc.data().likedPharmacies || [];
      if (likedIds.length === 0) {
        setLikedPharmacies([]);
        return;
      }

      const details = await Promise.all(
        likedIds.map(async (pid) => {
          const pDoc = await getDoc(doc(db, 'pharmacies', pid));
          return pDoc.exists() ? { id: pDoc.id, ...pDoc.data() } : null;
        })
      );
      setLikedPharmacies(details.filter(Boolean));
    } catch (e) {
      console.error('Error fetching liked pharmacies:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLikedPharmacies();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLikedPharmacies();
  };

  const handleUnlike = async (pharmacyId) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, 'customers', currentUser.uid), {
        likedPharmacies: arrayRemove(pharmacyId),
      });
      setLikedPharmacies(prev => prev.filter(p => p.id !== pharmacyId));
    } catch (e) {
      console.error('Error unliking pharmacy:', e);
    }
  };

  // Filter pharmacies based on search query
  const filteredPharmacies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return likedPharmacies;
    return likedPharmacies.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.address?.toLowerCase().includes(q)
    );
  }, [likedPharmacies, searchQuery]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => navigation.navigate('PharmacyDetail', { pharmacyId: item.id })}
    >
      {/* Left Image Section */}
      <View style={styles.cardImageWrap}>
        {item.image ? (
          <View style={styles.cardImage}>
            <Image source={{ uri: item.image }} style={StyleSheet.absoluteFillObject} />
            <View style={[styles.statusBadge, checkIsOpen(item) ? styles.openBadge : styles.closedBadge]}>
              <View style={[styles.statusDot, { backgroundColor: checkIsOpen(item) ? '#10B981' : '#EF4444' }]} />
              <Text style={[styles.statusText, checkIsOpen(item) ? styles.openText : styles.closedText]}>
                {checkIsOpen(item) ? 'Open' : 'Closed'}
              </Text>
            </View>
          </View>
        ) : (
          <LinearGradient
            colors={['#0D9494', '#0A7878']}
            style={styles.cardImage}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            <Text style={styles.cardEmoji}>🏥</Text>
            <View style={[styles.statusBadge, checkIsOpen(item) ? styles.openBadge : styles.closedBadge]}>
              <View style={[styles.statusDot, { backgroundColor: checkIsOpen(item) ? '#10B981' : '#EF4444' }]} />
              <Text style={[styles.statusText, checkIsOpen(item) ? styles.openText : styles.closedText]}>
                {checkIsOpen(item) ? 'Open' : 'Closed'}
              </Text>
            </View>
          </LinearGradient>
        )}
      </View>

      {/* Right Content Section */}
      <View style={styles.cardBody}>
        <View style={styles.cardBodyLeft}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.cardAddress} numberOfLines={1}>{item.address || 'Local Pharmacy Partner'}</Text>
          <View style={styles.metaRow}>
            <Star color="#F59E0B" fill="#F59E0B" size={13} />
            <Text style={styles.metaText}> {item.rating || 'New'}</Text>
            {item.storeDiscount > 0 && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>🔥 {item.storeDiscount}% OFF</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity style={styles.unlikeBtn} onPress={() => handleUnlike(item.id)}>
          <Heart color="#EF4444" fill="#EF4444" size={20} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#003366', '#0D9494']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft color="#FFFFFF" size={22} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Liked Pharmacies</Text>
          <Text style={styles.headerSubtitle}>Your favourites, all in one place</Text>
        </View>
        <View style={styles.heartIconWrap}>
          <Heart color="#FFD6D6" fill="#FFD6D6" size={26} />
        </View>
      </LinearGradient>

      {/* Search Bar */}
      {!loading && likedPharmacies.length > 0 && (
        <View style={styles.searchWrapper}>
          <View style={styles.searchBox}>
            <Search color="#9CA3AF" size={18} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or area..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X color="#9CA3AF" size={18} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0D9494" />
          <Text style={styles.loadingText}>Loading your favourites...</Text>
        </View>
      ) : likedPharmacies.length === 0 ? (
        <View style={styles.center}>
          <Heart color="#E5E7EB" fill="#E5E7EB" size={72} />
          <Text style={styles.emptyTitle}>No Liked Pharmacies</Text>
          <Text style={styles.emptyDesc}>
            Tap the heart icon on any pharmacy to save it here for quick access.
          </Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => navigation.navigate('AllPharmacies')}>
            <Text style={styles.browseBtnText}>Browse Pharmacies</Text>
          </TouchableOpacity>
        </View>
      ) : filteredPharmacies.length === 0 ? (
        <View style={styles.center}>
          <Search color="#E5E7EB" size={56} />
          <Text style={styles.emptyTitle}>No Results</Text>
          <Text style={styles.emptyDesc}>No pharmacies match "{searchQuery}"</Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => setSearchQuery('')}>
            <Text style={styles.browseBtnText}>Clear Search</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredPharmacies}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0D9494']} />
          }
          ListHeaderComponent={
            <Text style={styles.countText}>
              {filteredPharmacies.length} of {likedPharmacies.length} pharmacies
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 18, paddingBottom: 22, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  heartIconWrap: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },

  // Search
  searchWrapper: { paddingHorizontal: 16, paddingVertical: 14 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, elevation: 3, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, borderWidth: 1, borderColor: '#F3F4F6' },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', fontWeight: '500' },

  // Loading / Empty
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginTop: 20, marginBottom: 10 },
  emptyDesc: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  browseBtn: { marginTop: 28, backgroundColor: '#0D9494', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16, elevation: 4, shadowColor: '#0D9494', shadowOpacity: 0.35, shadowRadius: 8 },
  browseBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },

  // List
  list: { padding: 16, paddingBottom: 40 },
  countText: { fontSize: 12, color: '#9CA3AF', fontWeight: '600', marginBottom: 12 },

  // Card
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, marginBottom: 14, elevation: 3, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, flexDirection: 'row' },
  cardImageWrap: { width: 110, padding: 8, paddingRight: 0 },
  cardImage: { flex: 1, borderRadius: 14, justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' },
  cardEmoji: { fontSize: 32 },
  statusBadge: { position: 'absolute', top: 6, left: 6, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 20 },
  openBadge: { backgroundColor: 'rgba(255,255,255,0.9)' },
  closedBadge: { backgroundColor: 'rgba(255,255,255,0.9)' },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  statusText: { fontSize: 9, fontWeight: '700' },
  openText: { color: '#065F46' },
  closedText: { color: '#991B1B' },

  cardBody: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14 },
  cardBodyLeft: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 3 },
  cardAddress: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: 13, color: '#4B5563', fontWeight: '600' },
  discountBadge: { marginLeft: 10, backgroundColor: '#FEF2F2', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  discountText: { fontSize: 10, fontWeight: 'bold', color: '#EF4444' },

  unlikeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF5F5', justifyContent: 'center', alignItems: 'center', marginLeft: 12, elevation: 2, shadowColor: '#EF4444', shadowOpacity: 0.15, shadowRadius: 4 },
});
