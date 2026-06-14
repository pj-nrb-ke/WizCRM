import { describe, expect, it } from 'vitest';
import { DEFAULT_CHECK_IN_RADIUS_METERS, haversineDistanceMeters, isWithinGeofence } from './geo.js';

describe('haversineDistanceMeters', () => {
  it('returns ~0 for identical points', () => {
    expect(haversineDistanceMeters(-33.9, 18.4, -33.9, 18.4)).toBeLessThan(1);
  });

  it('measures known short distance roughly', () => {
    // ~111m per 0.001° latitude at equator; use small delta
    const d = haversineDistanceMeters(0, 0, 0.001, 0);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
  });
});

describe('isWithinGeofence', () => {
  it('accepts point at venue with default radius', () => {
    expect(isWithinGeofence(-33.9, 18.4, -33.9, 18.4, DEFAULT_CHECK_IN_RADIUS_METERS)).toBe(true);
  });

  it('rejects point far from venue', () => {
    expect(isWithinGeofence(0, 0, 1, 1, DEFAULT_CHECK_IN_RADIUS_METERS)).toBe(false);
  });
});
