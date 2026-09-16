import { useState, useEffect, useCallback } from 'react';
import { BackgroundLocationService } from '../services/backgroundLocation';
import { TrackingMetrics } from '../types';

export function useDutyTracking(riderId: string | undefined) {
  const [isOnDuty, setIsOnDuty] = useState(BackgroundLocationService.isDutyActive());
  const [metrics, setMetrics] = useState<TrackingMetrics>(
    BackgroundLocationService.getMetrics()
  );
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    const unsub = BackgroundLocationService.subscribeMetrics(newMetrics => {
      setMetrics(newMetrics);
      setIsOnDuty(newMetrics.isBackgroundRunning);
    });

    return () => {
      unsub();
    };
  }, []);

  const toggleDuty = useCallback(
    async (targetState?: boolean) => {
      if (!riderId || isToggling) return;
      setIsToggling(true);

      const nextState = targetState !== undefined ? targetState : !isOnDuty;

      try {
        if (nextState) {
          const started = await BackgroundLocationService.startTracking(riderId);
          setIsOnDuty(started);
        } else {
          await BackgroundLocationService.stopTracking();
          setIsOnDuty(false);
        }
      } catch (err) {
        console.error('[useDutyTracking] Toggle error:', err);
      } finally {
        setIsToggling(false);
      }
    },
    [riderId, isOnDuty, isToggling]
  );

  return {
    isOnDuty,
    metrics,
    isToggling,
    toggleDuty,
  };
}
