// hooks/useFlightParameters.ts
import { useState, useRef, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import { bleService } from "../module/ble/services";

export const ALTITUDE_MIN = 5.5;
export const ALTITUDE_MAX = 300;
export const ALTITUDE_STEP = 0.5;

interface UseFlightParametersOptions {
  writeCharacteristic: (serviceUUID: string, characteristicUUID: string, value: string) => Promise<boolean>;
  isReady: boolean;
}

export const useFlightParameters = (options?: UseFlightParametersOptions) => {
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
      Alert.alert("Lỗi", "Chưa kết nối BLE. Vui lòng đợi kết nối...");
      return;
    }

    // Check status
    if (!isReady) {
      Alert.alert("Lỗi", "Drone chưa sẵn sàng. Status phải = 1");
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
        Alert.alert("Thành công", "Đã gửi lệnh bắt đầu bay!");
      } else {
        console.error("✗ Gửi lệnh START thất bại");
        Alert.alert("Lỗi", "Gửi lệnh START thất bại");
      }
    } catch (error) {
      console.error("Error sending START command:", error);
      Alert.alert("Lỗi", "Có lỗi xảy ra khi gửi lệnh START");
    }
  }, [options]);

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

