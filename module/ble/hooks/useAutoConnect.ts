import { useEffect, useRef } from "react";
import { useBLE } from "./useBLE";
import * as BleConstants from "../../../constants/BLEConstants";

export const useAutoConnect = () => {
  const { startScan, connectionState, monitorCharacteristic, isScanning } = useBLE();
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
            BleConstants.NORDIC_UART_SERVICE,
            BleConstants.NORDIC_RX_UUID
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
