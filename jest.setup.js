/* eslint-env jest */

// In-memory AsyncStorage Mock
const mockStorage = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn((k, v) => {
    mockStorage[k] = v;
    return Promise.resolve();
  }),
  getItem: jest.fn(k => Promise.resolve(mockStorage[k] || null)),
  removeItem: jest.fn(k => {
    delete mockStorage[k];
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => Promise.resolve(Object.keys(mockStorage))),
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => () => {}),
  fetch: jest.fn(() =>
    Promise.resolve({
      isConnected: true,
      isInternetReachable: true,
    })
  ),
}));

// Mock Geolocation
jest.mock('@react-native-community/geolocation', () => ({
  setRNConfiguration: jest.fn(),
  requestAuthorization: jest.fn(cb => cb && cb()),
  getCurrentPosition: jest.fn(cb =>
    cb({
      coords: {
        latitude: 12.9716,
        longitude: 77.5946,
        accuracy: 5,
        altitude: 900,
        heading: 0,
        speed: 0,
      },
      timestamp: Date.now(),
    })
  ),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
  stopObserving: jest.fn(),
}));

// Mock BackgroundActions
jest.mock('react-native-background-actions', () => ({
  start: jest.fn(() => Promise.resolve()),
  stop: jest.fn(() => Promise.resolve()),
  isRunning: jest.fn(() => false),
  updateNotification: jest.fn(() => Promise.resolve()),
}));

// Mock Firebase Modular SDK
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => [{}]),
  getApp: jest.fn(() => ({})),
}));

jest.mock('firebase/auth', () => ({
  initializeAuth: jest.fn(() => ({ currentUser: null })),
  getReactNativePersistence: jest.fn(() => ({})),
  signInWithEmailAndPassword: jest.fn(() =>
    Promise.resolve({
      user: { uid: 'rider_test_1', email: 'rider@delivery.com' },
    })
  ),
  createUserWithEmailAndPassword: jest.fn(() =>
    Promise.resolve({
      user: { uid: 'rider_test_1', email: 'rider@delivery.com' },
    })
  ),
  signOut: jest.fn(() => Promise.resolve()),
  onAuthStateChanged: jest.fn((auth, cb) => {
    cb(null);
    return () => {};
  }),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  doc: jest.fn((db, coll, id) => ({ id, path: `${coll}/${id}` })),
  setDoc: jest.fn(() => Promise.resolve()),
  collection: jest.fn(() => ({})),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
  orderBy: jest.fn(() => ({})),
  limit: jest.fn(() => ({})),
  onSnapshot: jest.fn((q, cb) => {
    cb({
      forEach: () => {},
    });
    return () => {};
  }),
  getDocs: jest.fn(() => Promise.resolve({ forEach: () => {} })),
}));
