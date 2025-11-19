// utils/missionUtils.ts
import { Point } from "./polygonUtils";
import { encodePolyline } from "./polylineEncoder";

// Build mission command for drone
export const buildMissionCommand = (
  polygon: Array<{ latitude: number; longitude: number }>,
  altitude: number,
  flightDirection: number
): string => {
  // Encode polygon
  const encodedPolygon = encodePolyline(polygon);

  // Round altitude and bearing (same as Dart version)
  const altInt = Math.round(altitude);
  const bearingInt = Math.round(flightDirection);

  // Build command: MISSION_SCAN<alt>::<bearing>::<encoded>
  return `MISSION_SCAN${altInt}::${bearingInt}::${encodedPolygon}\r\n`;
};

// Parse WP status from format "a/b"
export const parseWPStatus = (wp: string): { a: number; b: number } | null => {
  const parts = wp.split('/');
  if (parts.length !== 2) {
    return null;
  }

  const a = parseInt(parts[0], 10);
  const b = parseInt(parts[1], 10);

  if (isNaN(a) || isNaN(b)) {
    return null;
  }

  return { a, b };
};

// Check if mission upload is complete
export const isMissionUploadComplete = (wp: string | null): boolean => {
  if (!wp) return false;
  const parsed = parseWPStatus(wp);
  if (!parsed) return false;
  return parsed.a === parsed.b;
};

