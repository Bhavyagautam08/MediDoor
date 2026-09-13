import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TabNavigator from './src/navigation/TabNavigator';
import LoginScreen from './src/screens/LoginScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import UserDetailsScreen from './src/screens/UserDetailsScreen';
import DashboardRevenueScreen from './src/screens/DashboardRevenueScreen';
import DashboardOrdersScreen from './src/screens/DashboardOrdersScreen';
import DashboardPharmaciesScreen from './src/screens/DashboardPharmaciesScreen';
import DashboardUsersScreen from './src/screens/DashboardUsersScreen';
import SendNotificationScreen from './src/screens/SendNotificationScreen';
import SettlementsScreen from './src/screens/SettlementsScreen';
import DisputesScreen from './src/screens/DisputesScreen';
import AdvertisementsScreen from './src/screens/AdvertisementsScreen';
import { auth, db } from './src/firebaseConfig';
import { ActivityIndicator, View } from 'react-native';
import { registerForPushNotificationsAsync, registerNotificationListeners, savePushToken } from './src/services/pushNotifications';

const Stack = createNativeStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeListeners = registerNotificationListeners();
    const unsubscribe = onAuthStateChanged(auth, async (usr) => {
      if (usr) {
        try {
          // Rescue users who are logged in but missing the admin role in Firestore
          await setDoc(doc(db, 'platformAdmins', usr.uid), {
            email: usr.email,
            createdAt: new Date(),
            role: 'Platform Admin'
          }, { merge: true });

          // Register Push Notifications
          const token = await registerForPushNotificationsAsync();
          if (token) {
            await savePushToken(usr.uid, 'Platform Admin', token);
          }
        } catch (error) {
          console.error("Failed to upgrade role or register push:", error);
        }
      }
      setUser(usr);
      setLoading(false);
    });
    return () => {
      unsubscribe();
      unsubscribeListeners();
    };
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="UserDetails" component={UserDetailsScreen} />
          <Stack.Screen name="DashboardRevenue" component={DashboardRevenueScreen} />
          <Stack.Screen name="DashboardOrders" component={DashboardOrdersScreen} />
          <Stack.Screen name="DashboardPharmacies" component={DashboardPharmaciesScreen} />
          <Stack.Screen name="DashboardUsers" component={DashboardUsersScreen} />
          <Stack.Screen name="SendNotification" component={SendNotificationScreen} />
          <Stack.Screen name="Settlements" component={SettlementsScreen} />
          <Stack.Screen name="Disputes" component={DisputesScreen} />
          <Stack.Screen name="Advertisements" component={AdvertisementsScreen} />
        </Stack.Navigator>
      ) : (
        <LoginScreen />
      )}
    </NavigationContainer>
  );
}
