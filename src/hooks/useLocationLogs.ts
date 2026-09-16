import { useState, useEffect, useCallback } from 'react';
import { LocationLogService } from '../services/locationLogService';
import { SyncQueueService } from '../services/syncQueue';
import { LocationLogEntry } from '../types';

export function useLocationLogs(riderId: string | undefined) {
  const [logs, setLogs] = useState<LocationLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(SyncQueueService.getConnectivityStatus());

  useEffect(() => {
    SyncQueueService.initialize();

    const unsubQueue = SyncQueueService.subscribe((count, online) => {
      setPendingCount(count);
      setIsOnline(online);
    });

    return () => {
      unsubQueue();
    };
  }, []);

  useEffect(() => {
    if (!riderId) {
      setLogs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribeLogs = LocationLogService.subscribeRiderLogs(
      riderId,
      updatedLogs => {
        setLogs(updatedLogs);
        setLoading(false);
      },
      err => {
        console.warn('[useLocationLogs] Subscription error:', err.message);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeLogs();
    };
  }, [riderId]);

  const refreshLogs = useCallback(async () => {
    if (!riderId || isRefreshing) return;
    setIsRefreshing(true);
    setError(null);

    try {
      const refreshed = await LocationLogService.fetchRiderLogs(riderId);
      setLogs(refreshed);
    } catch (err: any) {
      setError(err.message || 'Failed to refresh logs');
    } finally {
      setIsRefreshing(false);
    }
  }, [riderId, isRefreshing]);

  const flushNow = useCallback(async () => {
    return SyncQueueService.flushQueue();
  }, []);

  return {
    logs,
    loading,
    error,
    isRefreshing,
    refreshLogs,
    pendingCount,
    isOnline,
    flushNow,
  };
}
