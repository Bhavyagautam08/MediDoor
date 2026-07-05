const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "[REDACTED]",
  authDomain: "medidoor-f8af9.firebaseapp.com",
  projectId: "medidoor-f8af9",
  storageBucket: "medidoor-f8af9.firebasestorage.app",
  messagingSenderId: "124078476328",
  appId: "1:124078476328:web:a48af81635045ea7d6791d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testConnection() {
  try {
    console.log('Testing Firestore connection...');
    await setDoc(doc(db, 'testCollection', 'testDoc'), {
      timestamp: new Date().toISOString()
    });
    console.log('Firestore write successful! Database exists and permissions are open.');
    process.exit(0);
  } catch (error) {
    console.error('Firestore write failed:', error);
    process.exit(1);
  }
}

testConnection();
