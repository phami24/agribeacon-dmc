import { useEffect, useRef } from "react";
import { useBLE } from "./useBLE";
import { useBLEConfig } from "../context/BLEConfigContext";

export const useAutoConnect = () => {
  const { startScan, connectionState, monitorCharacteristic, isScanning } = useBLE();
  const { config } = useBLEConfig();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasStartedMonitoringRef = useRef(false);
  const connectionStateRef = useRef(connectionState);
  const isScanningRef = useRef(isScanning);

  useEffect(() => {
    connectionStateRef.current = connectionState;
    isScanningRef.current = isScanning;
  }, [connectionState, isScanning]);

  useEffect(() => {
    if (connectionState?.isConnected) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (!hasStartedMonitoringRef.current) {
        hasStartedMonitoringRef.current = true;
        setTimeout(() => {
          monitorCharacteristic(
            config.serviceUUID,
            config.rxCharacteristicUUID
          ).catch(() => {
            hasStartedMonitoringRef.current = false;
          });
        }, 1000);
      }
      return;
    }

    hasStartedMonitoringRef.current = false;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const attemptConnect = async () => {
      if (connectionStateRef.current?.isConnected || isScanningRef.current) {
        return;
      }
      try {
        await startScan(3000);
      } catch {
        // Silent fail
      }
    };

    attemptConnect();
    intervalRef.current = setInterval(attemptConnect, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [connectionState?.isConnected, startScan, monitorCharacteristic]);
};
