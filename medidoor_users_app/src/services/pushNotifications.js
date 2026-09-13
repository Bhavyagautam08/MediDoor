import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import Constants from 'expo-constants';
import { db } from '../firebaseConfig';
import { getCollection } from './authService';
import { navigate } from '../navigation/NavigationService';

// How notifications behave when app is in foreground or background
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function configureAndroidChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
    
    await Notifications.setNotificationChannelAsync('high_priority_orders', {
      name: 'High Priority Orders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#FF231F7C',
      sound: true,
    });
  }
}

export function registerNotificationListeners() {
  const notificationReceivedListener = Notifications.addNotificationReceivedListener(notification => {
    console.log('Notification received while app is running:', notification);
  });

  const notificationResponseListener = Notifications.addNotificationResponseReceivedListener(response => {
    console.log('Notification response received:', response);
    const data = response.notification.request.content.data;
    
    // Check if it's a live prescription notification
    if (data?.type === 'live_prescription') {
      navigate('PharmacyRoot', { screen: 'Prescriptions' });
    }
  });

  return () => {
    notificationReceivedListener.remove();
    notificationResponseListener.remove();
  };
}

export async function registerForPushNotificationsAsync() {
  let token;

  await configureAndroidChannel();

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return null;
    }
    
    try {
      // Use Native FCM Device Token to bypass Expo push notification requirements
      const tokenData = await Notifications.getDevicePushTokenAsync();
      token = tokenData.data;
    } catch (e) {
      console.warn("Could not get device push token. Push notifications will be disabled for this session.", e);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

export const savePushToken = async (uid, role, token) => {
  if (!token || !uid || !role) return;
  try {
    let collectionName = 'customers';
    if (role === 'Pharmacy Admin') collectionName = 'pharmacies';
    if (role === 'Delivery Agent') collectionName = 'delivery_agents';
    
    await updateDoc(doc(db, collectionName, uid), {
      pushToken: token
    });
  } catch (error) {
    console.error("Error saving push token to Firestore", error);
  }
};
