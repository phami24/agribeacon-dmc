// modules/ble/hooks/useBLE.ts

import { useCallback, useEffect } from "react";
import { bleService } from "../services";
import { useBLEStore } from "../../../store/bleStore";
import { useBLEConfig } from "../context/BLEConfigContext";

type StartScanOptions = {
  force?: boolean;
};

/**
 * Hook tiện lợi trả về state BLE toàn cục + helpers thao tác với BLEService
 * Tất cả state được lưu trong BLEStore (zustand) và được sync qua useBLEStoreSync.
 */
export const useBLE = () => {
  const { config } = useBLEConfig();
  const connectionState = useBLEStore((state) => state.connectionState);
  const isScanning = useBLEStore((state) => state.isScanning);
  const latestData = useBLEStore((state) => state.latestData);
  const error = useBLEStore((state) => state.error);
  const rssi = useBLEStore((state) => state.rssi);

  // Sync config vào BLEService khi config thay đổi
  useEffect(() => {
    bleService.setConfig(config);
  }, [config]);

  const startScan = useCallback(
    async (durationMs: number = 10000, options?: StartScanOptions) => {
      const { connectionState: currentConnection, isScanning: currentScanning } =
        useBLEStore.getState();

      if (currentConnection?.isConnected && !options?.force) {
        console.log("[useBLE] Skip scan because a device is already connected");
        return;
      }

      if (currentScanning && !options?.force) {
        console.log("[useBLE] Skip scan because scanning is already in progress");
        return;
      }

      await bleService.scanDevices(durationMs);
    },
    []
  );

  const stopScan = useCallback(() => {
    bleService.stopScan();
  }, []);

  const connectToDevice = useCallback(async (deviceId: string) => {
    return bleService.connectToDevice(deviceId);
  }, []);

  const disconnect = useCallback(async () => {
    await bleService.disconnect();
  }, []);

  const monitorCharacteristic = useCallback(
    async (serviceUUID?: string, characteristicUUID?: string) => {
      const service = serviceUUID || config.serviceUUID;
      const characteristic = characteristicUUID || config.rxCharacteristicUUID;
      await bleService.monitorCharacteristic(service, characteristic);
    },
    [config]
  );

  const readCharacteristic = useCallback(
    async (
      serviceUUID?: string,
      characteristicUUID?: string
    ): Promise<string | null> => {
      try {
        const service = serviceUUID || config.serviceUUID;
        const characteristic = characteristicUUID || config.rxCharacteristicUUID;
        return await bleService.readCharacteristic(service, characteristic);
      } catch (err: any) {
        useBLEStore.getState().setError(err.message);
        return null;
      }
    },
    [config]
  );

  const writeCharacteristic = useCallback(
    async (
      data: string,
      serviceUUID?: string,
      characteristicUUID?: string
    ): Promise<boolean> => {
      try {
        const service = serviceUUID || config.serviceUUID;
        const characteristic = characteristicUUID || config.txCharacteristicUUID;
        await bleService.writeCharacteristic(service, characteristic, data);
        return true;
      } catch (err: any) {
        useBLEStore.getState().setError(err.message);
        return false;
      }
    },
    [config]
  );

  return {
    isScanning,
    connectionState,
    latestData,
    error,
    rssi,
    config, // Expose config for convenience
    startScan,
    stopScan,
    connectToDevice,
    disconnect,
    monitorCharacteristic,
    readCharacteristic,
    writeCharacteristic,
  };
};
