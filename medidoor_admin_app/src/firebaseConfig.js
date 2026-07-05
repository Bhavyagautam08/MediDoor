import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "[REDACTED]",
  authDomain: "medidoor-f8af9.firebaseapp.com",
  databaseURL: "https://medidoor-f8af9-default-rtdb.firebaseio.com",
  projectId: "medidoor-f8af9",
  storageBucket: "medidoor-f8af9.firebasestorage.app",
  messagingSenderId: "124078476328",
  appId: "1:124078476328:web:a48af81635045ea7d6791d",
  measurementId: "G-2C34P8K81Z"
};

export const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

export const db = getFirestore(app);
export const storage = getStorage(app);
