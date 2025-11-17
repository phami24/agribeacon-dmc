// services/pathGenerator.ts
interface Point {
  latitude: number;
  longitude: number;
}

interface Waypoint {
  latitude: number;
  longitude: number;
  altitude: number;
}

// Convert lat/lon to meters (Web Mercator projection)
function latLonToMeters(lat: number, lon: number): { x: number; y: number } {
  const r = 6378137.0;
  const x = (lon * Math.PI) / 180.0 * r;
  const y = Math.log(Math.tan(Math.PI / 4.0 + (lat * Math.PI) / 360.0)) * r;
  return { x, y };
}

// Convert meters to lat/lon
function metersToLatLon(x: number, y: number, alt: number): Waypoint {
  const r = 6378137.0;
  const lon = (x / r) * (180.0 / Math.PI);
  const lat = (2.0 * Math.atan(Math.exp(y / r)) - Math.PI / 2.0) * (180.0 / Math.PI);
  return {
    latitude: lat,
    longitude: lon,
    altitude: alt,
  };
}

// Check if point is inside polygon
function pointInPolygon(
  p: { x: number; y: number },
  poly: { x: number; y: number }[]
): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      (yi > p.y) !== (yj > p.y) &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Clip line to polygon - optimized version using binary search
function clipLineToPolygon(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  poly: { x: number; y: number }[]
): { x: number; y: number }[] {
  // Binary search for entry point
  let entryT = 0;
  let exitT = 1;
  let foundEntry = false;
  let foundExit = false;
  
  // Find entry point (first point inside polygon)
  let low = 0;
  let high = 1;
  const steps = 20; // Giảm số steps để tối ưu
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = p1.x + t * (p2.x - p1.x);
    const y = p1.y + t * (p2.y - p1.y);
    const pt = { x, y };
    if (pointInPolygon(pt, poly)) {
      entryT = t;
      foundEntry = true;
      break;
    }
  }
  
  // Find exit point (last point inside polygon)
  if (foundEntry) {
    for (let i = steps; i >= 0; i--) {
      const t = i / steps;
      const x = p1.x + t * (p2.x - p1.x);
      const y = p1.y + t * (p2.y - p1.y);
      const pt = { x, y };
      if (pointInPolygon(pt, poly)) {
        exitT = t;
        foundExit = true;
        break;
      }
    }
  }
  
  if (!foundEntry || !foundExit || entryT >= exitT) return [];
  
  return [
    { x: p1.x + entryT * (p2.x - p1.x), y: p1.y + entryT * (p2.y - p1.y) },
    { x: p1.x + exitT * (p2.x - p1.x), y: p1.y + exitT * (p2.y - p1.y) }
  ];
}

// Rotate point around origin
function rotatePoint(
  p: { x: number; y: number },
  angleRad: number
): { x: number; y: number } {
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  return {
    x: p.x * cosA - p.y * sinA,
    y: p.x * sinA + p.y * cosA,
  };
}

