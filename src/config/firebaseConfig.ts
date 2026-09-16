import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getDatabase, Database } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Auth = FirebaseAuth.Auth;
const { initializeAuth } = FirebaseAuth;
const getReactNativePersistence = (FirebaseAuth as any).getReactNativePersistence;

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCUEMXJi6p5pj_CBIaKI54L_2I1Yu5Sm2w',
  authDomain: 'delivery-rider-app-415b7.firebaseapp.com',
  projectId: 'delivery-rider-app-415b7',
  storageBucket: 'delivery-rider-app-415b7.firebasestorage.app',
  messagingSenderId: '85256601097',
  appId: '1:85256601097:android:3d6168cc12a624d33482d8',
  databaseURL: 'https://delivery-rider-app-415b7-default-rtdb.asia-southeast1.firebasedatabase.app',
};

export const isUsingPlaceholderCredentials = (): boolean => {
  return (
    !FIREBASE_CONFIG.apiKey ||
    FIREBASE_CONFIG.apiKey.includes('PLACEHOLDER') ||
    FIREBASE_CONFIG.projectId === 'delivery-rider-app-demo'
  );
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let rtdb: Database;

try {
  if (getApps().length === 0) {
    app = initializeApp(FIREBASE_CONFIG);
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } else {
    app = getApp();
    // @ts-ignore
    auth = app.auth?.() || initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  }
  db = getFirestore(app);
  rtdb = getDatabase(app);
} catch (error) {
  console.warn('[FirebaseConfig] Initialization warning:', error);
  app = getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CONFIG);
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // @ts-ignore
    auth = (app as any).auth;
  }
  db = getFirestore(app);
  rtdb = getDatabase(app);
}

export { app, auth, db, rtdb };
