import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, LayoutAnimation, UIManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronDown, ChevronUp, LifeBuoy, FileText, PackageSearch, CreditCard, ShieldAlert, HeadphonesIcon, Send } from 'lucide-react-native';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// 40 Industry Standard FAQs
const FAQ_DATA = [
  {
    category: 'Orders & Tracking',
    icon: PackageSearch,
    questions: [
      { q: "How can I track my order?", a: "You can track your order in real-time by going to Profile > Past Orders and tapping on the Active order to open Live Tracking." },
      { q: "Can I cancel my order?", a: "You can cancel your order within 2 minutes of placing it from the order tracking screen. Once the pharmacy accepts it, it cannot be canceled." },
      { q: "What if my order is delayed?", a: "We strive to deliver within 15-30 minutes. In rare cases of high demand or bad weather, it might take longer. Please hold on, our delivery partner is on the way!" },
      { q: "Can I change my delivery address?", a: "Once an order is placed, the address cannot be changed. Please cancel the order immediately and place a new one with the correct address." },
      { q: "What should I do if an item is missing?", a: "Please raise a complaint through this 'Contact Us' tab with your Order ID, and we will arrange a refund or replacement for the missing item immediately." },
      { q: "Do you deliver 24/7?", a: "Delivery hours depend on the operating hours of our partner pharmacies in your area. Typically, deliveries are available from 8 AM to 10 PM." },
      { q: "Is there a minimum order value?", a: "There is no minimum order value, but orders below ₹100 may incur a small delivery fee." },
      { q: "How are my medicines packed?", a: "All medicines are securely sealed in tamper-proof bags by our pharmacy partners before delivery." }
    ]
  },
  {
    category: 'Refunds & Returns',
    icon: FileText,
    questions: [
      { q: "What is your return policy?", a: "We accept returns within 7 days of delivery for sealed, unused medicines. Cold-chain medicines and unsealed syrups are non-returnable." },
      { q: "How do I initiate a return?", a: "Please raise a ticket from the 'Contact Us' tab with the Order ID and reason for return. Our support team will guide you." },
      { q: "When will I get my refund?", a: "Refunds for cancelled or returned orders are processed within 24-48 hours. It may take 3-5 business days to reflect in your bank account." },
      { q: "Can I return a partial order?", a: "Yes, you can return specific items from your order, provided they meet our return policy guidelines." },
      { q: "What if I receive a damaged product?", a: "We apologize for the inconvenience. Please raise a ticket with photos of the damaged item immediately upon delivery for a full refund or replacement." },
      { q: "Are delivery fees refundable?", a: "If the order is cancelled before dispatch, the delivery fee is refunded. For returns, the delivery fee is generally non-refundable." },
      { q: "Do I have to pay for return shipping?", a: "No, if the return is approved, our delivery partner will pick up the item from your address free of charge." },
      { q: "I received the wrong medicine. What now?", a: "Please do not open the package. Contact us immediately, and we will replace it with the correct medicine at no extra cost." }
    ]
  },
  {
    category: 'Payments & Subscriptions',
    icon: CreditCard,
    questions: [
      { q: "What payment methods do you accept?", a: "We accept Credit/Debit Cards, UPI (Google Pay, PhonePe, Paytm), Net Banking, and Cash on Delivery (COD)." },
      { q: "Is it safe to use my card on Axoro?", a: "Absolutely. All transactions are encrypted and processed through Razorpay, a highly secure, industry-standard payment gateway." },
      { q: "Why did my transaction fail?", a: "Transactions may fail due to network issues or bank server downtime. Please try again or use an alternative payment method." },
      { q: "Money was deducted but order not placed?", a: "Do not worry! The deducted amount will automatically be refunded to your original payment method within 3-5 business days." },
      { q: "How does the Monthly Subscription work?", a: "You can subscribe to regular medicines at checkout. We will automatically place the order for you every 30 days and give you a flat 10% discount!" },
      { q: "Can I cancel my subscription?", a: "Yes, you can pause or cancel your subscription at any time from your Profile settings with zero cancellation fees." },
      { q: "Are there any hidden charges?", a: "No, the final bill on the checkout page includes all taxes and delivery fees. There are no hidden charges." },
      { q: "Do you offer EMI options?", a: "Currently, we do not offer EMI options for medication purchases." }
    ]
  },
  {
    category: 'Prescriptions & Medicines',
    icon: ShieldAlert,
    questions: [
      { q: "Why do I need a prescription?", a: "As per government regulations, certain Schedule H and H1 drugs can only be dispensed with a valid prescription from a registered medical practitioner." },
      { q: "What makes a prescription valid?", a: "A valid prescription must have the doctor's name, registration number, patient name, date, medicine details, and the doctor's signature." },
      { q: "Can I upload an old prescription?", a: "Prescriptions are generally valid for 3-6 months from the date of issue, depending on the medication." },
      { q: "What if I don't have a prescription?", a: "For prescription-only medicines, you must consult a doctor first. We also offer a wide range of OTC (Over-The-Counter) products that do not require an Rx." },
      { q: "How do you ensure medicine authenticity?", a: "We partner exclusively with verified, licensed local pharmacies to guarantee 100% genuine medicines." },
      { q: "Do you sell generic substitutes?", a: "Yes! If you upload a prescription, our pharmacy partners may suggest generic alternatives with the exact same composition to help you save money." },
      { q: "Are the medicines stored properly?", a: "Yes, all pharmacies are vetted for strict temperature control, and cold-chain items like insulin are delivered in insulated bags." },
      { q: "Can I consult a doctor on Axoro?", a: "We currently focus on rapid delivery, but we are working on integrating tele-consultations in the near future!" }
    ]
  },
  {
    category: 'Account & Security',
    icon: LifeBuoy,
    questions: [
      { q: "How do I update my phone number?", a: "You can update your phone number by navigating to Profile > Edit Profile." },
      { q: "Is my medical data private?", a: "Yes. Your prescriptions and order history are strictly confidential and protected by enterprise-grade security protocols." },
      { q: "How do I delete my account?", a: "If you wish to permanently delete your account and all associated data, please raise a ticket from the Contact Us tab." },
      { q: "I forgot my password.", a: "On the login screen, tap 'Forgot Password' to receive a reset link on your registered email address." },
      { q: "Can I share my account with family?", a: "You can order for family members using your account by simply adding a new delivery address for them at checkout." },
      { q: "Why am I not receiving notifications?", a: "Please check your device's settings to ensure push notifications are enabled for the Axoro app." },
      { q: "What is Axoro Premium?", a: "Axoro Premium is a loyalty program offering zero delivery fees and exclusive discounts. Look for the banner in your Profile!" },
      { q: "How do I log out?", a: "Go to your Profile and tap the Log Out icon in the top right corner." }
    ]
  }
];

