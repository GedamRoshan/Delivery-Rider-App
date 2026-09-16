import BackgroundActions from 'react-native-background-actions';
import Geolocation from '@react-native-community/geolocation';
import { Coordinates, LocationPoint, TrackingMetrics } from '../types';
import { evaluateDistanceThreshold, haversineDistance } from '../utils/haversine';
import { SyncQueueService } from './syncQueue';
import { PermissionService } from './permissionService';

const sleep = (time: number) =>
  new Promise(resolve => setTimeout(() => resolve(undefined), time));

export type MetricsListener = (metrics: TrackingMetrics) => void;

export class BackgroundLocationService {
  private static isRunning = false;
  private static currentRiderId: string | null = null;
  private static lastSavedPoint: Coordinates | null = null;
  private static listeners: Set<MetricsListener> = new Set();

  private static metrics: TrackingMetrics = {
    totalDistanceMeters: 0,
    savedPointsCount: 0,
    lastFixTime: null,
    lastFixLat: null,
    lastFixLng: null,
    lastDistanceDelta: null,
    isBackgroundRunning: false,
  };

  public static subscribeMetrics(listener: MetricsListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.metrics });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static emitMetrics(): void {
    const copy = { ...this.metrics };
    for (const listener of this.listeners) {
      listener(copy);
    }
  }

  public static getCurrentGPSFix(): Promise<LocationPoint> {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        position => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp || Date.now(),
          });
        },
        error => {
          Geolocation.getCurrentPosition(
            fallbackPos => {
              resolve({
                latitude: fallbackPos.coords.latitude,
                longitude: fallbackPos.coords.longitude,
                accuracy: fallbackPos.coords.accuracy,
                altitude: fallbackPos.coords.altitude,
                heading: fallbackPos.coords.heading,
                speed: fallbackPos.coords.speed,
                timestamp: fallbackPos.timestamp || Date.now(),
              });
            },
            fallbackErr => {
              console.error('[BackgroundLocation] GPS fix failed:', fallbackErr);
              reject(fallbackErr);
            },
            {
              enableHighAccuracy: false,
              timeout: 10000,
              maximumAge: 15000,
            }
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 5000,
        }
      );
    });
  }

  private static async backgroundPollingTask(taskDataArguments?: any): Promise<void> {
    const riderId = taskDataArguments?.riderId || BackgroundLocationService.currentRiderId;
    const intervalMs = taskDataArguments?.delay || 10000;

    while (BackgroundActions.isRunning()) {
      try {
        const point = await BackgroundLocationService.getCurrentGPSFix();

        const currentCoord: Coordinates = {
          latitude: point.latitude,
          longitude: point.longitude,
        };

        const evaluation = evaluateDistanceThreshold(
          BackgroundLocationService.lastSavedPoint,
          currentCoord,
          30
        );

        BackgroundLocationService.metrics.lastFixTime = point.timestamp;
        BackgroundLocationService.metrics.lastFixLat = point.latitude;
        BackgroundLocationService.metrics.lastFixLng = point.longitude;
        BackgroundLocationService.metrics.lastDistanceDelta = evaluation.distance;

        if (evaluation.shouldSave) {
          BackgroundLocationService.lastSavedPoint = currentCoord;
          BackgroundLocationService.metrics.totalDistanceMeters += evaluation.distance;
          BackgroundLocationService.metrics.savedPointsCount += 1;

          await SyncQueueService.enqueueLocationLog({
            riderId,
            latitude: point.latitude,
            longitude: point.longitude,
            timestamp: point.timestamp,
            distanceMoved: Math.round(evaluation.distance * 10) / 10,
            accuracy: point.accuracy,
          });

          if (BackgroundActions.isRunning()) {
            await BackgroundActions.updateNotification({
              taskDesc: `Tracking active: ${BackgroundLocationService.metrics.savedPointsCount} logs saved (+${evaluation.distance.toFixed(0)}m)`,
            }).catch(() => {});
          }
        }

        BackgroundLocationService.emitMetrics();
      } catch (fixError: any) {
        console.warn('[BackgroundLocation] GPS fix warning:', fixError?.message || fixError);
      }

      await sleep(intervalMs);
    }
  }

  public static async startTracking(riderId: string): Promise<boolean> {
    if (this.isRunning) {
      return true;
    }

    const permStatus = await PermissionService.checkPermissions();
    if (!permStatus.hasForeground) {
      const requested = await PermissionService.requestPermissions();
      if (!requested.hasForeground) {
        PermissionService.openSettingsAlert(
          'Location Permission Required',
          'Delivery Rider App requires location access while On Duty.'
        );
        return false;
      }
    }

    this.currentRiderId = riderId;
    this.lastSavedPoint = null;
    this.metrics = {
      totalDistanceMeters: 0,
      savedPointsCount: 0,
      lastFixTime: null,
      lastFixLat: null,
      lastFixLng: null,
      lastDistanceDelta: null,
      isBackgroundRunning: true,
    };
    this.emitMetrics();

    const options = {
      taskName: 'DeliveryRiderLocationTracking',
      taskTitle: 'Delivery Rider Active',
      taskDesc: 'GPS route polling active',
      taskIcon: {
        name: 'ic_launcher',
        type: 'mipmap',
      },
      color: '#10B981',
      linkingURI: 'deliveryriderapp://home',
      parameters: {
        delay: 10000,
        riderId,
      },
    };

    try {
      this.isRunning = true;
      Geolocation.setRNConfiguration({
        skipPermissionRequests: false,
        authorizationLevel: 'always',
        enableBackgroundLocationUpdates: true,
      });

      await BackgroundActions.start(this.backgroundPollingTask, options);
      this.metrics.isBackgroundRunning = true;
      this.emitMetrics();
      return true;
    } catch (startErr: any) {
      console.error('[BackgroundLocation] BackgroundActions error, using foreground fallback:', startErr);
      this.isRunning = false;
      this.metrics.isBackgroundRunning = false;
      this.emitMetrics();

      this.startForegroundFallback(riderId);
      return true;
    }
  }

  private static foregroundIntervalId: any = null;

  private static startForegroundFallback(riderId: string): void {
    if (this.foregroundIntervalId) return;
    this.isRunning = true;
    this.metrics.isBackgroundRunning = true;
    this.emitMetrics();

    const executeTick = async () => {
      try {
        const point = await this.getCurrentGPSFix();
        const currentCoord: Coordinates = {
          latitude: point.latitude,
          longitude: point.longitude,
        };
        const evaluation = evaluateDistanceThreshold(this.lastSavedPoint, currentCoord, 30);
        this.metrics.lastFixTime = point.timestamp;
        this.metrics.lastFixLat = point.latitude;
        this.metrics.lastFixLng = point.longitude;
        this.metrics.lastDistanceDelta = evaluation.distance;

        if (evaluation.shouldSave) {
          this.lastSavedPoint = currentCoord;
          this.metrics.totalDistanceMeters += evaluation.distance;
          this.metrics.savedPointsCount += 1;

          await SyncQueueService.enqueueLocationLog({
            riderId,
            latitude: point.latitude,
            longitude: point.longitude,
            timestamp: point.timestamp,
            distanceMoved: Math.round(evaluation.distance * 10) / 10,
            accuracy: point.accuracy,
          });
        }
        this.emitMetrics();
      } catch (e: any) {
        console.warn('[Foreground Fallback] Tick warning:', e?.message || e);
      }
    };

    executeTick();
    this.foregroundIntervalId = setInterval(executeTick, 10000);
  }

  public static async stopTracking(): Promise<void> {
    this.isRunning = false;
    if (this.foregroundIntervalId) {
      clearInterval(this.foregroundIntervalId);
      this.foregroundIntervalId = null;
    }

    try {
      if (BackgroundActions.isRunning()) {
        await BackgroundActions.stop();
      }
    } catch (stopErr) {
      console.warn('[BackgroundLocation] Stop error:', stopErr);
    }

    this.metrics.isBackgroundRunning = false;
    this.emitMetrics();
  }

  public static isDutyActive(): boolean {
    return this.isRunning;
  }

  public static getMetrics(): TrackingMetrics {
    return { ...this.metrics };
  }
}
