import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  Unsubscribe,
} from 'firebase/firestore';
import { db, isUsingPlaceholderCredentials } from '../config/firebaseConfig';
import { LocationLogEntry } from '../types';
import { SyncQueueService } from './syncQueue';

export class LocationLogService {
  /**
   * Subscribes to real-time location log stream for the current rider.
   * Merges confirmed Firestore logs with pending offline queue items.
   */
  public static subscribeRiderLogs(
    riderId: string,
    onLogsUpdated: (logs: LocationLogEntry[]) => void,
    onError: (error: Error) => void
  ): Unsubscribe {
    let firestoreUnsubscribe: Unsubscribe = () => {};

    // Helper to combine confirmed logs and pending offline queue
    const combineAndEmit = async (confirmedLogs: LocationLogEntry[]) => {
      try {
        const pendingQueue = await SyncQueueService.getPendingQueue();
        const pendingForRider = pendingQueue.filter(item => item.riderId === riderId);

        // Merge: pending items first (most recent), then confirmed items
        // Deduplicate by ID
        const map = new Map<string, LocationLogEntry>();
        for (const log of pendingForRider) {
          map.set(log.id, { ...log, synced: false });
        }
        for (const log of confirmedLogs) {
          if (!map.has(log.id)) {
            map.set(log.id, { ...log, synced: true });
          }
        }

        const merged = Array.from(map.values()).sort(
          (a, b) => b.timestamp - a.timestamp // Reverse chronological for delivery feed
        );

        onLogsUpdated(merged);
      } catch (err: any) {
        onLogsUpdated(confirmedLogs);
      }
    };

    if (isUsingPlaceholderCredentials()) {
      // Offline / Reviewer Demo mode: read from confirmed cache & poll queue
      const loadLocal = () => {
        SyncQueueService.getConfirmedCache(riderId).then(cached => {
          combineAndEmit(cached);
        });
      };

      loadLocal();
      const unsubQueue = SyncQueueService.subscribe(() => {
        loadLocal();
      });

      return () => {
        unsubQueue();
      };
    }

    try {
      const q = query(
        collection(db, 'location_logs'),
        where('riderId', '==', riderId),
        orderBy('timestamp', 'desc'),
        limit(100)
      );

      firestoreUnsubscribe = onSnapshot(
        q,
        snapshot => {
          const remoteLogs: LocationLogEntry[] = [];
          snapshot.forEach(docSnap => {
            const data = docSnap.data();
            remoteLogs.push({
              id: docSnap.id,
              riderId: data.riderId,
              latitude: data.latitude,
              longitude: data.longitude,
              timestamp: data.timestamp,
              distanceMoved: data.distanceMoved ?? 0,
              accuracy: data.accuracy,
              synced: true,
            });
          });

          // Save to local cache for offline resilience
          for (const item of remoteLogs) {
            SyncQueueService.saveToConfirmedCache(item);
          }

          combineAndEmit(remoteLogs);
        },
        async error => {
          console.warn('[LocationLogService] Firestore onSnapshot warning:', error.message);
          // Fall back to local storage cache so user never sees empty screen
          const cached = await SyncQueueService.getConfirmedCache(riderId);
          combineAndEmit(cached);
          onError(error);
        }
      );
    } catch (e: any) {
      console.warn('[LocationLogService] Firestore query init error:', e);
      SyncQueueService.getConfirmedCache(riderId).then(cached => {
        combineAndEmit(cached);
      });
      onError(e);
    }

    // Also listen to offline sync queue updates
    const unsubQueue = SyncQueueService.subscribe(() => {
      SyncQueueService.getConfirmedCache(riderId).then(cached => {
        combineAndEmit(cached);
      });
    });

    return () => {
      firestoreUnsubscribe();
      unsubQueue();
    };
  }

  /**
   * Manual refresh fetch for pull-to-refresh
   */
  public static async fetchRiderLogs(riderId: string): Promise<LocationLogEntry[]> {
    // Flush any pending queue items first
    await SyncQueueService.flushQueue();

    if (isUsingPlaceholderCredentials()) {
      return SyncQueueService.getConfirmedCache(riderId);
    }

    try {
      const q = query(
        collection(db, 'location_logs'),
        where('riderId', '==', riderId),
        orderBy('timestamp', 'desc'),
        limit(100)
      );

      const snapshot = await getDocs(q);
      const logs: LocationLogEntry[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        logs.push({
          id: docSnap.id,
          riderId: data.riderId,
          latitude: data.latitude,
          longitude: data.longitude,
          timestamp: data.timestamp,
          distanceMoved: data.distanceMoved ?? 0,
          accuracy: data.accuracy,
          synced: true,
        });
      });

      return logs;
    } catch (err) {
      console.warn('[LocationLogService] Manual fetch error, falling back to cache:', err);
      return SyncQueueService.getConfirmedCache(riderId);
    }
  }
}
