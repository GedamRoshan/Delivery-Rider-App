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

  /**
   * Promisified current GPS location fix with high/low accuracy fallback
   */
  public static getCurrentGPSFix(): Promise<LocationPoint> {
    return new Promise((resolve, reject) => {
      console.log('📡 [GPS] Requesting location fix...');
      Geolocation.getCurrentPosition(
        position => {
          console.log(
            `📍 [GPS Fix OK] Lat: ${position.coords.latitude.toFixed(6)}, Lng: ${position.coords.longitude.toFixed(6)}, Accuracy: ${position.coords.accuracy?.toFixed(1) || '?'}m`
          );
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
          console.warn('⚠️ [GPS] High accuracy fix failed (satellite timeout or indoor). Retrying with network/low accuracy...', error?.message || error);
          Geolocation.getCurrentPosition(
            fallbackPos => {
              console.log(
                `📍 [GPS Fallback Fix OK] Lat: ${fallbackPos.coords.latitude.toFixed(6)}, Lng: ${fallbackPos.coords.longitude.toFixed(6)}, Accuracy: ${fallbackPos.coords.accuracy?.toFixed(1) || '?'}m`
              );
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
              console.error(
                '\n🚨 ====================== [GPS FIX FAILED] ======================\n' +
                `❌ Message : ${fallbackErr?.message || fallbackErr}\n` +
                `❌ Code    : ${fallbackErr?.code} (1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT)\n` +
                '💡 Tip     : Make sure Location/GPS is ON on device/emulator.\n' +
                '=================================================================\n'
              );
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

  /**
   * Core background task loop executed by the OS Foreground Service.
   * Runs independently of screen mount status, surviving backgrounding and screen lock.
   */
  private static async backgroundPollingTask(taskDataArguments?: any): Promise<void> {
    const riderId = taskDataArguments?.riderId || BackgroundLocationService.currentRiderId;
    const intervalMs = taskDataArguments?.delay || 10000;

    console.log(`\n🚀 [BackgroundLocation] Service loop started for rider: ${riderId}, interval: ${intervalMs}ms`);

    while (BackgroundActions.isRunning()) {
      try {
        const point = await BackgroundLocationService.getCurrentGPSFix();

        const currentCoord: Coordinates = {
          latitude: point.latitude,
          longitude: point.longitude,
        };

        // Evaluate distance moved since the last SAVED location
        const evaluation = evaluateDistanceThreshold(
          BackgroundLocationService.lastSavedPoint,
          currentCoord,
          30 // 30-meter threshold requirement
        );

        BackgroundLocationService.metrics.lastFixTime = point.timestamp;
        BackgroundLocationService.metrics.lastFixLat = point.latitude;
        BackgroundLocationService.metrics.lastFixLng = point.longitude;
        BackgroundLocationService.metrics.lastDistanceDelta = evaluation.distance;

        if (evaluation.shouldSave) {
          console.log(
            `🚀 [BackgroundLocation] Threshold MET (${evaluation.reason}, +${evaluation.distance.toFixed(1)}m). Enqueueing log for Firebase sync...`
          );

          // Update last saved baseline
          BackgroundLocationService.lastSavedPoint = currentCoord;
          BackgroundLocationService.metrics.totalDistanceMeters += evaluation.distance;
          BackgroundLocationService.metrics.savedPointsCount += 1;

          // Enqueue via resilient offline queue
          await SyncQueueService.enqueueLocationLog({
            riderId,
            latitude: point.latitude,
            longitude: point.longitude,
            timestamp: point.timestamp,
            distanceMoved: Math.round(evaluation.distance * 10) / 10,
            accuracy: point.accuracy,
          });

          // Update notification text to show live stats
          if (BackgroundActions.isRunning()) {
            await BackgroundActions.updateNotification({
              taskDesc: `Tracking on duty: ${BackgroundLocationService.metrics.savedPointsCount} logs saved (+${evaluation.distance.toFixed(0)}m)`,
            }).catch(() => {});
          }
        } else {
          console.log(
            `ℹ️ [BackgroundLocation] Movement: +${evaluation.distance.toFixed(1)}m (< 30m threshold). Skipped save to conserve writes. Move >=30m for next log.`
          );
        }

        BackgroundLocationService.emitMetrics();
      } catch (fixError: any) {
        console.warn('⚠️ [BackgroundLocation] GPS fix warning in loop:', fixError.message || fixError);
      }

      // Strict 10-second polling cadence
      await sleep(intervalMs);
    }

    console.log('[BackgroundLocation] Background loop exited cleanly.');
  }

  /**
   * Starts tracking on duty: requests permissions, launches Foreground Service, begins 10s loop.
   */
  public static async startTracking(riderId: string): Promise<boolean> {
    if (this.isRunning) {
      return true;
    }

    // Check & request permissions first
    const permStatus = await PermissionService.checkPermissions();
    if (!permStatus.hasForeground) {
      const requested = await PermissionService.requestPermissions();
      if (!requested.hasForeground) {
        PermissionService.openSettingsAlert(
          'Location Permission Required',
          'Delivery Rider App requires foreground and background location access while On Duty.'
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
      taskTitle: 'Delivery Rider Active - Tracking Location',
      taskDesc: 'GPS route polling active every 10 seconds',
      taskIcon: {
        name: 'ic_launcher',
        type: 'mipmap',
      },
      color: '#10B981', // Vibrant emerald green
      linkingURI: 'deliveryriderapp://home',
      parameters: {
        delay: 10000, // 10-second polling interval
        riderId,
      },
    };

    try {
      this.isRunning = true;
      // Also start native Geolocation configuration
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
      console.error('[BackgroundLocation] Failed to start background actions:', startErr);
      this.isRunning = false;
      this.metrics.isBackgroundRunning = false;
      this.emitMetrics();

      // Fallback to foreground interval if native background action isn't available
      this.startForegroundFallback(riderId);
      return true;
    }
  }

  private static foregroundIntervalId: any = null;

  private static startForegroundFallback(riderId: string): void {
    if (this.foregroundIntervalId) return;
    console.log(`\n🚀 [BackgroundLocation] Starting foreground fallback loop for rider: ${riderId}`);
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
          console.log(
            `🚀 [Foreground Fallback] Threshold MET (${evaluation.reason}, +${evaluation.distance.toFixed(1)}m). Enqueueing log for Firebase...`
          );
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
        } else {
          console.log(
            `ℹ️ [Foreground Fallback] Movement: +${evaluation.distance.toFixed(1)}m (< 30m). Move at least 30m to trigger next Firestore write.`
          );
        }
        this.emitMetrics();
      } catch (e: any) {
        console.warn('⚠️ [Foreground Fallback] Tick warning:', e?.message || e);
      }
    };

    // Execute first tick immediately
    executeTick();
    this.foregroundIntervalId = setInterval(executeTick, 10000);
  }

  /**
   * Stops tracking on off-duty
   */
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
    console.log('[BackgroundLocation] Duty ended: location tracking stopped.');
  }

  public static isDutyActive(): boolean {
    return this.isRunning;
  }

  public static getMetrics(): TrackingMetrics {
    return { ...this.metrics };
  }
}
