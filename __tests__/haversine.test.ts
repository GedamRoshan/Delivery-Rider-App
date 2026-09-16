import {
  haversineDistance,
  evaluateDistanceThreshold,
  DISTANCE_THRESHOLD_METERS,
  EARTH_RADIUS_METERS,
} from '../src/utils/haversine';

describe('Haversine Distance & Distance-Threshold Logic', () => {
  describe('haversineDistance calculation', () => {
    it('returns 0 when coordinates are identical', () => {
      const lat = 12.9716;
      const lon = 77.5946;
      expect(haversineDistance(lat, lon, lat, lon)).toBe(0);
    });

    it('accurately calculates known distance between Eiffel Tower and Arc de Triomphe (~4.4km)', () => {
      // Eiffel Tower: 48.8584, 2.2945
      // Arc de Triomphe: 48.8738, 2.2950
      const dist = haversineDistance(48.8584, 2.2945, 48.8738, 2.295);
      // Expected distance is approximately 1715 meters
      expect(dist).toBeGreaterThan(1700);
      expect(dist).toBeLessThan(1730);
    });

    it('handles antipodal coordinates without NaN or floating point errors', () => {
      const dist = haversineDistance(0, 0, 0, 180);
      expect(Number.isFinite(dist)).toBe(true);
      // Half-circumference of earth is π * R ≈ 20,015,087m
      expect(dist).toBeCloseTo(Math.PI * EARTH_RADIUS_METERS, -2);
    });
  });

  describe('30-Meter Boundary Threshold Tests', () => {
    const degPerMeterLat = (1 / EARTH_RADIUS_METERS) * (180 / Math.PI);
    const anchor = { latitude: 12.9715987, longitude: 77.5945627 };

    it('evaluates distance for 29.9m: MUST SKIP saving (strictly < 30m)', () => {
      const deltaLat = 29.9 * degPerMeterLat;
      const point29_9m = {
        latitude: anchor.latitude + deltaLat,
        longitude: anchor.longitude,
      };

      const distance = haversineDistance(
        anchor.latitude,
        anchor.longitude,
        point29_9m.latitude,
        point29_9m.longitude
      );

      expect(distance).toBeCloseTo(29.9, 2);
      expect(distance).toBeLessThan(DISTANCE_THRESHOLD_METERS);

      const evaluation = evaluateDistanceThreshold(anchor, point29_9m);
      expect(evaluation.shouldSave).toBe(false);
      expect(evaluation.reason).toBe('THRESHOLD_NOT_MET');
      expect(evaluation.distance).toBeCloseTo(29.9, 1);
    });

    it('evaluates distance for exactly 30.0m: MUST QUALIFY for saving (>= 30m)', () => {
      const deltaLat = 30.0 * degPerMeterLat;
      const point30_0m = {
        latitude: anchor.latitude + deltaLat,
        longitude: anchor.longitude,
      };

      const distance = haversineDistance(
        anchor.latitude,
        anchor.longitude,
        point30_0m.latitude,
        point30_0m.longitude
      );

      expect(distance).toBeCloseTo(30.0, 2);
      expect(distance).toBeGreaterThanOrEqual(DISTANCE_THRESHOLD_METERS);

      const evaluation = evaluateDistanceThreshold(anchor, point30_0m);
      expect(evaluation.shouldSave).toBe(true);
      expect(evaluation.reason).toBe('THRESHOLD_MET');
      expect(evaluation.distance).toBeGreaterThanOrEqual(30.0);
    });

    it('evaluates distance for 30.1m: MUST QUALIFY for saving (>= 30m)', () => {
      const deltaLat = 30.1 * degPerMeterLat;
      const point30_1m = {
        latitude: anchor.latitude + deltaLat,
        longitude: anchor.longitude,
      };

      const distance = haversineDistance(
        anchor.latitude,
        anchor.longitude,
        point30_1m.latitude,
        point30_1m.longitude
      );

      expect(distance).toBeCloseTo(30.1, 2);
      expect(distance).toBeGreaterThan(DISTANCE_THRESHOLD_METERS);

      const evaluation = evaluateDistanceThreshold(anchor, point30_1m);
      expect(evaluation.shouldSave).toBe(true);
      expect(evaluation.reason).toBe('THRESHOLD_MET');
      expect(evaluation.distance).toBeCloseTo(30.1, 1);
    });

    it('always saves the first point of a duty cycle as baseline anchor', () => {
      const firstFix = { latitude: 37.7749, longitude: -122.4194 };
      const evaluation = evaluateDistanceThreshold(null, firstFix);

      expect(evaluation.shouldSave).toBe(true);
      expect(evaluation.distance).toBe(0);
      expect(evaluation.reason).toBe('FIRST_POINT');
    });

    it('does not save subsequent identical location fixes', () => {
      const evaluation = evaluateDistanceThreshold(anchor, { ...anchor });
      expect(evaluation.shouldSave).toBe(false);
      expect(evaluation.distance).toBe(0);
      expect(evaluation.reason).toBe('THRESHOLD_NOT_MET');
    });
  });
});
