import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Auth = FirebaseAuth.Auth;
const { initializeAuth } = FirebaseAuth;
const getReactNativePersistence = (FirebaseAuth as any).getReactNativePersistence;

/**
 * Firebase Project Configuration
 *
 * In production, these should be supplied via environment variables (e.g. react-native-config or .env)
 * Replace placeholder values below with your Firebase Console credentials:
 * Console: https://console.firebase.google.com -> Project Settings -> General -> Your apps
 */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyA_PLACEHOLDER_KEY_YOUR_PROJECT',
  authDomain: 'delivery-rider-app-demo.firebaseapp.com',
  projectId: 'delivery-rider-app-demo',
  storageBucket: 'delivery-rider-app-demo.appspot.com',
  messagingSenderId: '100000000000',
  appId: '1:100000000000:web:abcdef1234567890abcdef',
};

// Check if credentials are still set to placeholder values
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

try {
  if (getApps().length === 0) {
    app = initializeApp(FIREBASE_CONFIG);
    // Use React Native AsyncStorage persistence for auth sessions across restarts
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } else {
    app = getApp();
    // @ts-ignore
    auth = app.auth?.() || initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  }
  db = getFirestore(app);
} catch (error) {
  console.warn('[FirebaseConfig] Initialization warning:', error);
  // Fallback safe initialization if already initialized
  app = getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CONFIG);
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // If already initialized
    // @ts-ignore
    auth = (app as any).auth;
  }
  db = getFirestore(app);
}

export { app, auth, db };
