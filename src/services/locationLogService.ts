import {
  ref,
  onValue,
  get,
  query,
  limitToLast,
  Unsubscribe,
} from 'firebase/database';
import { LocationLogEntry } from '../types';
import { SyncQueueService } from './syncQueue';
import { rtdb, isUsingPlaceholderCredentials } from '../config/firebaseConfig';

export class LocationLogService {
  public static subscribeRiderLogs(
    riderId: string,
    onLogsUpdated: (logs: LocationLogEntry[]) => void,
    onError: (error: Error) => void
  ): Unsubscribe {
    let databaseUnsubscribe: Unsubscribe = () => {};

    const combineAndEmit = async (confirmedLogs: LocationLogEntry[]) => {
      try {
        const pendingQueue = await SyncQueueService.getPendingQueue();
        const pendingForRider = pendingQueue.filter(item => item.riderId === riderId);

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
          (a, b) => b.timestamp - a.timestamp
        );

        onLogsUpdated(merged);
      } catch (err: any) {
        onLogsUpdated(confirmedLogs);
      }
    };

    if (isUsingPlaceholderCredentials()) {
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
      const riderLogsRef = ref(rtdb, `location_logs/${riderId}`);
      const q = query(riderLogsRef, limitToLast(100));

      databaseUnsubscribe = onValue(
        q,
        snapshot => {
          const remoteLogs: LocationLogEntry[] = [];
          if (snapshot.exists()) {
            snapshot.forEach(childSnap => {
              const data = childSnap.val();
              if (data) {
                remoteLogs.push({
                  id: childSnap.key || data.id,
                  riderId: data.riderId || riderId,
                  latitude: data.latitude,
                  longitude: data.longitude,
                  timestamp: data.timestamp,
                  distanceMoved: data.distanceMoved ?? 0,
                  accuracy: data.accuracy,
                  synced: true,
                });
              }
            });
          }

          remoteLogs.sort((a, b) => b.timestamp - a.timestamp);

          for (const item of remoteLogs) {
            SyncQueueService.saveToConfirmedCache(item);
          }

          combineAndEmit(remoteLogs);
        },
        async error => {
          console.error('[LocationLogService] onValue error:', error);
          const cached = await SyncQueueService.getConfirmedCache(riderId);
          combineAndEmit(cached);
          onError(error);
        }
      );
    } catch (e: any) {
      console.error('[LocationLogService] Query init error:', e);
      SyncQueueService.getConfirmedCache(riderId).then(cached => {
        combineAndEmit(cached);
      });
      onError(e);
    }

    const unsubQueue = SyncQueueService.subscribe(() => {
      SyncQueueService.getConfirmedCache(riderId).then(cached => {
        combineAndEmit(cached);
      });
    });

    return () => {
      databaseUnsubscribe();
      unsubQueue();
    };
  }

  public static async fetchRiderLogs(riderId: string): Promise<LocationLogEntry[]> {
    await SyncQueueService.flushQueue();

    if (isUsingPlaceholderCredentials()) {
      return SyncQueueService.getConfirmedCache(riderId);
    }

    try {
      const riderLogsRef = ref(rtdb, `location_logs/${riderId}`);
      const q = query(riderLogsRef, limitToLast(100));

      const snapshot = await get(q);
      const logs: LocationLogEntry[] = [];

      if (snapshot.exists()) {
        snapshot.forEach(childSnap => {
          const data = childSnap.val();
          if (data) {
            logs.push({
              id: childSnap.key || data.id,
              riderId: data.riderId || riderId,
              latitude: data.latitude,
              longitude: data.longitude,
              timestamp: data.timestamp,
              distanceMoved: data.distanceMoved ?? 0,
              accuracy: data.accuracy,
              synced: true,
            });
          }
        });
      }

      logs.sort((a, b) => b.timestamp - a.timestamp);
      return logs;
    } catch (err: any) {
      console.error('[LocationLogService] fetchRiderLogs error:', err);
      return SyncQueueService.getConfirmedCache(riderId);
    }
  }
}
