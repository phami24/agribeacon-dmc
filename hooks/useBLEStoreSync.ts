// hooks/useBLEStoreSync.ts
/**
 * Hook để sync EventBus events với BLE Store
 * Tự động update store khi có events từ BLEService
 */

import { useEffect } from 'react';
import { eventBus } from '../module/event-bus';
import { BLEEventType } from '../module/ble/types';
import { useBLEStore } from '../store/bleStore';
import { useDroneDataStore } from '../store/droneDataStore';

export const useBLEStoreSync = () => {
  const {
    addDevice,
    setConnectionState,
    setIsScanning,
    addLog,
    setLatestData,
    addParsedData,
    setRssi,
    setError,
  } = useBLEStore();

  useEffect(() => {
    // Subscribe tất cả events và update store

    // Device discovered
    const unsubscribeAllDeviceDiscovered = eventBus.on(
      BLEEventType.ALL_DEVICE_DISCOVERED,
      (device) => {
        addDevice(device);
      }
    );

    // Scan started
    const unsubscribeScanStarted = eventBus.on(
      BLEEventType.SCAN_STARTED,
      () => {
        setIsScanning(true);
        useBLEStore.getState().clearDevices(); // Clear devices khi bắt đầu scan mới
        addLog(`[${new Date().toLocaleTimeString()}] 🔍 Đang quét thiết bị...`);
      }
    );

    // Scan stopped
    const unsubscribeScanStopped = eventBus.on(
      BLEEventType.SCAN_STOPPED,
      () => {
        setIsScanning(false);
        addLog(`[${new Date().toLocaleTimeString()}] ⏹️ Dừng quét`);
      }
    );

    // Device discovered (target)
    const unsubscribeDeviceDiscovered = eventBus.on(
      BLEEventType.DEVICE_DISCOVERED,
      (device) => {
        addLog(
          `[${new Date().toLocaleTimeString()}] 🎯 Tìm thấy: ${device.name || device.id} (RSSI: ${device.rssi})`
        );
      }
    );

    // Device connected
    const unsubscribeDeviceConnected = eventBus.on(
      BLEEventType.DEVICE_CONNECTED,
      (data) => {
        addLog(
          `[${new Date().toLocaleTimeString()}] ✅ Đã kết nối: ${data.deviceName || data.deviceId}`
        );
      }
    );

    // Connection state changed
    const unsubscribeConnectionStateChanged = eventBus.on(
      BLEEventType.CONNECTION_STATE_CHANGED,
      (state) => {
        setConnectionState(state);
        if (state.isConnected) {
          addLog(
            `[${new Date().toLocaleTimeString()}] 🔗 Kết nối thành công! Device: ${state.deviceId.substring(0, 17)}...${state.mtu ? ` | MTU: ${state.mtu} bytes` : ''}`
          );
        } else {
          addLog(
            `[${new Date().toLocaleTimeString()}] 🔗 Đã ngắt kết nối: ${state.deviceId}${state.error ? ` - ${state.error}` : ''}`
          );
        }
      }
    );

    // Device disconnected
    const unsubscribeDeviceDisconnected = eventBus.on(
      BLEEventType.DEVICE_DISCONNECTED,
      (data) => {
        addLog(
          `[${new Date().toLocaleTimeString()}] ⚠️ Mất kết nối: ${data.deviceId}${data.reason ? ` - ${data.reason}` : ''}`
        );
      }
    );

    // Data received
    const unsubscribeDataReceived = eventBus.on(
      BLEEventType.DATA_RECEIVED,
      (data) => {
        // Chỉ log tóm tắt để tránh lag
        setLatestData(data);
        // Chỉ log vào store, không log console (đã log ở BLEService)
        addLog(
          `[${new Date(data.timestamp).toLocaleTimeString()}] 📨 Data: ${data.value.substring(0, 80)}${data.value.length > 80 ? '...' : ''}`
        );
      }
    );

    // Data parsed (KEY:"value")
    // Lưu giá trị cũ để chỉ log/store khi thay đổi (trừ WP)
    const lastStoreValues = new Map<string, string>();
    const unsubscribeDataParsed = eventBus.on(
      BLEEventType.DATA_PARSED,
      (data) => {
        const lastValue = lastStoreValues.get(data.key);
        
        // WP luôn update, các key khác chỉ update khi giá trị thay đổi
        if (data.key === 'WP' || lastValue !== data.value) {
          addParsedData(data.key, data.value);
          // Chỉ log vào store khi giá trị thay đổi (đã log console ở BLEService)
          addLog(
            `[${new Date(data.timestamp).toLocaleTimeString()}] 🔑 ${data.key}: "${data.value}"`
          );
          lastStoreValues.set(data.key, data.value);
          
          // Update DroneDataStore với các giá trị đã parse
          const { setHomePosition, setBatteryLevel, setStatus, setEKF, setWP } = useDroneDataStore.getState();
          
          switch (data.key) {
          case 'HOME': {
            // Parse HOME: format "lat_e7,lon_e7"
            try {
              const parts = data.value.split(',');
              if (parts.length === 2) {
                const latE7 = parseFloat(parts[0].trim());
                const lonE7 = parseFloat(parts[1].trim());
                const latitude = latE7 / 1e7;
                const longitude = lonE7 / 1e7;
                setHomePosition({ latitude, longitude });
              }
            } catch (error) {
              console.error("[Store Sync] Error parsing HOME:", error);
            }
            break;
          }
          case 'BATTERY': {
            const battery = parseFloat(data.value);
            if (!isNaN(battery) && battery >= 0 && battery <= 100) {
              setBatteryLevel(Math.round(battery));
            }
            break;
          }
          case 'STATUS': {
            const status = parseInt(data.value);
            if (!isNaN(status)) {
              setStatus(status);
            }
            break;
          }
          case 'EKF': {
            const ekf = parseInt(data.value);
            if (!isNaN(ekf)) {
              setEKF(ekf);
            }
            break;
          }
          case 'WP': {
            setWP(data.value);
            break;
          }
          }
        }
      }
    );

    // Error
    const unsubscribeError = eventBus.on(BLEEventType.ERROR, (errorData) => {
      setError(errorData.error);
      addLog(
        `[${new Date().toLocaleTimeString()}] ❌ Lỗi: ${errorData.error}${errorData.context ? ` (${errorData.context})` : ''}`
      );
    });

    // Cleanup
    return () => {
      unsubscribeAllDeviceDiscovered();
      unsubscribeScanStarted();
      unsubscribeScanStopped();
      unsubscribeDeviceDiscovered();
      unsubscribeDeviceConnected();
      unsubscribeConnectionStateChanged();
      unsubscribeDeviceDisconnected();
      unsubscribeDataReceived();
      unsubscribeDataParsed();
      unsubscribeError();
    };
  }, [
    addDevice,
    setConnectionState,
    setIsScanning,
    addLog,
    setLatestData,
    addParsedData,
    setRssi,
    setError,
  ]);
};

