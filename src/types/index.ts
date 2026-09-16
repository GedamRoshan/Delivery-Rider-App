/**
 * Core domain types for Delivery Rider App
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationPoint extends Coordinates {
  accuracy?: number;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
}

export interface LocationLogEntry {
  id: string; // Unique idempotency key (UUID v4)
  riderId: string;
  latitude: number;
  longitude: number;
  timestamp: number; // UTC Epoch timestamp in milliseconds
  distanceMoved: number; // Great-circle distance (meters) from previous saved point
  accuracy?: number;
  synced?: boolean; // True if confirmed in Firestore, false if in local offline queue
}

export interface RiderUser {
  uid: string;
  email: string | null;
}

export type DutyStatus = 'ON_DUTY' | 'OFF_DUTY';

export interface TrackingMetrics {
  totalDistanceMeters: number;
  savedPointsCount: number;
  lastFixTime: number | null;
  lastFixLat: number | null;
  lastFixLng: number | null;
  lastDistanceDelta: number | null;
  isBackgroundRunning: boolean;
}

export interface SyncQueueStatus {
  pendingCount: number;
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: number | null;
}
