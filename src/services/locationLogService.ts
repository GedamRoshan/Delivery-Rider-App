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
  /**
   * Subscribes to real-time location log stream for the current rider.
   * Merges confirmed Realtime Database logs with pending offline queue items.
   */
  public static subscribeRiderLogs(
    riderId: string,
    onLogsUpdated: (logs: LocationLogEntry[]) => void,
    onError: (error: Error) => void
  ): Unsubscribe {
    let databaseUnsubscribe: Unsubscribe = () => {};

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
      console.log(`👂 [RTDB Listener] Subscribing to location_logs/${riderId}...`);
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

          // Reverse chronological order (most recent first)
          remoteLogs.sort((a, b) => b.timestamp - a.timestamp);
          console.log(`📥 [RTDB onValue] Received ${remoteLogs.length} logs for rider: ${riderId}`);

          // Save to local cache for offline resilience
          for (const item of remoteLogs) {
            SyncQueueService.saveToConfirmedCache(item);
          }

          combineAndEmit(remoteLogs);
        },
        async error => {
          console.error(
            '\n🚨 ================= [RTDB onValue ERROR] ================\n' +
            `❌ Rider ID      : ${riderId}\n` +
            `❌ Error Code    : ${(error as any)?.code || 'UNKNOWN'}\n` +
            `❌ Error Message : ${error?.message || error}\n` +
            '==========================================================\n'
          );
          console.log('[RTDB onValue Error Details]:', error);
          // Fall back to local storage cache so user never sees empty screen
          const cached = await SyncQueueService.getConfirmedCache(riderId);
          combineAndEmit(cached);
          onError(error);
        }
      );
    } catch (e: any) {
      console.error(
        '\n🚨 ================ [RTDB QUERY INIT ERROR] ================\n' +
        `❌ Rider ID      : ${riderId}\n` +
        `❌ Error Code    : ${e?.code || 'UNKNOWN'}\n` +
        `❌ Error Message : ${e?.message || e}\n` +
        '============================================================\n'
      );
      console.log('[RTDB Query Init Error Details]:', e);
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
      databaseUnsubscribe();
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
      console.log(`🔄 [RTDB fetchRiderLogs] Fetching logs for rider ${riderId}...`);
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
      console.log(`✅ [RTDB fetchRiderLogs] Fetched ${logs.length} logs for rider ${riderId}`);
      return logs;
    } catch (err: any) {
      console.error(
        '\n🚨 ================= [RTDB FETCH LOGS ERROR] ================\n' +
        `❌ Rider ID      : ${riderId}\n` +
        `❌ Error Code    : ${err?.code || 'UNKNOWN'}\n` +
        `❌ Error Message : ${err?.message || err}\n` +
        '============================================================\n'
      );
      console.log('[RTDB Fetch Logs Error Details]:', err);
      return SyncQueueService.getConfirmedCache(riderId);
    }
  }
}
