const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "fake",
  projectId: "medidoor-f8af9",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, 'pharmacies'));
  let i = 0;
  for (const d of snap.docs) {
    const data = d.data();
    console.log(d.id, data.name, data.dist);
    // Give them dummy coordinates in South Delhi
    await updateDoc(doc(db, 'pharmacies', d.id), {
      latitude: 28.5835 + (i * 0.01),
      longitude: 77.2530 + (i * 0.01)
    });
    i++;
  }
  console.log("Updated!");
  process.exit(0);
}
run();
