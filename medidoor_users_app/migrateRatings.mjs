import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';
import dotenv from 'dotenv';

dotenv.config();
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateRatings() {
  console.log("Starting rating migration...");
  const ordersSnap = await getDocs(collection(db, 'orders'));
  
  const pharmacyRatings = {};
  const driverRatings = {};

  ordersSnap.forEach(docSnap => {
    const data = docSnap.data();
    
    // Pharmacy
    if (data.pharmacyId && typeof data.serviceRating === 'number' && data.serviceRating > 0) {
      if (!pharmacyRatings[data.pharmacyId]) pharmacyRatings[data.pharmacyId] = { total: 0, count: 0 };
      pharmacyRatings[data.pharmacyId].total += data.serviceRating;
      pharmacyRatings[data.pharmacyId].count += 1;
    }

    // Driver
    if (data.riderId && typeof data.deliveryRating === 'number' && data.deliveryRating > 0) {
      if (!driverRatings[data.riderId]) driverRatings[data.riderId] = { total: 0, count: 0 };
      driverRatings[data.riderId].total += data.deliveryRating;
      driverRatings[data.riderId].count += 1;
    }
  });

  for (const [pId, stats] of Object.entries(pharmacyRatings)) {
    if (stats.count > 0) {
      const avg = (stats.total / stats.count).toFixed(1);
      await setDoc(doc(db, 'pharmacies', pId), { rating: avg, reviewCount: stats.count, totalRating: stats.total }, { merge: true });
      console.log(`Updated pharmacy ${pId} -> rating: ${avg}`);
    }
  }

  for (const [dId, stats] of Object.entries(driverRatings)) {
    if (stats.count > 0) {
      const avg = (stats.total / stats.count).toFixed(1);
      await setDoc(doc(db, 'delivery_agents', dId), { rating: avg, reviewCount: stats.count, totalRating: stats.total }, { merge: true });
      console.log(`Updated driver ${dId} -> rating: ${avg}`);
    }
  }

  console.log("Migration complete!");
}

migrateRatings().catch(console.error);
