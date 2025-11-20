// hooks/useMissionUpload.ts
import { useState, useRef, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import { useBLE } from "../module/ble/hooks/useBLE";
import { useDroneDataStore } from "../store/droneDataStore";
import { bleService } from "../module/ble/services";
import { buildMissionCommand, isMissionUploadComplete } from "../utils/missionUtils";
import { Point } from "../utils/polygonUtils";
import { MissionTranslations, defaultViTranslations } from "../types/i18n";

interface UseMissionUploadOptions {
  translations?: Partial<MissionTranslations>;
}

export const useMissionUpload = (options?: UseMissionUploadOptions) => {
  const mergedTranslations = { ...defaultViTranslations, ...options?.translations };
  const { writeCharacteristic } = useBLE();
  const [isUploading, setIsUploading] = useState(false);
  const [wpDialogVisible, setWpDialogVisible] = useState(false);
  const [wpValue, setWpValue] = useState<string>("");
  const [isUploaded, setIsUploaded] = useState(false);
  const wpCheckTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timer when component unmount
  useEffect(() => {
    return () => {
      if (wpCheckTimerRef.current) {
        clearTimeout(wpCheckTimerRef.current);
        wpCheckTimerRef.current = null;
      }
    };
  }, []);

  // Check WP status and show dialog if needed
  const checkWPStatus = useCallback(() => {
    // Clear old timer if exists
    if (wpCheckTimerRef.current) {
      clearTimeout(wpCheckTimerRef.current);
      wpCheckTimerRef.current = null;
    }

    const currentWP = useDroneDataStore.getState().wp;
    
    if (!currentWP) {
      // No WP yet, continue waiting
      wpCheckTimerRef.current = setTimeout(() => {
        checkWPStatus();
      }, 1000);
      return;
    }

    if (isMissionUploadComplete(currentWP)) {
      // Complete - hide loading and dialog
      setIsUploading(false);
      setWpDialogVisible(false);
      setIsUploaded(true); // Mark as uploaded
      Alert.alert("Thành công", "Đã gửi mission thành công!");
    } else {
      // Not complete - show dialog and continue checking
      setWpValue(currentWP);
      setWpDialogVisible(true);
      
      // Continue checking every second
      wpCheckTimerRef.current = setTimeout(() => {
        checkWPStatus();
      }, 1000);
    }
  }, []);

  const handleSendToDrone = useCallback(async (
    polygon: Array<{ latitude: number; longitude: number }>,
    altitude: number,
    flightDirection: number
  ) => {
    // Validate polygon
    if (!polygon || polygon.length < 3) {
      Alert.alert(mergedTranslations.error, mergedTranslations.errorNeed3Points);
      return;
    }

    // Check BLE connection - check directly from service (more accurate)
    const connectedDevice = bleService.getConnectedDevice();
    if (!connectedDevice) {
      Alert.alert(mergedTranslations.error, mergedTranslations.errorBLENotConnected);
      return;
    }

    try {
      // Build command
      const missionCmd = buildMissionCommand(polygon, altitude, flightDirection);

      // Log command to console
      console.log("=== LỆNH GỬI LÊN DRONE ===");
      console.log(missionCmd);
      console.log("==========================");

      // Clear old timer if exists
      if (wpCheckTimerRef.current) {
        clearTimeout(wpCheckTimerRef.current);
        wpCheckTimerRef.current = null;
      }
      
      // Show loading and dialog immediately
      setIsUploading(true);
      setWpDialogVisible(true);
      setWpValue(mergedTranslations.sending);

      // Send via BLE
      const success = await writeCharacteristic(missionCmd);

      if (success) {
        console.log("✓ Đã gửi lệnh thành công qua BLE");
        
        // After 3 seconds, check WP
        wpCheckTimerRef.current = setTimeout(() => {
          checkWPStatus();
        }, 3000);
      } else {
        console.error("✗ Gửi lệnh thất bại");
        setIsUploading(false);
        setWpDialogVisible(false);
        Alert.alert(mergedTranslations.error, mergedTranslations.errorMissionFailed);
      }
    } catch (error) {
      console.error("Error sending mission command:", error);
      setIsUploading(false);
      setWpDialogVisible(false);
      Alert.alert(mergedTranslations.error, mergedTranslations.errorMissionError);
    }
  }, [writeCharacteristic, checkWPStatus, mergedTranslations]);

  return {
    isUploading,
    wpDialogVisible,
    wpValue,
    isUploaded,
    handleSendToDrone,
  };
};

