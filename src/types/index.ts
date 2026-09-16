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
  id: string;
  riderId: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  distanceMoved: number;
  accuracy?: number;
  synced?: boolean;
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
