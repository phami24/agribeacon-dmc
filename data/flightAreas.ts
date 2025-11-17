// data/flightAreas.ts
/**
 * Seed data cho các khu vực bay
 */

export interface FlightArea {
  id: string;
  name: string;
  area: number; // Hectares
  beds: number; // Số luống
  coordinates: {
    latitude: number;
    longitude: number;
  }[];
  center: {
    latitude: number;
    longitude: number;
  };
}

export const flightAreas: FlightArea[] = [
  {
    id: "1",
    name: "Khu đất đỏ",
    area: 0.32,
    beds: 12,
    center: {
      latitude: 10.762622,
      longitude: 106.660172,
    },
    coordinates: [
      { latitude: 10.762622, longitude: 106.660172 },
      { latitude: 10.763622, longitude: 106.660172 },
      { latitude: 10.763622, longitude: 106.661172 },
      { latitude: 10.762622, longitude: 106.661172 },
    ],
  },
  {
    id: "2",
    name: "Khu Test phân đạm mới",
    area: 0.32,
    beds: 12,
    center: {
      latitude: 10.764622,
      longitude: 106.662172,
    },
    coordinates: [
      { latitude: 10.764622, longitude: 106.662172 },
      { latitude: 10.765622, longitude: 106.662172 },
      { latitude: 10.765622, longitude: 106.663172 },
      { latitude: 10.764622, longitude: 106.663172 },
    ],
  },
  {
    id: "3",
    name: "Khu test tên dài thật là dài đến mức không thể hiển thị hết được",
    area: 0.32,
    beds: 12,
    center: {
      latitude: 10.766622,
      longitude: 106.664172,
    },
    coordinates: [
      { latitude: 10.766622, longitude: 106.664172 },
      { latitude: 10.767622, longitude: 106.664172 },
      { latitude: 10.767622, longitude: 106.665172 },
      { latitude: 10.766622, longitude: 106.665172 },
    ],
  },
];

