// module/mapbox/context/MapboxConfigContext.tsx
import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import MapboxGL from '@rnmapbox/maps';
import { MapboxConfig } from '../../../types/mapboxConfig';

interface MapboxConfigContextValue {
  config: MapboxConfig;
}

const MapboxConfigContext = createContext<MapboxConfigContextValue | null>(null);

interface MapboxConfigProviderProps {
  config: MapboxConfig; // BẮT BUỘC phải truyền vào
  children: ReactNode;
}

/**
 * MapboxConfigProvider - Cung cấp Mapbox configuration cho toàn bộ app
 * 
 * Tự động khởi tạo Mapbox với access token khi mount
 * 
 * BẮT BUỘC phải truyền config vào
 * 
 * @example
 * ```tsx
 * <MapboxConfigProvider config={{ accessToken: "your-mapbox-token" }}>
 *   <App />
 * </MapboxConfigProvider>
 * ```
 */
export function MapboxConfigProvider({ config, children }: MapboxConfigProviderProps) {
  // Initialize Mapbox khi component mount
  useEffect(() => {
    MapboxGL.setAccessToken(config.accessToken);
    console.log("[Mapbox] Token initialized");
  }, [config.accessToken]);

  return (
    <MapboxConfigContext.Provider value={{ config }}>
      {children}
    </MapboxConfigContext.Provider>
  );
}

/**
 * Hook để lấy Mapbox config từ context
 * 
 * @throws Error nếu chưa wrap trong MapboxConfigProvider
 * 
 * @example
 * ```tsx
 * const { config } = useMapboxConfig();
 * console.log(config.accessToken);
 * ```
 */
export function useMapboxConfig(): MapboxConfigContextValue {
  const context = useContext(MapboxConfigContext);
  if (!context) {
    throw new Error(
      'useMapboxConfig must be used within MapboxConfigProvider. ' +
      'Please wrap your app with <MapboxConfigProvider config={...}>'
    );
  }
  return context;
}

