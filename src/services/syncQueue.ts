import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { ref, set } from 'firebase/database';
import { rtdb } from '../config/firebaseConfig';
import { LocationLogEntry } from '../types';

export const OFFLINE_QUEUE_STORAGE_KEY = '@delivery_rider_offline_queue';
export const LOCAL_CONFIRMED_LOGS_KEY = '@delivery_rider_local_confirmed_logs';

/**
 * Generates a RFC4122 version 4 compliant UUID for idempotency
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type QueueListener = (pendingCount: number, isOnline: boolean) => void;

export class SyncQueueService {
  private static isFlushing = false;
  private static isOnline = true;
  private static listeners: Set<QueueListener> = new Set();
  private static unsubscribeNetInfo: (() => void) | null = null;

  /**
   * Initializes connectivity listener to automatically flush when network restores.
   */
  public static initialize(): void {
    if (this.unsubscribeNetInfo) {
      return;
    }

    this.unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      const wasOffline = !this.isOnline;
      this.isOnline = online;

      this.notifyListeners();

      if (wasOffline && online) {
        console.log('[SyncQueue] Connectivity restored! Automatically flushing queue...');
        this.flushQueue().catch(err => {
          console.warn('[SyncQueue] Auto-flush error on reconnection:', err);
        });
      }
    });

    // Check initial connectivity
    NetInfo.fetch().then(state => {
      this.isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      this.notifyListeners();
    });
  }

  public static setOnlineStatus(online: boolean): void {
    const wasOffline = !this.isOnline;
    this.isOnline = online;
    this.notifyListeners();

    if (wasOffline && online) {
      this.flushQueue().catch(err => {
        console.warn('[SyncQueue] Flush on online error:', err);
      });
    }
  }

  public static cleanup(): void {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
      this.unsubscribeNetInfo = null;
    }
    this.listeners.clear();
  }

  public static subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    this.getPendingQueue().then(queue => {
      listener(queue.length, this.isOnline);
    });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static async notifyListeners(): Promise<void> {
    const queue = await this.getPendingQueue();
    for (const listener of this.listeners) {
      listener(queue.length, this.isOnline);
    }
  }

  /**
   * Retrieves pending un-synced location logs from persistent storage.
   */
  public static async getPendingQueue(): Promise<LocationLogEntry[]> {
    try {
      const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as LocationLogEntry[];
    } catch (e) {
      console.error('[SyncQueue] Failed reading offline queue:', e);
      return [];
    }
  }

  /**
   * Enqueues a qualified (>=30m) location log.
   * If online, immediately attempts flush; otherwise retains safely in durable storage.
   */
  public static async enqueueLocationLog(
    entryWithoutId: Omit<LocationLogEntry, 'id' | 'synced'>
  ): Promise<LocationLogEntry> {
    const entry: LocationLogEntry = {
      ...entryWithoutId,
      id: generateUUID(),
      synced: false,
    };

    try {
      const currentQueue = await this.getPendingQueue();
      // Avoid any duplicate insertions
      if (!currentQueue.some(item => item.id === entry.id)) {
        const updated = [...currentQueue, entry];
        await AsyncStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(updated));
      }
    } catch (e) {
      console.error('[SyncQueue] Error enqueueing location log:', e);
    }

    console.log(`📦 [SyncQueue] Enqueued log ID: ${entry.id} (Rider: ${entry.riderId}, Lat: ${entry.latitude.toFixed(4)}, Lng: ${entry.longitude.toFixed(4)}). isOnline: ${this.isOnline}`);
    await this.notifyListeners();

    // Trigger flush if currently online
    if (this.isOnline) {
      this.flushQueue().catch(err => {
        console.warn('⚠️ [SyncQueue] Background flush warning:', err);
      });
    }

    return entry;
  }

  /**
   * Flushes offline queued location logs to Firestore.
   * Guaranteed idempotent deduplication using entry.id as document ID in setDoc.
   */
  public static async flushQueue(): Promise<number> {
    if (this.isFlushing) {
      return 0;
    }

    this.isFlushing = true;
    let syncedCount = 0;

    try {
      const queue = await this.getPendingQueue();
      if (queue.length === 0) {
        this.isFlushing = false;
        return 0;
      }

      console.log(`\n☁️ [SyncQueue] Beginning flush of ${queue.length} items to Realtime Database...`);
      const remainingQueue: LocationLogEntry[] = [];

      for (const item of queue) {
        try {
          console.log(`☁️ [RTDB Write] Uploading log ${item.id} to location_logs/${item.riderId}/${item.id}...`);
          const logRef = ref(rtdb, `location_logs/${item.riderId}/${item.id}`);
          await set(logRef, {
            ...item,
            synced: true,
            syncedAt: Date.now(),
          });

          console.log(`✅ [RTDB Write SUCCESS] Log location_logs/${item.riderId}/${item.id} saved to Cloud!`);

          // Persist to local confirmed cache so UI shows immediately
          await this.saveToConfirmedCache({ ...item, synced: true });
          syncedCount++;
        } catch (itemErr: any) {
          console.error(
            '\n🚨 ================= [REALTIME DATABASE WRITE ERROR] ================\n' +
            `❌ Failed Document ID : ${item.id}\n` +
            `❌ Error Code         : ${itemErr?.code || 'UNKNOWN'}\n` +
            `❌ Error Message      : ${itemErr?.message || itemErr}\n` +
            '====================================================================\n'
          );
          console.log('[RTDB Error Object]:', itemErr);
          // Keep in queue for retry on network restoration
          remainingQueue.push(item);
        }
      }

      await AsyncStorage.setItem(
        OFFLINE_QUEUE_STORAGE_KEY,
        JSON.stringify(remainingQueue)
      );

      console.log(`[SyncQueue] Flush complete: ${syncedCount} synced, ${remainingQueue.length} remaining.`);
    } catch (err: any) {
      console.error(
        '\n🚨 ================= [RTDB FLUSH FATAL ERROR] ================\n' +
        `❌ Error Code    : ${err?.code || 'UNKNOWN'}\n` +
        `❌ Error Message : ${err?.message || err}\n` +
        `❌ Error Stack   : ${err?.stack || 'N/A'}\n` +
        '================================================================\n'
      );
      console.log('[RTDB Flush Fatal Details]:', err);
    } finally {
      this.isFlushing = false;
      await this.notifyListeners();
    }

    return syncedCount;
  }

  /**
   * Saves confirmed logs to local storage for instant offline viewing on the Home Screen.
   */
  public static async saveToConfirmedCache(entry: LocationLogEntry): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(LOCAL_CONFIRMED_LOGS_KEY);
      const existing: LocationLogEntry[] = raw ? JSON.parse(raw) : [];
      // Deduplicate by ID
      const filtered = existing.filter(e => e.id !== entry.id);
      const updated = [entry, ...filtered];
      // Keep most recent 200 logs
      await AsyncStorage.setItem(
        LOCAL_CONFIRMED_LOGS_KEY,
        JSON.stringify(updated.slice(0, 200))
      );
    } catch (e) {
      console.warn('[SyncQueue] Cache save warning:', e);
    }
  }

  public static async getConfirmedCache(riderId: string): Promise<LocationLogEntry[]> {
    try {
      const raw = await AsyncStorage.getItem(LOCAL_CONFIRMED_LOGS_KEY);
      if (!raw) return [];
      const all: LocationLogEntry[] = JSON.parse(raw);
      return all.filter(item => item.riderId === riderId);
    } catch {
      return [];
    }
  }

  public static getConnectivityStatus(): boolean {
    return this.isOnline;
  }
}
