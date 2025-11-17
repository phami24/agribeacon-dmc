// modules/ble/index.ts

/**
 * Public API của BLE Module
 * 
 * Đây là điểm truy cập duy nhất vào BLE module từ bên ngoài
 * Chỉ export những gì cần thiết
 * 
 * Import examples:
 * import { useBLE, bleService, BLEDevice } from '@/modules/ble';
 */

// Services
export { bleService } from './services';

// Hooks
export { useBLE } from './hooks';

// Types
export type { 
  BLEDevice, 
  BLECharacteristicData,
  BLEConnectionState,
  BLEEventType,
  BLEEventData,
} from './types';