// module/app/context/AppConfigProvider.tsx
import React, { ReactNode } from 'react';
import { BLEConfigProvider } from '../../ble/context/BLEConfigContext';
import { MapboxConfigProvider } from '../../mapbox/context/MapboxConfigContext';
import { AppConfig } from '../../../types/appConfig';

interface AppConfigProviderProps {
  config: AppConfig; // BẮT BUỘC phải truyền vào
  children: ReactNode;
}

/**
 * AppConfigProvider - Provider tổng hợp cho tất cả configs
 * 
 * Wrap BLE và Mapbox configs vào một provider duy nhất
 * 
 * @example
 * ```tsx
 * <AppConfigProvider config={{
 *   ble: { serviceUUID: "...", ... },
 *   mapbox: { accessToken: "..." }
 * }}>
 *   <App />
 * </AppConfigProvider>
 * ```
 */
export function AppConfigProvider({ config, children }: AppConfigProviderProps) {
  return (
    <MapboxConfigProvider config={config.mapbox}>
      <BLEConfigProvider config={config.ble}>
        {children}
      </BLEConfigProvider>
    </MapboxConfigProvider>
  );
}

