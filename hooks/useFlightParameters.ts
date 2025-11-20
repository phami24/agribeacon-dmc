// hooks/useFlightParameters.ts
import { useState, useRef, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import { bleService } from "../module/ble/services";
import { MissionTranslations, defaultViTranslations } from "../types/i18n";

export const ALTITUDE_MIN = 5.5;
export const ALTITUDE_MAX = 300;
export const ALTITUDE_STEP = 0.5;

interface UseFlightParametersOptions {
  writeCharacteristic: (data: string, serviceUUID?: string, characteristicUUID?: string) => Promise<boolean>;
  isReady: boolean;
  translations?: Partial<MissionTranslations>;
}

export const useFlightParameters = (options?: UseFlightParametersOptions) => {
  const mergedTranslations = { ...defaultViTranslations, ...options?.translations };
  const [flightDirection, setFlightDirection] = useState(0);
  const [altitude, setAltitude] = useState(ALTITUDE_MIN);
  const [altitudeText, setAltitudeText] = useState(ALTITUDE_MIN.toString());
  const [previewFlightDirection, setPreviewFlightDirection] = useState(false);
  
  // Debounced values để tránh generate waypoints liên tục khi đang kéo slider
  const [debouncedFlightDirection, setDebouncedFlightDirection] = useState(0);
  const [debouncedAltitude, setDebouncedAltitude] = useState(ALTITUDE_MIN);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleAltitudeAdjust = useCallback((delta: number) => {
    setAltitude((prev) => {
      let next = prev + delta;
      if (next < ALTITUDE_MIN) next = ALTITUDE_MIN;
      if (next > ALTITUDE_MAX) next = ALTITUDE_MAX;
      const precision = 1 / ALTITUDE_STEP;
      next = Math.round(next * precision) / precision;
      return parseFloat(next.toFixed(2));
    });
  }, []);

  const canDecreaseAltitude = altitude - ALTITUDE_MIN > 1e-6;
  const canIncreaseAltitude = ALTITUDE_MAX - altitude > 1e-6;

  // Update altitude text when altitude changes
  useEffect(() => {
    setAltitudeText(altitude.toString());
  }, [altitude]);

  // Debounce flightDirection và altitude để tránh generate waypoints liên tục
  useEffect(() => {
    // Clear old timer if exists
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Set new timer - only update after 300ms without changes
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedFlightDirection(flightDirection);
      setDebouncedAltitude(altitude);
    }, 300);
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [flightDirection, altitude]);

  const handleStartFlying = useCallback(async () => {
    if (!options) return;
    
    const { writeCharacteristic, isReady } = options;
    
    // Check BLE connection
    const connectedDevice = bleService.getConnectedDevice();
    if (!connectedDevice) {
      Alert.alert(mergedTranslations.error, mergedTranslations.errorBLENotConnected);
      return;
    }

    // Check status
    if (!isReady) {
      Alert.alert(mergedTranslations.error, mergedTranslations.errorDroneNotReady);
      return;
    }

    try {
      // Send START command
      const startCmd = "START\r\n";
      console.log("=== LỆNH START ===");
      console.log(startCmd);
      console.log("==================");

      const success = await writeCharacteristic(startCmd);

      if (success) {
        console.log("✓ Đã gửi lệnh START thành công");
        Alert.alert(mergedTranslations.success, mergedTranslations.successStartCommandSent);
      } else {
        console.error("✗ Gửi lệnh START thất bại");
        Alert.alert(mergedTranslations.error, mergedTranslations.errorStartCommandFailed);
      }
    } catch (error) {
      console.error("Error sending START command:", error);
      Alert.alert(mergedTranslations.error, mergedTranslations.errorStartCommandError);
    }
  }, [options, mergedTranslations]);

  return {
    flightDirection,
    setFlightDirection,
    altitude,
    setAltitude,
    altitudeText,
    setAltitudeText,
    previewFlightDirection,
    setPreviewFlightDirection,
    debouncedFlightDirection,
    debouncedAltitude,
    handleAltitudeAdjust,
    canDecreaseAltitude,
    canIncreaseAltitude,
    handleStartFlying,
  };
};

