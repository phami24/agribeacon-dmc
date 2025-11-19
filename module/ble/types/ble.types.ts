// modules/ble/types/ble.types.ts

import { Device } from 'react-native-ble-plx';

/**
 * Thông tin thiết bị BLE đã được format
 */
export interface BLEDevice {
  id: string;
  name: string | null;
  rssi: number | null;
  serviceUUIDs?: string[];
}

/**
 * Dữ liệu nhận được từ Characteristic
 */
export interface BLECharacteristicData {
  deviceId: string;
  characteristicUUID: string;
  serviceUUID: string;
  value: string;
  timestamp: number;
}

/**
 * Trạng thái kết nối
 */
export interface BLEConnectionState {
  deviceId: string;
  isConnected: boolean;
  error?: string;
  mtu?: number; // MTU (Maximum Transmission Unit) size
}

/**
 * Event Types cho Event Bus
 * Định nghĩa tất cả các loại event mà BLE module có thể phát ra
 */
export enum BLEEventType {
  // Device events
  DEVICE_DISCOVERED = 'ble:device:discovered', // Chỉ thiết bị target
  DEVICE_CONNECTED = 'ble:device:connected',
  DEVICE_DISCONNECTED = 'ble:device:disconnected',
  
  // Data events
  DATA_RECEIVED = 'ble:data:received',
  DATA_PARSED = 'ble:data:parsed', // Data đã parse từ KEY:"value"
  
  // Scan events
  SCAN_STARTED = 'ble:scan:started',
  SCAN_STOPPED = 'ble:scan:stopped',
  
  // Error events
  ERROR = 'ble:error',
  
  // Connection state
  CONNECTION_STATE_CHANGED = 'ble:connection:state:changed',
}

/**
 * Parsed data từ format KEY:"value"
 */
export interface ParsedData {
  key: string;
  value: string;
  timestamp: number;
  deviceId: string;
}

/**
 * Mapping giữa EventType và Data tương ứng
 * Đảm bảo type-safety khi emit/on events
 */
export type BLEEventData = {
  [BLEEventType.DEVICE_DISCOVERED]: BLEDevice;
  [BLEEventType.DEVICE_CONNECTED]: { deviceId: string; deviceName: string | null };
  [BLEEventType.DEVICE_DISCONNECTED]: { deviceId: string; reason?: string };
  [BLEEventType.DATA_RECEIVED]: BLECharacteristicData;
  [BLEEventType.DATA_PARSED]: ParsedData;
  [BLEEventType.SCAN_STARTED]: { timestamp: number };
  [BLEEventType.SCAN_STOPPED]: { timestamp: number };
  [BLEEventType.ERROR]: { error: string; context?: string };
  [BLEEventType.CONNECTION_STATE_CHANGED]: BLEConnectionState;
};