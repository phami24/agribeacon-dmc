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
 *   MissionSidebar,
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
export { default as MissionSelectionScreen } from '../components/mission/MissionSelectionScreen';
export { default as MissionTopBar } from '../components/mission/MissionTopBar';
export { default as MissionSidebar } from '../components/mission/MissionSidebar';
export { default as MissionMapView } from '../components/mission/MissionMapView';
export { default as DrawToolbar } from '../components/mission/DrawToolbar';
export { default as WPProgressDialog } from '../components/mission/WPProgressDialog';
export { default as BluetoothConnectButton } from '../components/BluetoothConnectButton';
export { default as StatusCard } from '../components/StatusCard';
export { default as StatusIndicator } from '../components/StatusIndicator';
export { default as CompassOverlay } from '../components/CompassOverlay';
export { default as HorizontalSidebar } from '../components/HorizontalSidebar';

// ===== BLE Module =====
export { BLEConfigProvider, useBLEConfig } from '../module/ble/context/BLEConfigContext';
export { useBLE } from '../module/ble/hooks/useBLE';
export { useAutoConnect } from '../module/ble/hooks/useAutoConnect';
export { bleService } from '../module/ble/services';

// ===== Hooks =====
export { useFlightParameters, ALTITUDE_MIN, ALTITUDE_MAX, ALTITUDE_STEP } from '../hooks/useFlightParameters';
export { useMissionUpload } from '../hooks/useMissionUpload';
export { usePolygonDrawing } from '../hooks/usePolygonDrawing';
export { useBLEStoreSync } from '../hooks/useBLEStoreSync';

// ===== Stores =====
export { useBLEStore } from '../store/bleStore';
export { useDroneDataStore } from '../store/droneDataStore';
export { usePolygonStore } from '../store/polygonStore';

// ===== Types =====
export type { BLEConfig } from '../types/bleConfig';
export type { MissionTheme, defaultMissionTheme } from '../types/theme';
export type { MissionTranslations } from '../types/i18n';
export type { FlightArea } from '../data/flightAreas';
export type { Point } from '../utils/polygonUtils';

// ===== Constants & Defaults =====
export { defaultMissionTheme } from '../types/theme';
export { defaultViTranslations, defaultEnTranslations, getTranslations } from '../constants/i18n';

// ===== Utils =====
export { generateOptimizedPath } from '../services/pathGenerator';
export {
  orderSimplePolygon,
  ensurePolygonClosed,
  getPolygonCoordinates,
  calculatePolygonBounds,
  calculatePolygonCenter,
  getCompassZoomLevel,
} from '../utils/polygonUtils';
export { encodePolyline, encodeNumber } from '../utils/polylineEncoder';
export { buildMissionCommand, isMissionUploadComplete } from '../utils/missionUtils';

