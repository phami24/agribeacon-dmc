// constants/exampleBLEConfig.ts
/**
 * Example BLE Config cho AgriBeacon BLE
 * 
 * Đây là file DEMO/EXAMPLE - không phải default config
 * Người dùng library PHẢI tự tạo config của mình
 */
import { BLEConfig } from '../types/bleConfig';

/**
 * Example config cho AgriBeacon BLE với Nordic UART Service
 * 
 * @example
 * ```tsx
 * import { BLEConfigProvider } from '@agribeacon/device-mission-controller';
 * import { agriBeaconBLEConfig } from '@agribeacon/device-mission-controller/constants/exampleBLEConfig';
 * 
 * <BLEConfigProvider config={agriBeaconBLEConfig}>
 *   <App />
 * </BLEConfigProvider>
 * ```
 */
export const agriBeaconBLEConfig: BLEConfig = {
  serviceUUID: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
  txCharacteristicUUID: "6e400002-b5a3-f393-e0a9-e50e24dcca9e",
  rxCharacteristicUUID: "6e400003-b5a3-f393-e0a9-e50e24dcca9e",
  targetDeviceName: "AgriBeacon BLE",
};

