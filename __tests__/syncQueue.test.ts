import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SyncQueueService,
  generateUUID,
  OFFLINE_QUEUE_STORAGE_KEY,
} from '../src/services/syncQueue';
import { LocationLogEntry } from '../src/types';

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStorage[key];
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    return Promise.resolve();
  }),
}));

// Mock NetInfo
let mockIsConnected = false;
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(callback => {
    return () => {};
  }),
  fetch: jest.fn(() =>
    Promise.resolve({
      isConnected: mockIsConnected,
      isInternetReachable: mockIsConnected,
    })
  ),
}));

// Mock Firestore
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((db, coll, id) => ({ id, path: `${coll}/${id}` })),
  setDoc: jest.fn(() => Promise.resolve()),
  collection: jest.fn(() => ({})),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
  orderBy: jest.fn(() => ({})),
  limit: jest.fn(() => ({})),
  onSnapshot: jest.fn(() => () => {}),
  getDocs: jest.fn(() => Promise.resolve([])),
}));

jest.mock('../src/config/firebaseConfig', () => ({
  isUsingPlaceholderCredentials: () => true, // Reviewer / Mock mode
  db: {},
}));

describe('Offline Resilience & SyncQueueService', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    mockIsConnected = false;
    SyncQueueService.setOnlineStatus(false);
  });

  it('generates unique valid RFC4122 v4 UUIDs for each log entry', () => {
    const uuid1 = generateUUID();
    const uuid2 = generateUUID();
    expect(uuid1).not.toBe(uuid2);
    expect(uuid1).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('safely queues location log entry when device is offline', async () => {
    const entryData = {
      riderId: 'rider_test_123',
      latitude: 12.9716,
      longitude: 77.5946,
      timestamp: Date.now(),
      distanceMoved: 35.4,
      accuracy: 5.0,
    };

    const enqueued = await SyncQueueService.enqueueLocationLog(entryData);

    expect(enqueued.id).toBeDefined();
    expect(enqueued.synced).toBe(false);
    expect(enqueued.distanceMoved).toBe(35.4);

    const pending = await SyncQueueService.getPendingQueue();
    expect(pending.length).toBe(1);
    expect(pending[0].id).toBe(enqueued.id);
    expect(pending[0].riderId).toBe('rider_test_123');
  });

  it('enqueues multiple qualifying points sequentially without data loss', async () => {
    const baseTime = Date.now();
    for (let i = 0; i < 3; i++) {
      await SyncQueueService.enqueueLocationLog({
        riderId: 'rider_test_123',
        latitude: 12.9716 + i * 0.0005,
        longitude: 77.5946 + i * 0.0005,
        timestamp: baseTime + i * 10000,
        distanceMoved: 32 + i * 5,
      });
    }

    const pending = await SyncQueueService.getPendingQueue();
    expect(pending.length).toBe(3);
  });

  it('flushes pending queue and empties the offline store upon synchronization', async () => {
    // Add two items
    await SyncQueueService.enqueueLocationLog({
      riderId: 'rider_test_123',
      latitude: 12.9716,
      longitude: 77.5946,
      timestamp: Date.now(),
      distanceMoved: 31.2,
    });
    await SyncQueueService.enqueueLocationLog({
      riderId: 'rider_test_123',
      latitude: 12.9720,
      longitude: 77.5950,
      timestamp: Date.now() + 10000,
      distanceMoved: 45.0,
    });

    const beforeFlush = await SyncQueueService.getPendingQueue();
    expect(beforeFlush.length).toBe(2);

    const syncedCount = await SyncQueueService.flushQueue();
    expect(syncedCount).toBe(2);

    const afterFlush = await SyncQueueService.getPendingQueue();
    expect(afterFlush.length).toBe(0);

    // Confirmed cache should contain the synced logs
    const confirmed = await SyncQueueService.getConfirmedCache('rider_test_123');
    expect(confirmed.length).toBe(2);
    expect(confirmed.every(item => item.synced === true)).toBe(true);
  });

  it('is idempotent and prevents duplicate writes if flush is called multiple times', async () => {
    await SyncQueueService.enqueueLocationLog({
      riderId: 'rider_test_123',
      latitude: 12.9716,
      longitude: 77.5946,
      timestamp: Date.now(),
      distanceMoved: 31.2,
    });

    // Run two flushes in parallel
    const [flush1, flush2] = await Promise.all([
      SyncQueueService.flushQueue(),
      SyncQueueService.flushQueue(),
    ]);

    // One handles the queue, the other returns 0 (due to mutex lock or empty queue)
    expect(flush1 + flush2).toBe(1);

    const pending = await SyncQueueService.getPendingQueue();
    expect(pending.length).toBe(0);
  });
});
