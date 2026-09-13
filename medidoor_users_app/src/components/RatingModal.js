import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Dimensions, ScrollView } from 'react-native';
import { X, Star, ChevronDown, ChevronUp, Check } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

export default function RatingModal({ 
  visible, 
  onClose, 
  onSubmit, 
  pharmacyName, 
  driverName, 
  orderItems = [],
  initialPharmacyRating,
  initialDriverRating,
  ratingTarget = 'both'
}) {
  const [pharmacyRating, setPharmacyRating] = useState(initialPharmacyRating || 0);
  const [driverRating, setDriverRating] = useState(initialDriverRating || 0);
  const [review, setReview] = useState('');

  const handleSubmit = () => {
    if (pharmacyRating === 0 && driverRating === 0) return;
    onSubmit({ pharmacyRating, driverRating, review });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={styles.modalContainer}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X color="#111827" size={24} />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Rate your Experience
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.scrollContent} keyboardShouldPersistTaps="handled">
            
            {/* Delivery Agent Rating */}
            {(ratingTarget === 'delivery' || ratingTarget === 'both') && !initialDriverRating && (
              <View style={styles.ratingSection}>
                <Text style={styles.ratingSectionTitle}>How was the delivery by {driverName || 'Delivery Partner'}?</Text>
                <View style={styles.starsContainer}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <TouchableOpacity key={`driver-${i}`} onPress={() => setDriverRating(i)} activeOpacity={0.7}>
                      <Star 
                        color={i <= driverRating ? "#F59E0B" : "#D1D5DB"} 
                        size={36} 
                        fill={i <= driverRating ? "#F59E0B" : "none"} 
                        style={styles.starIcon}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Pharmacy Rating */}
            {(ratingTarget === 'pharmacy' || ratingTarget === 'both') && !initialPharmacyRating && (
              <View style={styles.ratingSection}>
                <Text style={styles.ratingSectionTitle}>How was the order from {pharmacyName || 'Pharmacy Partner'}?</Text>
                <View style={styles.starsContainer}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <TouchableOpacity key={`pharmacy-${i}`} onPress={() => setPharmacyRating(i)} activeOpacity={0.7}>
                      <Star 
                        color={i <= pharmacyRating ? "#F59E0B" : "#D1D5DB"} 
                        size={36} 
                        fill={i <= pharmacyRating ? "#F59E0B" : "none"} 
                        style={styles.starIcon}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Text Review */}
            <View style={styles.ratingSection}>
              <Text style={styles.ratingSectionTitle}>Leave a Review</Text>
              <TextInput
                style={styles.textInput}
                placeholder="What did you like or dislike?"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                value={review}
                onChangeText={setReview}
              />
            </View>

          </ScrollView>

          {/* Fixed Submit Button */}
          {(() => {
            const isDisabled = 
              (ratingTarget === 'pharmacy' && pharmacyRating === 0) || 
              (ratingTarget === 'delivery' && driverRating === 0) ||
              (ratingTarget === 'both' && pharmacyRating === 0 && driverRating === 0);
            return (
              <View style={styles.footer}>
                <TouchableOpacity 
                  style={[styles.submitButton, isDisabled && { opacity: 0.5 }]} 
                  onPress={handleSubmit}
                  disabled={isDisabled}
                >
                  <Text style={styles.submitButtonText}>Submit</Text>
                </TouchableOpacity>
              </View>
            );
          })()}

        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#F3F4F6', // Off-white/gray background matching the screenshot
    justifyContent: 'flex-end',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    marginTop: Platform.OS === 'ios' ? 40 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 44 : 20,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 12,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  starIcon: {
    marginHorizontal: 2,
  },
  ratingSection: {
    marginBottom: 24,
    alignItems: 'center',
  },
  ratingSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#374151',
  },
  sectionSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginLeft: 4,
  },
  sectionContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  dishRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  dishName: {
    fontSize: 14,
    color: '#4B5563',
    flex: 1,
  },
  dishStars: {
    flexDirection: 'row',
  },
  textInput: {
    height: 100,
    fontSize: 15,
    color: '#111827',
  },
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    backgroundColor: '#F3F4F6',
  },
  submitButton: {
    backgroundColor: '#EA580C', // Orange color matching Swiggy/Zomato
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#EA580C',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
