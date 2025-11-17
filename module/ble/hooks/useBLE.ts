// modules/ble/hooks/useBLE.ts

import { useState, useEffect, useCallback } from "react";
import { bleService } from "../services";
import { eventBus } from "../../event-bus";
import {
  BLEEventType,
  BLEDevice,
  BLECharacteristicData,
  BLEConnectionState,
} from "../types";

/**
 * Custom Hook để sử dụng BLE trong React components
 *
 * Tự động:
 * - Subscribe/Unsubscribe events từ EventBus
 * - Update state khi có sự kiện mới
 * - Cleanup khi component unmount
 *
 * @returns {object} State và methods để tương tác với BLE
 *
 * @example
 * const { devices, startScan, connectToDevice } = useBLE();
 *
 * // Scan devices
 * await startScan(10000);
 *
 * // Connect
 * await connectToDevice('device-id');
 */
export const useBLE = () => {
  // State
  const [devices, setDevices] = useState<BLEDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [connectionState, setConnectionState] =
    useState<BLEConnectionState | null>(null);
  const [latestData, setLatestData] = useState<BLECharacteristicData | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [rssi, setRssi] = useState<number | null>(null);

  // RSSI polling - giảm tần suất để tránh lag (3s thay vì 1s)
  useEffect(() => {
    // Chỉ poll RSSI khi đã connected
    if (!connectionState?.isConnected) {
      setRssi(null);
      return;
    }
    
    const id = setInterval(async () => {
      try {
        const value = await bleService.readRSSI();
        if (value !== null) setRssi(value);
      } catch (error) {
        // Silent fail - RSSI không quan trọng lắm
      }
    }, 3000); // Tăng từ 1s lên 3s để giảm tải
    return () => clearInterval(id);
  }, [connectionState?.isConnected]);

  /**
   * Bắt đầu quét thiết bị
   *
   * @param durationMs - Thời gian quét (ms), default 10s
   */
  const startScan = useCallback(async (durationMs: number = 10000) => {
    console.log("[useBLE] startScan called with duration:", durationMs);
    setDevices([]); // Clear danh sách cũ
    setError(null); // Clear error
    try {
      console.log("[useBLE] Calling bleService.scanDevices...");
      await bleService.scanDevices(durationMs);
      console.log("[useBLE] bleService.scanDevices completed");
    } catch (error: any) {
      console.error("[useBLE] Error in scanDevices:", error);
      setError(error.message || "Scan failed");
      throw error;
    }
  }, []);

  /**
   * Dừng quét
   */
  const stopScan = useCallback(() => {
    bleService.stopScan();
  }, []);

  /**
   * Kết nối đến thiết bị
   *
   * @param deviceId - ID của thiết bị
   * @returns Promise<boolean> - true nếu connect thành công
   */
  const connectToDevice = useCallback(async (deviceId: string) => {
    setError(null);
    const success = await bleService.connectToDevice(deviceId);
    return success;
  }, []);

  /**
   * Ngắt kết nối
   */
  const disconnect = useCallback(async () => {
    await bleService.disconnect();
  }, []);

  /**
   * Bắt đầu monitor một characteristic
   *
   * @param serviceUUID - UUID của service
   * @param characteristicUUID - UUID của characteristic
   */
  const monitorCharacteristic = useCallback(
    async (serviceUUID: string, characteristicUUID: string) => {
      setError(null);
      await bleService.monitorCharacteristic(serviceUUID, characteristicUUID);
    },
    []
  );

  /**
   * Đọc dữ liệu từ characteristic (one-time)
   *
   * @param serviceUUID - UUID của service
   * @param characteristicUUID - UUID của characteristic
   * @returns Promise<string | null> - Dữ liệu đã decode
   */
  const readCharacteristic = useCallback(
    async (
      serviceUUID: string,
      characteristicUUID: string
    ): Promise<string | null> => {
      try {
        setError(null);
        return await bleService.readCharacteristic(
          serviceUUID,
          characteristicUUID
        );
      } catch (err: any) {
        setError(err.message);
        return null;
      }
    },
    []
  );

  /**
   * Ghi dữ liệu vào characteristic
   *
   * @param serviceUUID - UUID của service
   * @param characteristicUUID - UUID của characteristic
   * @param data - Dữ liệu cần ghi (string)
   * @returns Promise<boolean> - true nếu ghi thành công
   */
  const writeCharacteristic = useCallback(
    async (
      serviceUUID: string,
      characteristicUUID: string,
      data: string
    ): Promise<boolean> => {
      try {
        setError(null);
        await bleService.writeCharacteristic(
          serviceUUID,
          characteristicUUID,
          data
        );
        return true;
      } catch (err: any) {
        setError(err.message);
        return false;
      }
    },
    []
  );

  /**
   * Setup Event Listeners
   * Subscribe tất cả events từ EventBus
   * Auto cleanup khi component unmount
   */
  useEffect(() => {
    // 1. Lắng nghe khi phát hiện thiết bị mới
    const unsubscribeDeviceDiscovered = eventBus.on(
      BLEEventType.DEVICE_DISCOVERED,
      (device) => {
        // luôn chỉ có duy nhất 1 device
        setDevices([device]);
        // connectToDevice(device.id);
      }
    );

    // 2. Lắng nghe trạng thái scan
    const unsubscribeScanStarted = eventBus.on(
      BLEEventType.SCAN_STARTED,
      () => {
        setIsScanning(true);
      }
    );

    const unsubscribeScanStopped = eventBus.on(
      BLEEventType.SCAN_STOPPED,
      () => {
        setIsScanning(false);
      }
    );

    // 3. Lắng nghe trạng thái kết nối
    const unsubscribeConnectionState = eventBus.on(
      BLEEventType.CONNECTION_STATE_CHANGED,
      (state) => {
        setConnectionState(state);
      }
    );

    // 4. Lắng nghe dữ liệu nhận được
    const unsubscribeDataReceived = eventBus.on(
      BLEEventType.DATA_RECEIVED,
      (data) => {
        setLatestData(data);
      }
    );

    // 5. Lắng nghe lỗi
    const unsubscribeError = eventBus.on(BLEEventType.ERROR, (errorData) => {
      setError(errorData.error);
    });

    // Cleanup khi component unmount
    // Rất quan trọng để tránh memory leaks!
    return () => {
      unsubscribeDeviceDiscovered();
      unsubscribeScanStarted();
      unsubscribeScanStopped();
      unsubscribeConnectionState();
      unsubscribeDataReceived();
      unsubscribeError();
    };
  }, []); // Empty deps = chỉ chạy 1 lần khi mount

  // Return state và methods
  return {
    // State
    devices, // Danh sách thiết bị đã scan
    isScanning, // Đang scan hay không
    connectionState, // Trạng thái kết nối
    latestData, // Dữ liệu mới nhất
    error, // Error message
    rssi, // RSSI value
    // Methods
    startScan, // Bắt đầu scan
    stopScan, // Dừng scan
    connectToDevice, // Kết nối đến device
    disconnect, // Ngắt kết nối
    monitorCharacteristic, // Monitor data
    readCharacteristic, // Đọc data (one-time)
    writeCharacteristic, // Ghi data

  };
};
