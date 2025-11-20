// src/index.ts
/**
 * Library Entry Point
 * 
 * Export tất cả components, hooks, types, và utilities để sử dụng như một library
 * 
 * @example
 * ```typescript
 * import {
 *   MissionSelectionScreen,
 *   MissionTopBar,
 *   MissionMapView,
 *   DrawToolbar,
 *   WPProgressDialog,
 *   BLEConfigProvider,
 *   useBLE,
 *   useFlightParameters,
 *   useMissionUpload,
 *   usePolygonDrawing,
 *   defaultMissionTheme,
 *   defaultViTranslations,
 *   defaultEnTranslations,
 *   type BLEConfig,
 *   type MissionTheme,
 *   type MissionTranslations,
 * } from '@agribeacon/device-mission-controller';
 * ```
 */

// ===== Components =====
export { default as BluetoothConnectButton } from '../components/BluetoothConnectButton';
export { default as CompassOverlay } from '../components/CompassOverlay';
export { default as HorizontalSidebar } from '../components/HorizontalSidebar';
export { default as DrawToolbar } from '../components/mission/DrawToolbar';
export { default as MissionMapView } from '../components/mission/MissionMapView';
export { default as MissionSelectionScreen } from '../components/mission/MissionSelectionScreen';
export { default as MissionTopBar } from '../components/mission/MissionTopBar';
export { default as WPProgressDialog } from '../components/mission/WPProgressDialog';
export { default as StatusCard } from '../components/StatusCard';
export { default as StatusIndicator } from '../components/StatusIndicator';

// ===== App Config =====
export { AppConfigProvider } from '../module/app/context/AppConfigProvider';

// ===== BLE Module =====
export { BLEConfigProvider, useBLEConfig } from '../module/ble/context/BLEConfigContext';
export { useAutoConnect } from '../module/ble/hooks/useAutoConnect';
export { useBLE } from '../module/ble/hooks/useBLE';
export { bleService } from '../module/ble/services';

// ===== Mapbox Module =====
export { MapboxConfigProvider, useMapboxConfig } from '../module/mapbox/context/MapboxConfigContext';

// ===== Hooks =====
export { useBLEStoreSync } from '../hooks/useBLEStoreSync';
export { ALTITUDE_MAX, ALTITUDE_MIN, ALTITUDE_STEP, useFlightParameters } from '../hooks/useFlightParameters';
export { useMissionUpload } from '../hooks/useMissionUpload';
export { usePolygonDrawing } from '../hooks/usePolygonDrawing';

// ===== Stores =====
export { useBLEStore } from '../store/bleStore';
export { useDroneDataStore } from '../store/droneDataStore';
export { usePolygonStore } from '../store/polygonStore';

// ===== Types =====
export type { FlightArea } from '../data/flightAreas';
export type { AppConfig } from '../types/appConfig';
export type { BLEConfig } from '../types/bleConfig';
export type { MissionTranslations } from '../types/i18n';
export type { MapboxConfig } from '../types/mapboxConfig';
export type { MissionTheme } from '../types/theme';
export type { Point } from '../utils/polygonUtils';

// ===== Constants & Defaults =====
export { defaultEnTranslations, defaultViTranslations, getTranslations } from '../constants/i18n';
export { defaultMissionTheme } from '../types/theme';

// ===== Utils =====
export { generateOptimizedPath } from '../services/pathGenerator';
export { buildMissionCommand, isMissionUploadComplete } from '../utils/missionUtils';
export {
  calculatePolygonBounds,
  calculatePolygonCenter, ensurePolygonClosed, getCompassZoomLevel, getPolygonCoordinates, orderSimplePolygon
} from '../utils/polygonUtils';
export { encodePolyline } from '../utils/polylineEncoder';

