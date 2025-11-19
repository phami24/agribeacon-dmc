// utils/polylineEncoder.ts

// Encode polyline using Google Polyline algorithm (same as Dart version)
export const encodePolyline = (coords: Array<{ latitude: number; longitude: number }>): string => {
  if (coords.length === 0) return "";
  
  let prevLat = 0;
  let prevLng = 0;
  let encoded = "";
  
  for (const coord of coords) {
    // Scale by 1e5 (same as Dart version)
    const lat = Math.round(coord.latitude * 1e5);
    const lng = Math.round(coord.longitude * 1e5);
    
    // Encode delta
    encoded += encodeNumber(lat - prevLat);
    encoded += encodeNumber(lng - prevLng);
    
    prevLat = lat;
    prevLng = lng;
  }
  
  return encoded;
};

// Encode a single number for polyline
const encodeNumber = (num: number): string => {
  // Left shift by 1, invert if negative
  num = num < 0 ? ~(num << 1) : (num << 1);
  let encoded = "";
  
  while (num >= 0x20) {
    encoded += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
    num >>= 5;
  }
  
  encoded += String.fromCharCode(num + 63);
  return encoded;
};

