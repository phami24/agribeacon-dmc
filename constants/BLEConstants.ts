// BLEConstants.ts

/**
 * Nordic UART Service UUIDs
 *
 * NUS Service:
 *  6e400001: Service
 *  6e400002: TX (App → Device)
 *  6e400003: RX (Device → App)
 */

// Service (bắt buộc để discover characteristics)
export const NORDIC_UART_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";

// Characteristic để **GỬI** từ App → ESP32 (Write)
export const NORDIC_TX_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

// Characteristic để **NHẬN** từ ESP32 → App (Notify)
export const NORDIC_RX_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

// Device name để filter
export const TARGET_DEVICE_NAME = "AgriBeacon BLE";