// types/appConfig.ts
/**
 * App Configuration - Tổng hợp tất cả configs
 */
import { BLEConfig } from './bleConfig';
import { MapboxConfig } from './mapboxConfig';

export interface AppConfig {
  /** BLE Configuration */
  ble: BLEConfig;
  
  /** Mapbox Configuration */
  mapbox: MapboxConfig;
}

