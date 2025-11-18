// modules/ble/services/BLEService.ts

import { BleManager, Device, State } from "react-native-ble-plx";
import { Platform, PermissionsAndroid } from "react-native";
import * as ExpoDevice from "expo-device";
import { eventBus } from "../../event-bus";
import { BLEEventType, BLEDevice, BLECharacteristicData, ParsedData } from "../types";
import base64 from "base64-js";
import { TARGET_DEVICE_NAME } from "../../../constants/BLEConstants";

/**
 * BLEService - Quản lý tất cả tương tác với Bluetooth BLE
 *
 * Pattern: Singleton - Đảm bảo chỉ có 1 BleManager instance
 *
 * Responsibilities:
 * - Quản lý quyền Bluetooth (Permissions)
 * - Quét thiết bị BLE (Scan)
 * - Kết nối/Ngắt kết nối (Connect/Disconnect)
 * - Đọc/Ghi dữ liệu (Read/Write)
 * - Theo dõi dữ liệu real-time (Monitor)
 * - Phát events qua EventBus
 */
class BLEService {
  private manager: BleManager;
  private static instance: BLEService;
  private connectedDevice: Device | null = null;
  private isScanning: boolean = false;
  // Lưu giá trị cũ để chỉ log khi thay đổi (trừ WP)
  private lastParsedValues: Map<string, string> = new Map();

  /**
   * Private constructor - Chỉ khởi tạo từ bên trong
   */
  private constructor() {
    this.manager = new BleManager();
    this.initializeBLE();
  }

  /**
   * Singleton pattern - Lấy instance duy nhất
   */
  public static getInstance(): BLEService {
    if (!BLEService.instance) {
      BLEService.instance = new BLEService();
    }
    return BLEService.instance;
  }

  /**
   * Khởi tạo BLE và lắng nghe trạng thái Bluetooth
   */
  private initializeBLE(): void {
    // Lắng nghe thay đổi trạng thái Bluetooth
    // State có thể là: Unknown, Resetting, Unsupported, Unauthorized, PoweredOff, PoweredOn
    this.manager.onStateChange((state) => {
      console.log("[BLE] Bluetooth state changed:", state);

      if (state === State.PoweredOn) {
        console.log("[BLE] ✅ Bluetooth is ready");
      } else if (state === State.PoweredOff) {
        console.log("[BLE] ❌ Bluetooth is OFF");
        eventBus.emit(BLEEventType.ERROR, {
          error: "Bluetooth is turned off",
          context: "initializeBLE",
        });
      }
    }, true); // true = emit current state ngay lập tức
  }

