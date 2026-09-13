import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

// Normalize any role string to a canonical value
const normalizeRole = (role) => {
  if (!role) return 'Customer';
  const r = role.trim();
  if (r === 'Pharmacy Admin' || r === 'Pharmacy' || r === 'pharmacy') return 'Pharmacy Admin';
  if (r === 'Delivery Agent' || r === 'Delivery' || r === 'delivery') return 'Delivery Agent';
  return 'Customer';
};

// Get the correct collection for a normalized role
export const getCollection = (role) => {
  if (role === 'Pharmacy Admin') return 'pharmacies';
  if (role === 'Delivery Agent') return 'delivery_agents';
  return 'customers';
};

export const createAuthUser = async (email, password) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  return userCredential.user;
};

export const saveUserDocument = async (uid, email, role, additionalData = {}) => {
  const normalizedRole = normalizeRole(role);
  const collectionName = getCollection(normalizedRole);

  await setDoc(doc(db, collectionName, uid), {
    email: email,
    role: normalizedRole,
    createdAt: new Date().toISOString(),
    ...additionalData,
  });

  return { role: normalizedRole };
};

/**
 * Register a new user and save them to the correct collection
 */
export const registerUser = async (email, password, role, additionalData = {}) => {
  const user = await createAuthUser(email, password);
  await saveUserDocument(user.uid, email, role, additionalData);
  return { user, role: normalizeRole(role) };
};

export const getUserRole = async (uid) => {
  // Fetch from all 3 collections in parallel
  const [customerSnap, pharmacySnap, deliverySnap] = await Promise.all([
    getDoc(doc(db, 'customers', uid)),
    getDoc(doc(db, 'pharmacies', uid)),
    getDoc(doc(db, 'delivery_agents', uid)),
  ]);

  // Priority: pharmacies > delivery_agents > customers
  // This ensures correctly-placed accounts are found first
  if (pharmacySnap.exists()) {
    const pharmacyData = pharmacySnap.data();
    const status = pharmacyData.status;
    // Gate access based on approval status
    if (status === 'suspended') {
      throw new Error('account-suspended');
    }
    if (status === 'pending') return { role: 'PharmacyPending', data: pharmacyData };
    if (status === 'rejected') return { role: 'PharmacyRejected', data: pharmacyData };
    // 'approved' or no status field (legacy accounts) → full access
    return { role: 'Pharmacy Admin', data: pharmacyData };
  }

  if (deliverySnap.exists()) {
    return { role: 'Delivery Agent', data: deliverySnap.data() };
  }

  if (customerSnap.exists()) {
    const data = customerSnap.data();
    const storedRole = normalizeRole(data.role);

    // Self-healing migration: account was misplaced in 'customers' by the old bug
    if (storedRole === 'Pharmacy Admin' || storedRole === 'Delivery Agent') {
      const correctCollection = getCollection(storedRole);
      const correctedData = { ...data, role: storedRole };

      // Move doc to correct collection and remove from customers
      await setDoc(doc(db, correctCollection, uid), correctedData);
      await deleteDoc(doc(db, 'customers', uid));

      console.log(`[AuthService] Migrated user ${uid} from 'customers' → '${correctCollection}'`);
      return { role: storedRole, data: correctedData };
    }

    // Genuinely a customer
    return { role: 'Customer', data };
  }

  // SELF-HEALING: If the user exists in Authentication but has no database document 
  // (happens when deleted manually from Firestore or on network crash during signup),
  // we recreate them as a Customer to prevent them from being permanently locked out.
  console.warn(`User ${uid} missing from Firestore. Self-healing as Customer.`);
  const defaultData = {
    email: auth.currentUser?.email || '',
    role: 'Customer',
    createdAt: new Date().toISOString()
  };
  await setDoc(doc(db, 'customers', uid), defaultData);
  return { role: 'Customer', data: defaultData };
};

/**
 * Login — checks all 3 collections AND self-heals misplaced accounts.
 * 
 * Old bug: Users registered as 'Pharmacy'/'Delivery' were saved in 'customers'
 * because the old code didn't recognize those role strings. This function
 * detects such accounts by reading their stored 'role' field, migrates them
 * to the correct collection, and returns the correct role for routing.
 */
export const loginUser = async (email, password) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  const { role, data } = await getUserRole(user.uid);
  return { user, role, data };
};

/**
 * Logout
 */
export const logoutUser = async () => {
  await signOut(auth);
};
