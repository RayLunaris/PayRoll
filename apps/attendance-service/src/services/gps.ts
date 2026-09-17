export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationValidation {
  isInside: boolean;
  distance: number;
  radius: number;
}

// Haversine formula to calculate distance between two coordinates in meters
export function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371e3; // Earth's radius in meters
  
  const φ1 = (coord1.latitude * Math.PI) / 180;
  const φ2 = (coord2.latitude * Math.PI) / 180;
  const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Validate if employee is within work location radius
export function validateLocation(
  employeeLocation: Coordinates,
  workLocation: Coordinates,
  radiusMeters: number
): LocationValidation {
  const distance = calculateDistance(employeeLocation, workLocation);
  
  return {
    isInside: distance <= radiusMeters,
    distance: Math.round(distance),
    radius: radiusMeters,
  };
}

// Detect potential GPS spoofing (rapid/unrealistic coordinate jumps)
export function detectSpoofing(
  locations: Coordinates[],
  threshold: number = 1000 // 1km threshold
): boolean {
  if (locations.length < 2) return false;
  
  for (let i = 1; i < locations.length; i++) {
    const distance = calculateDistance(locations[i - 1], locations[i]);
    if (distance > threshold) {
      return true;
    }
  }
  
  return false;
}
