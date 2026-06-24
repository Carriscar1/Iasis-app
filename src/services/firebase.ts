// ─────────────────────────────────────────────
//  IASIS — Firebase Service
//  Firestore + Auth + push tokens
// ─────────────────────────────────────────────
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  Auth,
  User as FbUser,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  Firestore,
} from 'firebase/firestore';

import {
  User,
  Dose,
  Dispenser,
  Alert,
  AdherenceStats,
  DoseStatus,
} from '../types';

// ─── Config ──────────────────────────────────
// ⚠️ Substitua pelos valores do seu projeto Firebase!
const firebaseConfig = {
  apiKey:            'SUA_API_KEY',
  authDomain:        'seu-projeto.firebaseapp.com',
  projectId:         'seu-projeto',
  storageBucket:     'seu-projeto.appspot.com',
  messagingSenderId: 'SEU_SENDER_ID',
  appId:             'SEU_APP_ID',
};

// ─── Init singleton ───────────────────────────
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (!getApps().length) {
  app  = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

auth = getAuth(app);
db   = getFirestore(app);

export { auth, db };

// ─────────────────────────────────────────────
//  AUTH
// ─────────────────────────────────────────────
export const login = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const register = async (
  email: string,
  password: string,
  name: string,
  role: 'patient' | 'caregiver' = 'patient'
) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const user: User = {
    uid:       cred.user.uid,
    name,
    email,
    role,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'users', cred.user.uid), user);
  return { cred, user };
};

export const signOut = () => fbSignOut(auth);

export const onAuthChange = (callback: (user: FbUser | null) => void) =>
  onAuthStateChanged(auth, callback);

// ─────────────────────────────────────────────
//  USERS
// ─────────────────────────────────────────────
export const getUser = async (uid: string): Promise<User | null> => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as User) : null;
};

export const updateUser = (uid: string, data: Partial<User>) =>
  updateDoc(doc(db, 'users', uid), data);

// ─────────────────────────────────────────────
//  DOSES
// ─────────────────────────────────────────────
export const getDosesToday = async (userId: string): Promise<Dose[]> => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const q = query(
    collection(db, 'doses'),
    where('userId', '==', userId),
    where('scheduledAt', '>=', start.toISOString()),
    where('scheduledAt', '<=', end.toISOString()),
    orderBy('scheduledAt', 'asc')
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Dose));
};

export const getDosesRange = async (
  userId: string,
  from: Date,
  to: Date
): Promise<Dose[]> => {
  const q = query(
    collection(db, 'doses'),
    where('userId', '==', userId),
    where('scheduledAt', '>=', from.toISOString()),
    where('scheduledAt', '<=', to.toISOString()),
    orderBy('scheduledAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Dose));
};

export const updateDoseStatus = (
  doseId: string,
  status: DoseStatus,
  extra?: Partial<Dose>
) =>
  updateDoc(doc(db, 'doses', doseId), {
    status,
    ...extra,
  });

export const addDose = (dose: Omit<Dose, 'id'>) =>
  addDoc(collection(db, 'doses'), dose);

// Realtime listener para doses do dia
export const subscribeTodayDoses = (
  userId: string,
  callback: (doses: Dose[]) => void
) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const q = query(
    collection(db, 'doses'),
    where('userId', '==', userId),
    where('scheduledAt', '>=', start.toISOString()),
    where('scheduledAt', '<=', end.toISOString()),
    orderBy('scheduledAt', 'asc')
  );

  return onSnapshot(q, snap => {
    const doses = snap.docs.map(d => ({ id: d.id, ...d.data() } as Dose));
    callback(doses);
  });
};

// ─────────────────────────────────────────────
//  DISPENSER
// ─────────────────────────────────────────────
export const getDispenser = async (userId: string): Promise<Dispenser | null> => {
  const q = query(
    collection(db, 'dispensers'),
    where('userId', '==', userId),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as Dispenser;
};

export const subscribeDispenser = (
  dispenserId: string,
  callback: (dispenser: Dispenser) => void
) =>
  onSnapshot(doc(db, 'dispensers', dispenserId), snap => {
    if (snap.exists()) {
      callback({ id: snap.id, ...snap.data() } as Dispenser);
    }
  });

export const updateDispenserSensors = (
  dispenserId: string,
  sensors: Dispenser['sensors']
) =>
  updateDoc(doc(db, 'dispensers', dispenserId), {
    sensors,
    lastSeen: new Date().toISOString(),
    online:   true,
  });

// ─────────────────────────────────────────────
//  ALERTS
// ─────────────────────────────────────────────
export const getAlerts = async (userId: string, unreadOnly = false): Promise<Alert[]> => {
  let q = query(
    collection(db, 'alerts'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  if (unreadOnly) {
    q = query(q, where('read', '==', false));
  }

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Alert));
};

export const markAlertRead = (alertId: string) =>
  updateDoc(doc(db, 'alerts', alertId), { read: true });

export const addAlert = (alert: Omit<Alert, 'id'>) =>
  addDoc(collection(db, 'alerts'), alert);

// ─────────────────────────────────────────────
//  ESTATÍSTICAS
// ─────────────────────────────────────────────
export const computeAdherence = (doses: Dose[]): number => {
  if (!doses.length) return 0;
  const taken = doses.filter(d => d.status === 'taken' || d.status === 'late').length;
  return Math.round((taken / doses.length) * 100);
};
