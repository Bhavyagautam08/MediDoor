import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { ArrowLeft } from 'lucide-react-native';

export default function UpiPaymentScreen({ route, navigation }) {
  const { paymentLink, orderDocId, numericId } = route.params || {};
  const [loading, setLoading] = useState(true);

  if (!paymentLink) {
    return (
      <SafeAreaView style={styles.container}>
         <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
               <ArrowLeft color="#0F172A" size={24} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Error</Text>
            <View style={{ width: 24 }} />
         </View>
         <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text>Missing Payment Link. Please try again.</Text>
         </View>
      </SafeAreaView>
    );
  }

  const onShouldStartLoadWithRequest = (request) => {
    const { url } = request;
    
    // 1. Detect our custom success redirect from the Cloud Function webhook
    if (url.includes('medidoor://payment-complete')) {
      navigation.replace('LiveTracking', { orderId: orderDocId });
      return false; 
    }

    // 2. Handle native UPI intent deep links (e.g., tez://, phonepe://, paytm://)
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:')) {
      Linking.canOpenURL(url).then(supported => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert('App Not Found', 'No compatible app found to open this payment method.');
        }
      }).catch(err => console.error("Intent Error:", err));
      return false; // Don't try to load intent URLs in the webview
    }

    return true; 
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft color="#0F172A" size={24} />
         </TouchableOpacity>
         <Text style={styles.headerTitle}>Secure Payment</Text>
         <View style={{ width: 24 }} />
      </View>
      <View style={{ flex: 1 }}>
        <WebView
          source={{ uri: paymentLink }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          onMessage={(event) => {
             try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === 'PAYMENT_COMPLETE') {
                   navigation.replace('LiveTracking', { orderId: orderDocId });
                }
             } catch(e) {}
          }}
          setSupportMultipleWindows={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          style={{ flex: 1 }}
        />
        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#00C853" />
            <Text style={{ marginTop: 12, color: '#00C853', fontWeight: 'bold' }}>Loading Secure Gateway...</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 3,
    zIndex: 10,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  loader: { 
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
    justifyContent: 'center', alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.9)' 
  }
});