const AccordionItem = ({ q, a }) => {
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <View style={styles.accordionContainer}>
      <TouchableOpacity style={styles.accordionHeader} onPress={toggleExpand} activeOpacity={0.7}>
        <Text style={styles.questionText}>{q}</Text>
        {expanded ? <ChevronUp color="#6B7280" size={20} /> : <ChevronDown color="#6B7280" size={20} />}
      </TouchableOpacity>
      {expanded && (
        <View style={styles.accordionBody}>
          <Text style={styles.answerText}>{a}</Text>
        </View>
      )}
    </View>
  );
};

export default function HelpSupportScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('FAQ'); // 'FAQ' | 'CONTACT'
  
  // Form State
  const [issueCategory, setIssueCategory] = useState('');
  const [orderId, setOrderId] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const categories = ['Delayed Order', 'Wrong Item Received', 'Payment Failed', 'Refund Issue', 'App Bug', 'Account Deletion', 'Other'];

  const handleSubmitTicket = async () => {
    if (!issueCategory) {
      Alert.alert('Required', 'Please select an issue category.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Required', 'Please provide a detailed description of your issue.');
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to raise a ticket.');
      return;
    }

    setIsSubmitting(true);
    try {
      const ticketData = {
        userId: currentUser.uid,
        userEmail: currentUser.email || 'N/A',
        userName: currentUser.displayName || 'Customer',
        issueCategory,
        orderId: orderId.trim(),
        description: description.trim(),
        status: 'Open',
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'support_tickets'), ticketData);
      
      Alert.alert('Ticket Submitted', 'We have received your complaint. Our support team will look into this and resolve it shortly.');
      
      // Reset Form
      setIssueCategory('');
      setOrderId('');
      setDescription('');
      setActiveTab('FAQ');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to submit ticket. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color="#111827" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Segmented Control */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'FAQ' && styles.tabButtonActive]}
          onPress={() => setActiveTab('FAQ')}
        >
          <Text style={[styles.tabText, activeTab === 'FAQ' && styles.tabTextActive]}>Knowledge Base</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'CONTACT' && styles.tabButtonActive]}
          onPress={() => setActiveTab('CONTACT')}
        >
          <Text style={[styles.tabText, activeTab === 'CONTACT' && styles.tabTextActive]}>Contact Us</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : null}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          
          {activeTab === 'FAQ' ? (
            <View style={{ paddingBottom: 40 }}>
              <View style={styles.heroSection}>
                <HeadphonesIcon color="#059669" size={40} style={{ marginBottom: 12 }} />
                <Text style={styles.heroTitle}>How can we help you?</Text>
                <Text style={styles.heroSub}>Find answers to the most common questions below.</Text>
              </View>

              {FAQ_DATA.map((section, idx) => (
                <View key={idx} style={styles.categorySection}>
                  <View style={styles.categoryHeader}>
                    <section.icon color="#2563EB" size={20} />
                    <Text style={styles.categoryTitle}>{section.category}</Text>
                  </View>
                  {section.questions.map((item, qIdx) => (
                    <AccordionItem key={qIdx} q={item.q} a={item.a} />
                  ))}
                </View>
              ))}
            </View>
          ) : (
            <View style={{ paddingBottom: 40 }}>
              <View style={styles.heroSection}>
                <Send color="#2563EB" size={40} style={{ marginBottom: 12 }} />
                <Text style={styles.heroTitle}>Raise a Ticket</Text>
                <Text style={styles.heroSub}>Describe your issue in detail and our support agents will assist you.</Text>
              </View>

              <View style={styles.formContainer}>
                
                <Text style={styles.label}>Issue Category *</Text>
                <TouchableOpacity 
                  style={styles.dropdownTrigger} 
                  onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
                >
                  <Text style={{ color: issueCategory ? '#111827' : '#9CA3AF', fontSize: 15 }}>
                    {issueCategory || "Select an issue"}
                  </Text>
                  {showCategoryDropdown ? <ChevronUp color="#6B7280" size={20} /> : <ChevronDown color="#6B7280" size={20} />}
                </TouchableOpacity>

                {showCategoryDropdown && (
                  <View style={styles.dropdownList}>
                    {categories.map((cat) => (
                      <TouchableOpacity 
                        key={cat} 
                        style={styles.dropdownItem}
                        onPress={() => {
                          setIssueCategory(cat);
                          setShowCategoryDropdown(false);
                        }}
                      >
                        <Text style={styles.dropdownItemText}>{cat}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <Text style={[styles.label, { marginTop: 20 }]}>Related Order ID (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 123456"
                  value={orderId}
                  onChangeText={setOrderId}
                  keyboardType="numeric"
                  placeholderTextColor="#9CA3AF"
                />

                <Text style={[styles.label, { marginTop: 20 }]}>Detailed Description *</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="Please describe exactly what went wrong..."
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  placeholderTextColor="#9CA3AF"
                />

                <TouchableOpacity 
                  style={[styles.submitBtn, (!issueCategory || !description.trim()) && styles.submitBtnDisabled]}
                  onPress={handleSubmitTicket}
                  disabled={isSubmitting || !issueCategory || !description.trim()}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitBtnText}>Submit Complaint</Text>
                  )}
                </TouchableOpacity>

              </View>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  
  tabContainer: { flexDirection: 'row', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabButtonActive: { backgroundColor: '#F0FDF4' },
  tabText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  tabTextActive: { color: '#0D9494' },

  content: { flex: 1, padding: 16 },
  
  heroSection: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  heroTitle: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  heroSub: { fontSize: 14, color: '#4B5563', textAlign: 'center', lineHeight: 20 },

  categorySection: { marginBottom: 24 },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingLeft: 4 },
  categoryTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginLeft: 8 },
  
  accordionContainer: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#F3F4F6' },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  questionText: { fontSize: 14, fontWeight: '600', color: '#374151', flex: 1, paddingRight: 16, lineHeight: 20 },
  accordionBody: { paddingHorizontal: 16, paddingBottom: 16 },
  answerText: { fontSize: 14, color: '#6B7280', lineHeight: 22 },

  formContainer: { backgroundColor: '#fff', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#374151', marginBottom: 8 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, height: 50, fontSize: 15, color: '#111827' },
  textArea: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 14, minHeight: 120, fontSize: 15, color: '#111827' },
  
  dropdownTrigger: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, height: 50 },
  dropdownList: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  dropdownItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dropdownItemText: { fontSize: 15, color: '#374151' },

  submitBtn: { backgroundColor: '#0D9494', borderRadius: 12, height: 54, alignItems: 'center', justifyContent: 'center', marginTop: 32 },
  submitBtnDisabled: { backgroundColor: '#A7F3D0' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
