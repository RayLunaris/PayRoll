import { describe, expect, it } from 'vitest';
import { calculateDistance, validateLocation, detectSpoofing } from './gps';

describe('calculateDistance', () => {
  const jakarta = { latitude: -6.2088, longitude: 106.8456 };
  const bandung = { latitude: -6.9175, longitude: 107.6191 };

  it('should calculate correct distance between Jakarta and Bandung', () => {
    const distance = calculateDistance(jakarta, bandung);
    // Actual straight-line distance is ~116 km
    expect(distance).toBeGreaterThan(100000);
    expect(distance).toBeLessThan(130000);
  });

  it('should return 0 for same coordinate', () => {
    const distance = calculateDistance(jakarta, jakarta);
    expect(distance).toBe(0);
  });

  it('should handle small distances correctly (100m radius check)', () => {
    // ~55 meters east of Jakarta coordinates
    const nearby = { latitude: -6.2088, longitude: 106.84607 };
    const distance = calculateDistance(jakarta, nearby);
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(100);
  });

  it('should be symmetric', () => {
    const distance = calculateDistance(jakarta, bandung);
    expect(calculateDistance(bandung, jakarta)).toBeCloseTo(distance, 6);
  });
});

describe('validateLocation', () => {
  const office = { latitude: -6.2088, longitude: 106.8456 };

  it('should return inside=true when within radius', () => {
    const result = validateLocation(
      { latitude: -6.2088, longitude: 106.8457 },
      office,
      100,
    );
    expect(result.isInside).toBe(true);
    expect(result.distance).toBeLessThanOrEqual(100);
    expect(result.radius).toBe(100);
  });

  it('should return inside=false when outside radius', () => {
    const far = { latitude: -6.9175, longitude: 107.6191 };
    const result = validateLocation(far, office, 100);
    expect(result.isInside).toBe(false);
    expect(result.distance).toBeGreaterThan(100);
  });
});

describe('detectSpoofing', () => {
  it('should return false for fewer than 2 locations', () => {
    expect(detectSpoofing([])).toBe(false);
    expect(detectSpoofing([{ latitude: -6.2088, longitude: 106.8456 }])).toBe(false);
  });

  it('should detect unrealistic jumps beyond threshold', () => {
    const locations = [
      { latitude: -6.2088, longitude: 106.8456 },
      { latitude: -6.9175, longitude: 107.6191 },
    ];
    expect(detectSpoofing(locations)).toBe(true);
  });

  it('should not flag small movements', () => {
    const locations = [
      { latitude: -6.2088, longitude: 106.8456 },
      { latitude: -6.20879, longitude: 106.8456 },
    ];
    expect(detectSpoofing(locations)).toBe(false);
  });
});