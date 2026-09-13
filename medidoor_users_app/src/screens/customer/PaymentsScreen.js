import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, FlatList, ActivityIndicator, Alert, TextInput } from 'react-native';
import { ArrowLeft, CreditCard, Trash2, Plus } from 'lucide-react-native';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';

export default function PaymentsScreen({ navigation }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  
  // Dummy Card State
  const [cardNumber, setCardNumber] = useState('');

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    try {
      const userDoc = await getDoc(doc(db, 'customers', currentUser.uid));
      if (userDoc.exists() && userDoc.data().cards) {
        setCards(userDoc.data().cards);
      }
    } catch (error) {
      console.error(error); Alert.alert("Error", String(error || "An unexpected error occurred"));
    } finally {
      setLoading(false);
    }
  };

  const handleAddCard = async () => {
    if (cardNumber.length < 16) {
      Alert.alert('Error', 'Please enter a valid 16-digit card number.');
      return;
    }
    
    setAdding(true);
    try {
      const currentUser = auth.currentUser;
      const cardObj = { 
        id: Date.now().toString(), 
        last4: cardNumber.slice(-4),
        type: cardNumber.startsWith('4') ? 'Visa' : 'MasterCard' 
      };
      
      await updateDoc(doc(db, 'customers', currentUser.uid), {
        cards: arrayUnion(cardObj)
      });
      
      setCards([...cards, cardObj]);
      setCardNumber('');
    } catch (error) {
      Alert.alert('Error', 'Failed to save card.');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteCard = async (cardObj) => {
    try {
      const currentUser = auth.currentUser;
      await updateDoc(doc(db, 'customers', currentUser.uid), {
        cards: arrayRemove(cardObj)
      });
      setCards(cards.filter(c => c.id !== cardObj.id));
    } catch (error) {
      Alert.alert('Error', 'Failed to delete card.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color="#111827" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Methods</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.addSection}>
          <Text style={styles.sectionLabel}>Add New Card</Text>
          <TextInput 
            style={styles.input} 
            placeholder="16-digit Card Number" 
            keyboardType="numeric"
            maxLength={16}
            value={cardNumber} 
            onChangeText={setCardNumber}
          />
          <TouchableOpacity style={styles.addBtn} onPress={handleAddCard} disabled={adding}>
            {adding ? <ActivityIndicator color="#fff" size="small" /> : <Plus color="#fff" size={20} />}
            <Text style={styles.addBtnText}> Save Card</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#0D9494" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={cards}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.centerEmpty}>
                <CreditCard color="#9CA3AF" size={64} style={{ marginBottom: 16 }} />
                <Text style={styles.emptyText}>No saved payment methods.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.cardItem}>
                <View style={styles.cardLeft}>
                  <CreditCard color="#0D9494" size={24} />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.cardType}>{item.type}</Text>
                    <Text style={styles.cardNumber}>**** **** **** {item.last4}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleDeleteCard(item)} style={styles.deleteBtn}>
                  <Trash2 color="#EF4444" size={20} />
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  content: { flex: 1 },
  addSection: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  sectionLabel: { fontSize: 14, fontWeight: 'bold', color: '#374151', marginBottom: 8 },
  input: { backgroundColor: '#F3F4F6', padding: 16, borderRadius: 12, fontSize: 16, letterSpacing: 2 },
  addBtn: { flexDirection: 'row', backgroundColor: '#111827', padding: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 4 },
  list: { padding: 16 },
  centerEmpty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#6B7280', fontSize: 16 },
  cardItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardLeft: { flexDirection: 'row', alignItems: 'center' },
  cardType: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  cardNumber: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  deleteBtn: { padding: 8, backgroundColor: '#FEF2F2', borderRadius: 8 }
});
