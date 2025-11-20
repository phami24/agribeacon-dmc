// utils/polygonUtils.ts
export interface Point {
  id: string;
  latitude: number;
  longitude: number;
}

export type HistoryAction =
  | { type: "add"; point: Point }
  | { type: "delete"; point: Point }
  | {
      type: "move";
      pointId: string;
      oldCoords: { longitude: number; latitude: number };
      newCoords: { longitude: number; latitude: number };
    }
  | { type: "state"; points: Point[] };

export const arePointsInSameOrder = (a: Point[], b: Point[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i]?.id !== b[i]?.id) {
      return false;
    }
  }
  return true;
};

// Order points to form a simple polygon (approximate) by sorting around centroid
export const orderSimplePolygon = (points: Point[]): Point[] => {
  if (points.length < 3) return [...points];

  // Remove duplicate last point if polygon is already closed
  let pointsToSort = [...points];
  if (pointsToSort.length > 3) {
    const first = pointsToSort[0];
    const last = pointsToSort[pointsToSort.length - 1];
    const isClosed =
      Math.abs(first.latitude - last.latitude) < 1e-7 &&
      Math.abs(first.longitude - last.longitude) < 1e-7;
    if (isClosed) {
      pointsToSort = pointsToSort.slice(0, -1);
    }
  }

  // Calculate centroid
  let cx = 0,
    cy = 0;
  for (const p of pointsToSort) {
    cy += p.latitude;
    cx += p.longitude;
  }
  cx /= pointsToSort.length;
  cy /= pointsToSort.length;

  // Sort by angle from centroid
  const sorted = [...pointsToSort];
  sorted.sort((a, b) => {
    const aa = Math.atan2(a.latitude - cy, a.longitude - cx);
    const bb = Math.atan2(b.latitude - cy, b.longitude - cx);
    return aa - bb;
  });

  return sorted;
};

// Ensure polygon is closed (first point = last point)
export const ensurePolygonClosed = (points: Point[]): Point[] => {
  if (points.length < 3) return [...points];

  const closed = [...points];
  const first = closed[0];
  const last = closed[closed.length - 1];
  const isClosed =
    Math.abs(first.latitude - last.latitude) < 1e-7 &&
    Math.abs(first.longitude - last.longitude) < 1e-7;

  if (!isClosed) {
    closed.push({ ...first });
  }

  return closed;
};

// Get polygon coordinates for rendering
export const getPolygonCoordinates = (points: Point[]): number[][] => {
  if (!points || points.length < 3) return [];
  const coords = points.map((p: Point) => [p.longitude, p.latitude]);
  // Close the polygon
  coords.push([points[0].longitude, points[0].latitude]);
  return coords;
};

// Calculate polygon bounds
export const calculatePolygonBounds = (points: Point[]) => {
  if (!points || points.length < 3) return null;
  const pointsToCheck = points.slice(0, -1); // Remove duplicate last point if exists
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLon = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;

  for (const p of pointsToCheck) {
    if (p.latitude < minLat) minLat = p.latitude;
    if (p.latitude > maxLat) maxLat = p.latitude;
    if (p.longitude < minLon) minLon = p.longitude;
    if (p.longitude > maxLon) maxLon = p.longitude;
  }

  return {
    minLatitude: minLat,
    maxLatitude: maxLat,
    minLongitude: minLon,
    maxLongitude: maxLon,
  };
};

// Calculate polygon center (centroid)
export const calculatePolygonCenter = (points: Point[]) => {
  if (!points || points.length < 3) return null;
  // Remove duplicate last point if exists
  const pointsToCheck = points.slice(0, -1);
  let cx = 0;
  let cy = 0;
  for (const p of pointsToCheck) {
    cx += p.longitude;
    cy += p.latitude;
  }
  cx /= pointsToCheck.length;
  cy /= pointsToCheck.length;
  return { longitude: cx, latitude: cy };
};

// Get compass zoom level based on polygon bounds
export const getCompassZoomLevel = (bounds: ReturnType<typeof calculatePolygonBounds> | null): number => {
  const COMPASS_FOCUS_ZOOM = 19.3;
  if (!bounds) return COMPASS_FOCUS_ZOOM;
  const latSpan = bounds.maxLatitude - bounds.minLatitude;
  const lonSpan = bounds.maxLongitude - bounds.minLongitude;
  const span = Math.max(latSpan, lonSpan);

  if (span < 0.0003) return 20;
  if (span < 0.0008) return 19.2;
  if (span < 0.0015) return 18.7;
  if (span < 0.003) return 18.2;
  return 17.5;
};

// Calculate buffer polygon (expand polygon outward)
// distanceInMeters: distance to expand in meters
export const calculateBufferPolygon = (
  points: Point[],
  distanceInMeters: number
): Point[] => {
  if (!points || points.length < 3) return [];

  // Remove duplicate last point if exists
  const pointsToProcess = points.slice(0, -1);
  const closedPoints = ensurePolygonClosed(pointsToProcess);
  const processedPoints = closedPoints.slice(0, -1); // Remove duplicate last point

  // Approximate: 1 degree latitude ≈ 111,320 meters
  // 1 degree longitude ≈ 111,320 * cos(latitude) meters
  const avgLat = processedPoints.reduce((sum, p) => sum + p.latitude, 0) / processedPoints.length;
  const latOffset = distanceInMeters / 111320;
  const lonOffset = distanceInMeters / (111320 * Math.cos((avgLat * Math.PI) / 180));

  // For each point, calculate outward normal vector and offset
  const bufferedPoints: Point[] = [];

  for (let i = 0; i < processedPoints.length; i++) {
    const prev = processedPoints[(i - 1 + processedPoints.length) % processedPoints.length];
    const curr = processedPoints[i];
    const next = processedPoints[(i + 1) % processedPoints.length];

    // Calculate vectors
    const v1x = curr.longitude - prev.longitude;
    const v1y = curr.latitude - prev.latitude;
    const v2x = next.longitude - curr.longitude;
    const v2y = next.latitude - curr.latitude;

    // Normalize vectors
    const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const len2 = Math.sqrt(v2x * v2x + v2y * v2y);
    const n1x = len1 > 0 ? -v1y / len1 : 0;
    const n1y = len1 > 0 ? v1x / len1 : 0;
    const n2x = len2 > 0 ? -v2y / len2 : 0;
    const n2y = len2 > 0 ? v2x / len2 : 0;

    // Average normal (bisector)
    const nx = (n1x + n2x) / 2;
    const ny = (n1y + n2y) / 2;
    const nlen = Math.sqrt(nx * nx + ny * ny);
    const normalizedNx = nlen > 0 ? nx / nlen : 0;
    const normalizedNy = nlen > 0 ? ny / nlen : 0;

    // Offset point
    const offsetLat = normalizedNy * latOffset;
    const offsetLon = normalizedNx * lonOffset;

    bufferedPoints.push({
      id: `buffer-${curr.id}`,
      latitude: curr.latitude + offsetLat,
      longitude: curr.longitude + offsetLon,
    });
  }

  return ensurePolygonClosed(bufferedPoints);
};

