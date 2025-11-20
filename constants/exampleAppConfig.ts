// constants/exampleAppConfig.ts
/**
 * Example App Config cho AgriBeacon
 * 
 * Đây là file DEMO/EXAMPLE - không phải default config
 * Người dùng library PHẢI tự tạo config của mình
 */
import { AppConfig } from '../types/appConfig';
import { agriBeaconBLEConfig } from './exampleBLEConfig';

/**
 * Example config cho AgriBeacon với BLE và Mapbox
 * 
 * @example
 * ```tsx
 * import { AppConfigProvider } from '@agribeacon/device-mission-controller';
 * import { agriBeaconAppConfig } from '@agribeacon/device-mission-controller/constants/exampleAppConfig';
 * 
 * <AppConfigProvider config={agriBeaconAppConfig}>
 *   <App />
 * </AppConfigProvider>
 * ```
 */
export const agriBeaconAppConfig: AppConfig = {
  ble: agriBeaconBLEConfig,
  mapbox: {
    accessToken: 'YOUR_MAPBOX_TOKEN_HERE', // Thay bằng token của bạn
  },
};

