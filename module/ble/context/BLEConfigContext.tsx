// module/ble/context/BLEConfigContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { BLEConfig } from '../../../types/bleConfig';

interface BLEConfigContextValue {
  config: BLEConfig;
}

const BLEConfigContext = createContext<BLEConfigContextValue | null>(null);

interface BLEConfigProviderProps {
  config: BLEConfig; // BẮT BUỘC phải truyền vào
  children: ReactNode;
}

/**
 * BLEConfigProvider - Cung cấp BLE configuration cho toàn bộ app
 * 
 * BẮT BUỘC phải truyền config vào
 * 
 * @example
 * ```tsx
 * <BLEConfigProvider config={{
 *   targetDeviceName: "My Custom Device",
 *   serviceUUID: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
 *   txCharacteristicUUID: "6e400002-b5a3-f393-e0a9-e50e24dcca9e",
 *   rxCharacteristicUUID: "6e400003-b5a3-f393-e0a9-e50e24dcca9e",
 * }}>
 *   <App />
 * </BLEConfigProvider>
 * ```
 */
export function BLEConfigProvider({ config, children }: BLEConfigProviderProps) {
  return (
    <BLEConfigContext.Provider value={{ config }}>
      {children}
    </BLEConfigContext.Provider>
  );
}

/**
 * Hook để lấy BLE config từ context
 * 
 * @throws Error nếu chưa wrap trong BLEConfigProvider
 * 
 * @example
 * ```tsx
 * const { config } = useBLEConfig();
 * console.log(config.targetDeviceName);
 * ```
 */
export function useBLEConfig(): BLEConfigContextValue {
  const context = useContext(BLEConfigContext);
  if (!context) {
    throw new Error(
      'useBLEConfig must be used within BLEConfigProvider. ' +
      'Please wrap your app with <BLEConfigProvider config={...}>'
    );
  }
  return context;
}

