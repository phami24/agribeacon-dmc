// types/i18n.ts
export interface MissionTranslations {
  // MissionTopBar
  flightTime: string;
  distance: string;
  batteryLevel: string;
  
  // MissionSidebar
  flightDirection: string;
  adjustOnMap: string;
  altitude: string;
  previewFlightDirection: string;
  sendToDrone: string;
  sending: string;
  startFlying: string;
  
  // MissionSelectionScreen
  selectFlightArea: string;
  manualDraw: string;
  area: string;
  beds: string;
  hectares: string;
  
  // MissionMapView
  deletePoint: string;
  confirmDelete: string;
  cancel: string;
  delete: string;
  calculatingPath: string;
  
  // WPProgressDialog
  sendingMission: string;
  waypoint: string;
  
  // StatusIndicator
  ready: string;
  notReady: string;
  
  // Common
  unit: string; // "°" for degrees
  altitudeUnit: string; // "m" for meters
}

export const defaultViTranslations: MissionTranslations = {
  flightTime: "Thời gian bay",
  distance: "Khoảng cách",
  batteryLevel: "Dung lượng pin",
  flightDirection: "Hướng bay",
  adjustOnMap: "Điều chỉnh trên bản đồ",
  altitude: "Độ cao",
  previewFlightDirection: "Xem trước hướng bay",
  sendToDrone: "Gửi thông tin lên drone",
  sending: "Đang gửi...",
  startFlying: "Bắt đầu bay",
  selectFlightArea: "Chọn khu vực bay",
  manualDraw: "Vẽ khu vực bay thủ công",
  area: "ha",
  beds: "luống",
  hectares: "ha",
  deletePoint: "Xóa điểm",
  confirmDelete: "Bạn có chắc chắn muốn xóa điểm này?",
  cancel: "Hủy",
  delete: "Xóa",
  calculatingPath: "Đang tính toán đường bay...",
  sendingMission: "Đang gửi mission...",
  waypoint: "Waypoint",
  ready: "Sẵn sàng bay",
  notReady: "Chưa sẵn sàng bay",
  unit: "°",
  altitudeUnit: "m",
};

export const defaultEnTranslations: MissionTranslations = {
  flightTime: "Flight Time",
  distance: "Distance",
  batteryLevel: "Battery Level",
  flightDirection: "Flight Direction",
  adjustOnMap: "Adjust on Map",
  altitude: "Altitude",
  previewFlightDirection: "Preview Flight Direction",
  sendToDrone: "Send to Drone",
  sending: "Sending...",
  startFlying: "Start Flying",
  selectFlightArea: "Select Flight Area",
  manualDraw: "Manual Draw Area",
  area: "ha",
  beds: "beds",
  hectares: "ha",
  deletePoint: "Delete Point",
  confirmDelete: "Are you sure you want to delete this point?",
  cancel: "Cancel",
  delete: "Delete",
  calculatingPath: "Calculating flight path...",
  sendingMission: "Sending mission...",
  waypoint: "Waypoint",
  ready: "Ready to Fly",
  notReady: "Not Ready",
  unit: "°",
  altitudeUnit: "m",
};

