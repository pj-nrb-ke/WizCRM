/** Default meeting check-in radius (MGT-022 placeholder until org setting is configured). */
export const DEFAULT_CHECK_IN_RADIUS_METERS = 150;

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in meters between two WGS84 points. */
export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function isWithinGeofence(
  userLat: number,
  userLng: number,
  venueLat: number,
  venueLng: number,
  radiusMeters: number,
): boolean {
  return haversineDistanceMeters(userLat, userLng, venueLat, venueLng) <= radiusMeters;
}