  /**
   * Request quyền Bluetooth
   * Android 12+ (API 31+) cần nhiều permissions hơn
   *
   * Android < 12: ACCESS_FINE_LOCATION
   * Android >= 12: BLUETOOTH_SCAN, BLUETOOTH_CONNECT, ACCESS_FINE_LOCATION
   * iOS: Tự động request qua Info.plist
   */
  public async requestPermissions(): Promise<boolean> {
    if (Platform.OS === "android") {
      const apiLevel = ExpoDevice.platformApiLevel ?? -1;
      console.log("[BLE] Android API Level:", apiLevel);

      // Android < 12 (API < 31)
      if (apiLevel < 31) {
        console.log("[BLE] Requesting ACCESS_FINE_LOCATION permission...");
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: "Location Permission",
            message: "Bluetooth Low Energy requires Location permission",
            buttonPositive: "OK",
          }
        );
        const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
        console.log("[BLE] ACCESS_FINE_LOCATION permission:", isGranted ? "GRANTED" : "DENIED");
        return isGranted;
      }
      // Android >= 12 (API >= 31)
      else {
        console.log("[BLE] Requesting Android 12+ permissions (BLUETOOTH_SCAN, BLUETOOTH_CONNECT, ACCESS_FINE_LOCATION)...");
        const result = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        const scanGranted = result["android.permission.BLUETOOTH_SCAN"] === PermissionsAndroid.RESULTS.GRANTED;
        const connectGranted = result["android.permission.BLUETOOTH_CONNECT"] === PermissionsAndroid.RESULTS.GRANTED;
        const locationGranted = result["android.permission.ACCESS_FINE_LOCATION"] === PermissionsAndroid.RESULTS.GRANTED;

        console.log("[BLE] BLUETOOTH_SCAN:", scanGranted ? "GRANTED" : "DENIED");
        console.log("[BLE] BLUETOOTH_CONNECT:", connectGranted ? "GRANTED" : "DENIED");
        console.log("[BLE] ACCESS_FINE_LOCATION:", locationGranted ? "GRANTED" : "DENIED");

        const allGranted = scanGranted && connectGranted && locationGranted;
        if (!allGranted) {
          console.error("[BLE] ❌ Not all permissions granted!");
        }
        return allGranted;
      }
    }

    // iOS không cần request runtime permissions
    // Chỉ cần khai báo trong Info.plist
    console.log("[BLE] iOS platform - permissions handled via Info.plist");
    return true;
  }

  /**
   * Quét tìm thiết bị BLE
   *
   * @param durationMs - Thời gian quét (milliseconds), mặc định 10s
   * @param serviceUUIDs - Lọc theo service UUIDs (optional)
   *
   * Events được phát ra:
   * - SCAN_STARTED: Khi bắt đầu scan
   * - DEVICE_DISCOVERED: Mỗi khi phát hiện thiết bị mới
   * - SCAN_STOPPED: Khi dừng scan
   * - ERROR: Nếu có lỗi
   */
  public async scanDevices(
    durationMs: number = 10000,
    serviceUUIDs?: string[]
  ): Promise<void> {
    // Đang scan rồi thì không scan nữa
    if (this.isScanning) {
      console.log("[BLE] Already scanning");
      return;
    }

    // Kiểm tra Bluetooth state trước
    const state = await this.manager.state();
    console.log("[BLE] Current Bluetooth state:", state);
    
    if (state !== State.PoweredOn) {
      const errorMsg = `Bluetooth is not ready. Current state: ${state}`;
      console.error("[BLE] ❌", errorMsg);
      eventBus.emit(BLEEventType.ERROR, {
        error: errorMsg,
        context: "scanDevices",
      });
      return;
    }

    // Kiểm tra permissions
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      const errorMsg = "Bluetooth permissions not granted";
      console.error("[BLE] ❌", errorMsg);
      eventBus.emit(BLEEventType.ERROR, {
        error: errorMsg,
        context: "scanDevices",
      });
      return;
    }

    console.log("[BLE] ✅ Permissions granted, starting scan...");
    this.isScanning = true;
    eventBus.emit(BLEEventType.SCAN_STARTED, { timestamp: Date.now() });

    console.log("[BLE] 🔍 Start scanning for", durationMs, "ms...");
    console.log("[BLE] Service UUIDs filter:", serviceUUIDs || "None (scan all)");

    let deviceCount = 0;

    // Bắt đầu scan
    this.manager.startDeviceScan(
      serviceUUIDs || null, // Lọc theo UUIDs hoặc null = scan tất cả
      { allowDuplicates: false }, // Không cho phép duplicate devices
      (error, device) => {
        if (error) {
          const errorMessage = error.message || "Unknown scan error";
          const isBenignScanError =
            errorMessage.includes("Cannot start scanning operation") ||
            errorMessage.includes("already scanning");

          if (isBenignScanError) {
            console.log("[BLE] ⚠️ Scan request ignored (already scanning).");
          } else {
            console.error("[BLE] ❌ Scan error:", errorMessage);
            eventBus.emit(BLEEventType.ERROR, {
              error: errorMessage,
              context: "scanDevices",
            });
          }

          this.stopScan();
          return;
        }

        // Emit TẤT CẢ thiết bị đã scan được
        if (device) {
          deviceCount++;
          const bleDevice: BLEDevice = {
            id: device.id,
            name: device.name || null,
            rssi: device.rssi,
            serviceUUIDs: device.serviceUUIDs || [],
          };

          // CHỈ LOG target device hoặc devices có tên (không log "Unknown" để tránh spam)
          if (device.name === TARGET_DEVICE_NAME || (device.name && device.name !== "Unknown")) {
            console.log(
              `[BLE] 📱 Device #${deviceCount} found:`,
              bleDevice.name,
              `(${bleDevice.id})`,
              `RSSI: ${bleDevice.rssi}`
            );
          }

          // Emit tất cả thiết bị để hiển thị trong danh sách
          eventBus.emit(BLEEventType.ALL_DEVICE_DISCOVERED, bleDevice);

          // Nếu là thiết bị target → auto connect
          if (device.name === TARGET_DEVICE_NAME) {
            console.log("[BLE] 🎯 TARGET FOUND:", bleDevice.name);
            eventBus.emit(BLEEventType.DEVICE_DISCOVERED, bleDevice);

            // AUTO CONNECT HERE
            if (!this.connectedDevice) {
              this.connectToDevice(device.id);
            }

            // optional: stop scan once found
            this.stopScan();
          }
        }
      }
    );

    // Auto stop sau duration
    setTimeout(() => {
      console.log(`[BLE] ⏹️ Scan completed after ${durationMs}ms. Found ${deviceCount} devices total.`);
      this.stopScan();
    }, durationMs);
  }

  /**
   * Dừng quét
   */
  public stopScan(): void {
    if (!this.isScanning) return;

    this.manager.stopDeviceScan();
    this.isScanning = false;
    eventBus.emit(BLEEventType.SCAN_STOPPED, { timestamp: Date.now() });
    console.log("[BLE] ⏹️ Scan stopped");
  }

  /**
   * Kết nối đến thiết bị
   *
   * @param deviceId - ID của thiết bị cần kết nối
   * @returns Promise<boolean> - true nếu kết nối thành công
   *
   * Events:
   * - DEVICE_CONNECTED: Khi kết nối thành công
   * - CONNECTION_STATE_CHANGED: Khi trạng thái thay đổi
   * - DEVICE_DISCONNECTED: Khi mất kết nối
   * - ERROR: Nếu có lỗi
   */
  public async connectToDevice(deviceId: string): Promise<boolean> {
    try {
      console.log("[BLE] 🔌 Starting connection to device:", deviceId);
      console.log("[BLE] ⏱️ Connection timeout: 10 seconds");

      // Connect với timeout 10s
      const device = await this.manager.connectToDevice(deviceId, {
        timeout: 10000,
      });

      console.log("[BLE] ✅ Device connection established:", device.id);
      console.log("[BLE] 📱 Device name:", device.name || "Unknown");
      this.connectedDevice = device;

      // Discover tất cả services và characteristics
      // Bắt buộc phải gọi trước khi đọc/ghi/monitor
      console.log("[BLE] 🔍 Discovering services and characteristics...");
      await device.discoverAllServicesAndCharacteristics();
      console.log("[BLE] ✅ Services discovered successfully");
      
      // Lấy danh sách services sau khi discover
      const services = await device.services();
      console.log("[BLE] 📋 Total services discovered:", services.length);
      
      // Log tất cả services và characteristics
      for (const service of services) {
        console.log(`[BLE] 📦 Service: ${service.uuid}`);
        const characteristics = await service.characteristics();
        console.log(`[BLE]   └─ Characteristics (${characteristics.length}):`);
        for (const char of characteristics) {
          console.log(`[BLE]      • ${char.uuid} (notify: ${char.isNotifiable}, indicate: ${char.isIndicatable}, read: ${char.isReadable}, write: ${char.isWritableWithResponse})`);
        }
      }
      
      console.log("[BLE] 📋 Service UUIDs from device:", device.serviceUUIDs?.join(", ") || "None");

      // Request MTU để tăng kích thước gói dữ liệu (tối đa 512 bytes)
      let actualMtu: number | undefined;
      try {
        const requestedMtu = 512;
        console.log(`[BLE] 📦 Requesting MTU: ${requestedMtu} bytes...`);
        const updatedDevice = await device.requestMTU(requestedMtu);
        // MTU được trả về trong device object, nhưng cần đọc từ mtu property
        actualMtu = updatedDevice.mtu || requestedMtu;
        console.log(`[BLE] ✅ MTU negotiation successful: requested ${requestedMtu}, actual ${actualMtu}`);
      } catch (mtuError: any) {
        console.warn("[BLE] ⚠️ MTU request failed (some devices don't support):", mtuError.message);
        // Không throw error vì một số thiết bị không hỗ trợ MTU negotiation
      }

      // Lắng nghe sự kiện ngắt kết nối
      console.log("[BLE] 👂 Setting up disconnect listener...");
      device.onDisconnected((error, disconnectedDevice) => {
        const disconnectTime = new Date().toLocaleTimeString();
        console.log(`[BLE] 🔌 [${disconnectTime}] Device disconnected`);
        console.log("[BLE] 📱 Disconnected device ID:", disconnectedDevice?.id || "Unknown");
        console.log("[BLE] 📱 Disconnected device name:", disconnectedDevice?.name || "Unknown");
        if (error) {
          console.log("[BLE] ⚠️ Disconnect reason:", error.message);
        }
        
        this.connectedDevice = null;

        // Emit events
        eventBus.emit(BLEEventType.DEVICE_DISCONNECTED, {
          deviceId: disconnectedDevice?.id || "",
          reason: error?.message,
        });

        eventBus.emit(BLEEventType.CONNECTION_STATE_CHANGED, {
          deviceId: disconnectedDevice?.id || "",
          isConnected: false,
        });

        // ====== AUTO RECONNECT START ======
        console.log("[BLE] 🔄 Device disconnected → starting auto reconnect");

        // gọi lớp quản lý reconnect
        import("./AutoConnector").then(({ autoConnector }) => {
          autoConnector.start();
        });
      });

      // Emit connected events
      const connectTime = new Date().toLocaleTimeString();
      console.log(`[BLE] 📢 [${connectTime}] Emitting DEVICE_CONNECTED event`);
      eventBus.emit(BLEEventType.DEVICE_CONNECTED, {
        deviceId: device.id,
        deviceName: device.name,
      });

      console.log(`[BLE] 📢 [${connectTime}] Emitting CONNECTION_STATE_CHANGED event (connected: true)`);
      eventBus.emit(BLEEventType.CONNECTION_STATE_CHANGED, {
        deviceId: device.id,
        isConnected: true,
        mtu: actualMtu,
      });

      console.log("[BLE] ✅ Connection process completed successfully");
      console.log("[BLE] 📊 Connection summary:");
      console.log("  - Device ID:", device.id);
      console.log("  - Device Name:", device.name || "Unknown");
      console.log("  - MTU:", actualMtu || "Not set");
      console.log("  - Services:", device.serviceUUIDs?.length || 0);
      
      return true;
    } catch (error: any) {
      const errorTime = new Date().toLocaleTimeString();
      console.error(`[BLE] ❌ [${errorTime}] Connection failed`);
      console.error("[BLE] ❌ Error details:", error.message);
      console.error("[BLE] ❌ Error stack:", error.stack);
      
      eventBus.emit(BLEEventType.ERROR, {
        error: error.message,
        context: "connectToDevice",
      });
      
      return false;
    }
  }

  /**
   * Ngắt kết nối thiết bị hiện tại
   */
  public async disconnect(): Promise<void> {
    if (!this.connectedDevice) {
      console.log("[BLE] ⚠️ No device connected to disconnect");
      return;
    }

    const deviceId = this.connectedDevice.id;
    const deviceName = this.connectedDevice.name;
    const disconnectTime = new Date().toLocaleTimeString();
    
    console.log(`[BLE] 🔌 [${disconnectTime}] Manual disconnect initiated`);
    console.log("[BLE] 📱 Disconnecting device:", deviceId);
    console.log("[BLE] 📱 Device name:", deviceName || "Unknown");

    try {
      await this.manager.cancelDeviceConnection(deviceId);
      this.connectedDevice = null;
      console.log(`[BLE] ✅ [${disconnectTime}] Device disconnected manually`);
      console.log("[BLE] 📱 Disconnected device ID:", deviceId);
      
      // Emit events
      eventBus.emit(BLEEventType.DEVICE_DISCONNECTED, {
        deviceId: deviceId,
        reason: "Manual disconnect",
      });

      eventBus.emit(BLEEventType.CONNECTION_STATE_CHANGED, {
        deviceId: deviceId,
        isConnected: false,
      });
    } catch (error: any) {
      console.error(`[BLE] ❌ [${disconnectTime}] Disconnect error`);
      console.error("[BLE] ❌ Error details:", error.message);
      console.error("[BLE] ❌ Error stack:", error.stack);
      
      eventBus.emit(BLEEventType.ERROR, {
        error: error.message,
        context: "disconnect",
      });
    }
  }

  /**
   * Theo dõi (monitor) dữ liệu từ một characteristic
   * Tự động emit event DATA_RECEIVED khi có dữ liệu mới
   *
   * @param serviceUUID - UUID của service
   * @param characteristicUUID - UUID của characteristic
   *
   * Characteristic phải có property: NOTIFY hoặc INDICATE
   */
  public async monitorCharacteristic(
    serviceUUID: string,
    characteristicUUID: string
  ): Promise<void> {
    if (!this.connectedDevice) {
      eventBus.emit(BLEEventType.ERROR, {
        error: "No device connected",
        context: "monitorCharacteristic",
      });
      return;
    }

    try {
      console.log("[BLE] 👀 Start monitoring:", characteristicUUID);

      // Kiểm tra và enable notification descriptor trước khi monitor
      try {
        // Lấy characteristic để kiểm tra properties
        const characteristic = await this.connectedDevice.readCharacteristicForService(
          serviceUUID,
          characteristicUUID
        );
        
        console.log("[BLE] 📋 Characteristic UUID:", characteristic.uuid);
        console.log("[BLE] 📋 Characteristic isNotifiable:", characteristic.isNotifiable);
        console.log("[BLE] 📋 Characteristic isIndicatable:", characteristic.isIndicatable);

        // Enable notification nếu characteristic hỗ trợ
        if (characteristic.isNotifiable || characteristic.isIndicatable) {
          console.log("[BLE] 🔔 Enabling notification for characteristic...");
          console.log("[BLE] 📋 Characteristic properties:", {
            isNotifiable: characteristic.isNotifiable,
            isIndicatable: characteristic.isIndicatable,
            isReadable: characteristic.isReadable,
            isWritableWithoutResponse: characteristic.isWritableWithoutResponse,
            isWritableWithResponse: characteristic.isWritableWithResponse,
          });
          
          // Enable CCCD (Client Characteristic Configuration Descriptor) manually
          // react-native-ble-plx tự động enable notification khi monitor
          // Nhưng một số thiết bị cần enable descriptor thủ công
          try {
            // CCCD UUID: 0x2902
            const cccdUUID = "00002902-0000-1000-8000-00805f9b34fb";
            
            // Đọc descriptors của characteristic
            console.log("[BLE] 🔍 Reading descriptors for characteristic...");
            const descriptors = await characteristic.descriptors();
            console.log("[BLE] 📋 Found", descriptors.length, "descriptors");
            
            // Tìm CCCD descriptor
            const cccdDescriptor = descriptors.find(
              (desc) => desc.uuid.toLowerCase() === cccdUUID.toLowerCase()
            );
            
            if (cccdDescriptor) {
              console.log("[BLE] ✅ Found CCCD descriptor:", cccdDescriptor.uuid);
              
              // 0x0100 = Enable notification, 0x0200 = Enable indication
              const enableValue = characteristic.isIndicatable 
                ? base64.fromByteArray(new Uint8Array([0x02, 0x00])) // Enable indication
                : base64.fromByteArray(new Uint8Array([0x01, 0x00])); // Enable notification
              
              console.log("[BLE] ✍️ Writing to CCCD descriptor...");
              console.log("[BLE] 📝 Enable value:", characteristic.isIndicatable ? "0x0200 (indication)" : "0x0100 (notification)");
              
              await cccdDescriptor.write(enableValue);
              console.log("[BLE] ✅ CCCD descriptor enabled successfully!");
            } else {
              console.log("[BLE] ⚠️ CCCD descriptor not found in characteristic descriptors");
              console.log("[BLE] 📋 Available descriptors:", descriptors.map(d => d.uuid).join(", "));
              console.log("[BLE] ⚠️ Will rely on auto-enable when monitor starts");
            }
          } catch (descError: any) {
            // Một số thiết bị tự động enable, không cần write descriptor
            // react-native-ble-plx sẽ tự động enable khi monitor
            console.log("[BLE] ⚠️ Could not enable CCCD descriptor manually:", descError.message);
            console.log("[BLE] ⚠️ Error details:", JSON.stringify(descError, null, 2));
            console.log("[BLE] ⚠️ Will rely on auto-enable when monitor starts");
          }
        } else {
          console.warn("[BLE] ⚠️ Characteristic does not support NOTIFY or INDICATE");
          eventBus.emit(BLEEventType.ERROR, {
            error: "Characteristic does not support notifications",
            context: "monitorCharacteristic",
          });
          return;
        }
      } catch (readError: any) {
        console.warn("[BLE] ⚠️ Could not read characteristic (will try monitor anyway):", readError.message);
      }

      // Bắt đầu monitor
      console.log("[BLE] 🎧 Starting monitor subscription...");
      this.connectedDevice.monitorCharacteristicForService(
        serviceUUID,
        characteristicUUID,
        (error, characteristic) => {
          if (error) {
            console.error("[BLE] ❌ Monitor error:", error);
            eventBus.emit(BLEEventType.ERROR, {
              error: error.message,
              context: "monitorCharacteristic",
            });
            return;
          }

          if (characteristic?.value) {
            const timestamp = Date.now();
            const decodedValue = this.decodeBase64(characteristic.value);

            const data: BLECharacteristicData = {
              deviceId: this.connectedDevice!.id,
              characteristicUUID: characteristic.uuid,
              serviceUUID: serviceUUID,
              value: decodedValue,
              timestamp: timestamp,
            };

            // Bỏ qua data rỗng hoặc chỉ có whitespace
            const trimmedValue = decodedValue.trim();
            if (!trimmedValue) {
              return; // Không log data rỗng
            }

            eventBus.emit(BLEEventType.DATA_RECEIVED, data);

            // Parse KEY:"value" format và emit DATA_PARSED event
            const parsed = this.parseKeyValue(decodedValue, this.connectedDevice!.id);
            if (parsed) {
              const lastValue = this.lastParsedValues.get(parsed.key);
              
              // WP luôn log mỗi lần, các key khác chỉ log khi giá trị thay đổi
              if (parsed.key === 'WP' || lastValue !== parsed.value) {
                console.log(`[BLE] 🔑 ${parsed.key}: "${parsed.value}"`);
                this.lastParsedValues.set(parsed.key, parsed.value);
              }
              
              eventBus.emit(BLEEventType.DATA_PARSED, parsed);
            } else {
              // Chỉ log raw data nếu không parse được và không rỗng
              console.log(`[BLE] 📨 Data: ${trimmedValue.substring(0, 50)}${trimmedValue.length > 50 ? '...' : ''}`);
            }
          } else {
            console.log("[BLE] 📭 Characteristic update received but no value");
          }
        }
      );
      console.log("[BLE] ✅ Monitor subscription started successfully");
    } catch (error: any) {
      console.error("[BLE] ❌ Monitor setup error:", error);
      eventBus.emit(BLEEventType.ERROR, {
        error: error.message,
        context: "monitorCharacteristic",
      });
    }
  }

  /**
   * Đọc dữ liệu từ characteristic (one-time read)
   *
   * @param serviceUUID - UUID của service
   * @param characteristicUUID - UUID của characteristic
   * @returns Promise<string | null> - Dữ liệu đã decode
   */
  public async readCharacteristic(
    serviceUUID: string,
    characteristicUUID: string
  ): Promise<string | null> {
    if (!this.connectedDevice) {
      throw new Error("No device connected");
    }

    try {
      const characteristic =
        await this.connectedDevice.readCharacteristicForService(
          serviceUUID,
          characteristicUUID
        );

      if (characteristic.value) {
        return this.decodeBase64(characteristic.value);
      }
      return null;
    } catch (error: any) {
      console.error("[BLE] ❌ Read error:", error);
      throw error;
    }
  }

  /**
   * Ghi dữ liệu vào characteristic
   *
   * @param serviceUUID - UUID của service
   * @param characteristicUUID - UUID của characteristic
   * @param data - Dữ liệu cần ghi (string)
   */
  public async writeCharacteristic(
    serviceUUID: string,
    characteristicUUID: string,
    data: string
  ): Promise<void> {
    if (!this.connectedDevice) {
      throw new Error("No device connected");
    }

    try {
      const base64Data = this.encodeToBase64(data);
      await this.connectedDevice.writeCharacteristicWithResponseForService(
        serviceUUID,
        characteristicUUID,
        base64Data
      );
      console.log("[BLE] ✅ Write successful:", data);
    } catch (error: any) {
      console.error("[BLE] ❌ Write error:", error);
      throw error;
    }
  }

  /**
   * Lấy thông tin thiết bị đang kết nối
   */
  public getConnectedDevice(): Device | null {
    return this.connectedDevice;
  }

  /**
   * Parse data từ format KEY:"value"
   * Hỗ trợ các format:
   * - KEY:"value"
   * - KEY: "value"
   * - KEY:"value"\nKEY2:"value2" (multiple lines)
   * 
   * @param data - Raw data string
   * @param deviceId - Device ID
   * @returns ParsedData nếu parse thành công, null nếu không match format
   */
  private parseKeyValue(data: string, deviceId: string): ParsedData | null {
    // Pattern: KEY:"value" hoặc KEY: "value" hoặc KEY:value (không có quotes)
    // Match: KEY (word characters) : value (any characters except newline, có thể có hoặc không có quotes)
    const patternWithQuotes = /^([A-Z_][A-Z0-9_]*)\s*:\s*"([^"]*)"$/;
    const patternWithoutQuotes = /^([A-Z_][A-Z0-9_]*)\s*:\s*(.+)$/;
    
    // Trim và split by newline để xử lý multiple key-value pairs
    const lines = data.trim().split(/\r?\n/);
    
    // Parse từng dòng, lấy dòng đầu tiên match
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Thử pattern có quotes trước
      let match = trimmed.match(patternWithQuotes);
      if (match) {
        return {
          key: match[1],
          value: match[2],
          timestamp: Date.now(),
          deviceId,
        };
      }
      
      // Nếu không match, thử pattern không có quotes
      match = trimmed.match(patternWithoutQuotes);
      if (match) {
        return {
          key: match[1],
          value: match[2].trim(),
          timestamp: Date.now(),
          deviceId,
        };
      }
    }
    
    return null; // Không match format
  }

  /**
   * Decode Base64 string → UTF-8 string
   * BLE data luôn được encode Base64
   */
  private decodeBase64(base64String: string): string {
    try {
      const bytes = base64.toByteArray(base64String);
      return String.fromCharCode.apply(null, Array.from(bytes));
    } catch (error) {
      console.error("[BLE] ❌ Decode error:", error);
      return base64String; // Return original nếu decode fail
    }
  }

  /**
   * Encode UTF-8 string → Base64 string
   */
  private encodeToBase64(data: string): string {
    const bytes = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      bytes[i] = data.charCodeAt(i);
    }
    return base64.fromByteArray(bytes);
  }

  /**
   * Cleanup - Hủy tất cả kết nối và dừng scan
   * Gọi khi app bị destroy
   */
  public async destroy(): Promise<void> {
    this.stopScan();
    await this.disconnect();
    this.manager.destroy();
    console.log("[BLE] 🗑️ Service destroyed");
  }

  public async readRSSI(): Promise<number | null> {
    if (!this.connectedDevice) return null;
    try {
      const updated = await this.connectedDevice.readRSSI();
      return updated.rssi ?? null;
    } catch {
      return null;
    }
  }
}

// Export singleton instance
export const bleService = BLEService.getInstance();
