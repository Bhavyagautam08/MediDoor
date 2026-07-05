import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import Constants from 'expo-constants';
import { db } from '../firebaseConfig';
import { getCollection } from './authService';

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
  }
}

export function registerNotificationListeners() {
  const notificationReceivedListener = Notifications.addNotificationReceivedListener(notification => {
    console.log('Notification received while app is running:', notification);
  });

  const notificationResponseListener = Notifications.addNotificationResponseReceivedListener(response => {
    console.log('Notification response received:', response);
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
      // Use Expo Push Token which is required by expo-server-sdk in Cloud Functions
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId ?? "fallback-project-id";
      
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId, // This is required for Expo SDK 50+, even if undefined
      });
      token = tokenData.data;
    } catch (e) {
      console.warn("Could not get Expo push token (Likely missing projectId in app.json). Push notifications will be disabled for this session.");
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
