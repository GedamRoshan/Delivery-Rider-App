import { Coordinates } from '../types';

export const EARTH_RADIUS_METERS = 6371000;
export const DISTANCE_THRESHOLD_METERS = 30;

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const clampedA = Math.min(Math.max(a, 0), 1);
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));

  return EARTH_RADIUS_METERS * c;
}

export interface ThresholdEvaluationResult {
  shouldSave: boolean;
  distance: number;
  reason: 'FIRST_POINT' | 'THRESHOLD_MET' | 'THRESHOLD_NOT_MET';
}

export function evaluateDistanceThreshold(
  lastSaved: Coordinates | null,
  current: Coordinates,
  thresholdMeters: number = DISTANCE_THRESHOLD_METERS
): ThresholdEvaluationResult {
  if (!lastSaved) {
    return {
      shouldSave: true,
      distance: 0,
      reason: 'FIRST_POINT',
    };
  }

  const distance = haversineDistance(
    lastSaved.latitude,
    lastSaved.longitude,
    current.latitude,
    current.longitude
  );

  const shouldSave = distance >= thresholdMeters;

  return {
    shouldSave,
    distance,
    reason: shouldSave ? 'THRESHOLD_MET' : 'THRESHOLD_NOT_MET',
  };
}
