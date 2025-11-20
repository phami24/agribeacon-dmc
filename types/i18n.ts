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
  
  // Alert messages
  error: string;
  success: string;
  errorNeed3Points: string;
  errorBLENotConnected: string;
  errorDroneNotReady: string;
  successStartCommandSent: string;
  errorStartCommandFailed: string;
  errorStartCommandError: string;
  successMissionSent: string;
  errorMissionFailed: string;
  errorMissionError: string;
  clearAll: string;
  confirmClearAll: string;
  bluetoothNotEnabled: string;
  bluetoothNotEnabledMessage: string;
  openSettings: string;
  errorCannotConnect: string;
  sending: string; // "Đang gửi..."
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
  error: "Lỗi",
  success: "Thành công",
  errorNeed3Points: "Cần ít nhất 3 điểm để gửi mission",
  errorBLENotConnected: "Chưa kết nối BLE. Vui lòng đợi kết nối...",
  errorDroneNotReady: "Drone chưa sẵn sàng. Status phải = 1",
  successStartCommandSent: "Đã gửi lệnh bắt đầu bay!",
  errorStartCommandFailed: "Gửi lệnh START thất bại",
  errorStartCommandError: "Có lỗi xảy ra khi gửi lệnh START",
  successMissionSent: "Đã gửi mission thành công!",
  errorMissionFailed: "Gửi lệnh thất bại",
  errorMissionError: "Có lỗi xảy ra khi gửi lệnh",
  clearAll: "Xóa tất cả",
  confirmClearAll: "Bạn có chắc chắn muốn xóa tất cả các điểm?",
  bluetoothNotEnabled: "Bluetooth chưa bật",
  bluetoothNotEnabledMessage: "Vui lòng bật Bluetooth để kết nối với thiết bị bay.",
  openSettings: "Mở Cài đặt",
  errorCannotConnect: "Không thể kết nối",
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
  error: "Error",
  success: "Success",
  errorNeed3Points: "Need at least 3 points to send mission",
  errorBLENotConnected: "BLE not connected. Please wait for connection...",
  errorDroneNotReady: "Drone not ready. Status must be = 1",
  successStartCommandSent: "Start command sent successfully!",
  errorStartCommandFailed: "Failed to send START command",
  errorStartCommandError: "Error occurred while sending START command",
  successMissionSent: "Mission sent successfully!",
  errorMissionFailed: "Failed to send command",
  errorMissionError: "Error occurred while sending command",
  clearAll: "Clear All",
  confirmClearAll: "Are you sure you want to delete all points?",
  bluetoothNotEnabled: "Bluetooth Not Enabled",
  bluetoothNotEnabledMessage: "Please enable Bluetooth to connect to the drone.",
  openSettings: "Open Settings",
  errorCannotConnect: "Cannot connect",
};