// Generate optimized path
export function generateOptimizedPath(
  polygon: Point[],
  home: Point,
  altitude: number,
  fov: number,
  headingDeg: number
): Waypoint[] {
  // Convert navigation bearing (0°=North, 90°=East, clockwise)
  // to math angle (0°=East, counter-clockwise) internally
  const headingRad = ((90 - headingDeg) * Math.PI) / 180.0;
  const polyMeters = polygon.map((p) => latLonToMeters(p.latitude, p.longitude));
  const homeMeters = latLonToMeters(home.latitude, home.longitude);

  // Pre-calculate rotation values để tối ưu
  const cosHeading = Math.cos(-headingRad);
  const sinHeading = Math.sin(-headingRad);
  
  // Rotate polygon relative to home - optimized inline rotation
  const rotatedPoly = polyMeters.map((p) => {
    const relX = p.x - homeMeters.x;
    const relY = p.y - homeMeters.y;
    // Inline rotation để tránh function call overhead
    return {
      x: relX * cosHeading - relY * sinHeading,
      y: relX * sinHeading + relY * cosHeading,
    };
  });

  // Find bounding box - optimized single pass
  let minX = rotatedPoly[0].x;
  let maxX = rotatedPoly[0].x;
  let minY = rotatedPoly[0].y;
  let maxY = rotatedPoly[0].y;
  for (let i = 1; i < rotatedPoly.length; i++) {
    const p = rotatedPoly[i];
    if (p.x < minX) minX = p.x;
    else if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    else if (p.y > maxY) maxY = p.y;
  }

  // Calculate step size based on altitude and FOV
  const footprint = 2 * altitude * Math.tan((fov / 2.0) * Math.PI / 180.0);
  const step = footprint * 0.8;
  
  // Calculate polygon height
  const polyHeight = maxY - minY;
  
  // Ensure at least one scan line is generated
  // If step is too large (higher than polygon height), use polygon center
  let actualStep = step;
  if (step > polyHeight && polyHeight > 0) {
    // Use a smaller step to ensure at least 2-3 scan lines
    actualStep = polyHeight / 2;
  }

  // Generate scan lines
  const lines: { x: number; y: number }[][] = [];
  for (let y = minY; y <= maxY; y += actualStep) {
    const p1 = { x: minX, y };
    const p2 = { x: maxX, y };
    const clipped = clipLineToPolygon(p1, p2, rotatedPoly);
    if (clipped.length > 0) lines.push(clipped);
  }
  
  // If no lines were generated (edge case), create at least one line at center
  if (lines.length === 0 && polyHeight > 0) {
    const centerY = (minY + maxY) / 2;
    const p1 = { x: minX, y: centerY };
    const p2 = { x: maxX, y: centerY };
    const clipped = clipLineToPolygon(p1, p2, rotatedPoly);
    if (clipped.length > 0) lines.push(clipped);
  }

  // Connect lines (nearest neighbor approach) - optimized
  const visited = new Set<number>();
  const path: { x: number; y: number }[] = [];
  let current = { x: 0.0, y: 0.0 };
  
  // Pre-calculate distances để tối ưu (tránh tính lại nhiều lần)
  const calculateDistanceSq = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return dx * dx + dy * dy; // Dùng squared distance để tránh sqrt
  };
  
  while (visited.size < lines.length) {
    let bestIdx = -1;
    let bestDistSq = Infinity;
    let reverse = false;
    
    for (let i = 0; i < lines.length; i++) {
      if (visited.has(i)) continue;
      
      // Dùng squared distance để tránh sqrt (tối ưu hơn)
      const d1Sq = calculateDistanceSq(current, lines[i][0]);
      const d2Sq = calculateDistanceSq(current, lines[i][1]);
      
      if (d1Sq < bestDistSq) {
        bestDistSq = d1Sq;
        bestIdx = i;
        reverse = false;
      }
      if (d2Sq < bestDistSq) {
        bestDistSq = d2Sq;
        bestIdx = i;
        reverse = true;
      }
    }
    
    if (bestIdx >= 0) {
      visited.add(bestIdx);
      if (!reverse) {
        path.push(lines[bestIdx][0]);
        path.push(lines[bestIdx][1]);
        current = lines[bestIdx][1];
      } else {
        path.push(lines[bestIdx][1]);
        path.push(lines[bestIdx][0]);
        current = lines[bestIdx][0];
      }
    } else {
      break; // Không tìm thấy line nào nữa
    }
  }

  // Pre-calculate reverse rotation values
  const cosHeadingRev = Math.cos(headingRad);
  const sinHeadingRev = Math.sin(headingRad);
  
  // Convert back to lat/lon and rotate back - optimized inline rotation
  const waypoints: Waypoint[] = [];
  for (const pt of path) {
    // Inline rotation để tránh function call overhead
    const rotatedBackX = pt.x * cosHeadingRev - pt.y * sinHeadingRev;
    const rotatedBackY = pt.x * sinHeadingRev + pt.y * cosHeadingRev;
    const absX = rotatedBackX + homeMeters.x;
    const absY = rotatedBackY + homeMeters.y;
    waypoints.push(metersToLatLon(absX, absY, altitude));
  }
  return waypoints;
}

