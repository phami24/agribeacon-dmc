// types/bleConfig.ts
/**
 * BLE Configuration interface
 * Cho phép tùy biến BLE service UUIDs và device name
 * 
 * BẮT BUỘC phải truyền vào khi sử dụng library
 */
export interface BLEConfig {
  /** Service UUID để discover characteristics */
  serviceUUID: string;
  
  /** TX Characteristic UUID - để gửi dữ liệu từ App → Device */
  txCharacteristicUUID: string;
  
  /** RX Characteristic UUID - để nhận dữ liệu từ Device → App */
  rxCharacteristicUUID: string;
  
  /** Tên thiết bị để filter khi scan */
  targetDeviceName: string;
}

