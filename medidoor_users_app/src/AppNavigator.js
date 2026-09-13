import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebaseConfig';
import { getUserRole } from './services/authService';
import { registerForPushNotificationsAsync, registerNotificationListeners, savePushToken } from './services/pushNotifications';
import { navigationRef } from './navigation/NavigationService';
import * as Notifications from 'expo-notifications';

// Auth Screens
import IntroScreen from './screens/auth/IntroScreen';
import RoleSelectionScreen from './screens/auth/RoleSelectionScreen';
import SignUpScreen from './screens/auth/SignUpScreen';
import LoginScreen from './screens/auth/LoginScreen';
import OtpLoginScreen from './screens/auth/OtpLoginScreen';
import UnderReviewScreen from './screens/auth/UnderReviewScreen';
import RejectedScreen from './screens/auth/RejectedScreen';
import OnboardingScreen from './screens/auth/OnboardingScreen';

// Role Navigators
import CustomerTabs from './navigation/CustomerTabs';
import PharmacyTabs from './navigation/PharmacyTabs';
import DeliveryTabs from './navigation/DeliveryTabs';

// Customer specific screens that hide bottom tabs
import PharmacyDetailScreen from './screens/customer/PharmacyDetailScreen';
import CheckoutScreen from './screens/customer/CheckoutScreen';
import OrdersScreen from './screens/customer/OrdersScreen';
import AddressesScreen from './screens/customer/AddressesScreen';
import PaymentsScreen from './screens/customer/PaymentsScreen';
import EditProfileScreen from './screens/customer/EditProfileScreen';
import LiveTrackingScreen from './screens/customer/LiveTrackingScreen';
import UploadPrescriptionScreen from './screens/customer/UploadPrescriptionScreen';
import PrescriptionQuotesScreen from './screens/customer/PrescriptionQuotesScreen';
import UpiPaymentScreen from './screens/customer/UpiPaymentScreen';
import NotificationsScreen from './screens/customer/NotificationsScreen';
import AllPharmaciesScreen from './screens/customer/AllPharmaciesScreen';
import HelpSupportScreen from './screens/customer/HelpSupportScreen';
import LikedPharmaciesScreen from './screens/customer/LikedPharmaciesScreen';
import ShopByCategoryScreen from './screens/customer/ShopByCategoryScreen';
import MapScreen from './screens/delivery/MapScreen';

import FloatingActiveOrder from './components/FloatingActiveOrder';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initialRoute, setInitialRoute] = useState('Login');
  const [currentRouteName, setCurrentRouteName] = useState('');
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (response && !isInitializing && navigationRef.isReady()) {
      const data = response.notification.request.content.data;
      if (data?.type === 'live_prescription') {
        navigationRef.navigate('PharmacyRoot', { screen: 'Prescriptions' });
      }
    }
  }, [response, isInitializing]);

  useEffect(() => {
    const unsubscribeListeners = registerNotificationListeners();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const { role } = await getUserRole(user.uid);
          
          // Push notification registration
          if (role && role !== 'PharmacyPending' && role !== 'PharmacyRejected') {
            const token = await registerForPushNotificationsAsync();
            if (token) {
              await savePushToken(user.uid, role, token);
            }
          }

          if (role === 'Customer') setInitialRoute('CustomerRoot');
          else if (role === 'Pharmacy Admin') setInitialRoute('PharmacyRoot');
          else if (role === 'PharmacyPending') setInitialRoute('UnderReview');
          else if (role === 'PharmacyRejected') setInitialRoute('Rejected');
          else if (role === 'Delivery Agent') setInitialRoute('DeliveryRoot');
          else setInitialRoute('RoleSelection');
        } catch (error) {
          if (error.message === 'account-suspended') {
            console.log("Account suspended, redirecting to login.");
          } else {
            console.error("Error fetching user role on startup:", error);
          }
          setInitialRoute('Login');
        }
      } else {
        setInitialRoute('Login');
      }
      setIsInitializing(false);
    });

    return () => {
      unsubscribe();
      unsubscribeListeners();
    };
  }, []);

  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0D9494" />
      </View>
    );
  }

  return (
    <NavigationContainer 
      ref={navigationRef}
      onStateChange={() => {
        const routeName = navigationRef.current?.getCurrentRoute()?.name;
        if (routeName) setCurrentRouteName(routeName);
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
        {/* Onboarding Flow */}
        <Stack.Screen name="Intro" component={IntroScreen} />
        <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="OtpLogin" component={OtpLoginScreen} />
        <Stack.Screen name="UnderReview" component={UnderReviewScreen} />
        <Stack.Screen name="Rejected" component={RejectedScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        
        {/* Customer Flow */}
        <Stack.Screen name="CustomerRoot" component={CustomerTabs} />
        <Stack.Screen name="PharmacyDetail" component={PharmacyDetailScreen} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen name="UpiPayment" component={UpiPaymentScreen} />
        <Stack.Screen name="Orders" component={OrdersScreen} />
        <Stack.Screen name="Addresses" component={AddressesScreen} />
        <Stack.Screen name="Payments" component={PaymentsScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="LiveTracking" component={LiveTrackingScreen} />
        <Stack.Screen name="UploadPrescription" component={UploadPrescriptionScreen} />
        <Stack.Screen name="PrescriptionQuotes" component={PrescriptionQuotesScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="AllPharmacies" component={AllPharmaciesScreen} />
        <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
        <Stack.Screen name="LikedPharmacies" component={LikedPharmaciesScreen} />
        <Stack.Screen name="ShopByCategory" component={ShopByCategoryScreen} />

        {/* Pharmacy Flow */}
        <Stack.Screen name="PharmacyRoot" component={PharmacyTabs} />
        
        {/* Delivery Flow */}
        <Stack.Screen name="DeliveryRoot" component={DeliveryTabs} />
        <Stack.Screen name="Map" component={MapScreen} />

      </Stack.Navigator>
      <FloatingActiveOrder currentRouteName={currentRouteName} />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  }
});
