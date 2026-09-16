import { Coordinates } from '../types';

/**
 * Mean radius of the Earth in meters (WGS-84 standard).
 */
export const EARTH_RADIUS_METERS = 6371000;

/**
 * Minimum distance moved (in meters) required to trigger a location log save.
 */
export const DISTANCE_THRESHOLD_METERS = 30;

/**
 * Converts degrees to radians.
 */
export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Computes great-circle distance between two geographic coordinates using the Haversine formula.
 *
 * @param lat1 Latitude of point 1 in decimal degrees
 * @param lon1 Longitude of point 1 in decimal degrees
 * @param lat2 Latitude of point 2 in decimal degrees
 * @param lon2 Longitude of point 2 in decimal degrees
 * @returns Distance in meters
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // Guard against identical coordinates
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

  // Clamp 'a' to [0, 1] to prevent floating point inaccuracies causing NaN in Math.sqrt
  const clampedA = Math.min(Math.max(a, 0), 1);
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));

  return EARTH_RADIUS_METERS * c;
}

export interface ThresholdEvaluationResult {
  shouldSave: boolean;
  distance: number;
  reason: 'FIRST_POINT' | 'THRESHOLD_MET' | 'THRESHOLD_NOT_MET';
}

/**
 * Evaluates whether a new location fix qualifies for persistence based on the 30-meter threshold.
 *
 * @param lastSaved Previous saved location point (null if starting session)
 * @param current New location point
 * @param thresholdMeters Minimum distance delta required (defaults to 30 meters)
 */
export function evaluateDistanceThreshold(
  lastSaved: Coordinates | null,
  current: Coordinates,
  thresholdMeters: number = DISTANCE_THRESHOLD_METERS
): ThresholdEvaluationResult {
  if (!lastSaved) {
    // First point of duty cycle is always saved as baseline anchor
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
