# Luồng hoạt động BLE từ đầu đến cuối

## 📋 Tổng quan

```
App Start → Component Mount → Scan → Connect → Monitor → Parse → EventBus → Store → Component
```

---

## 🔄 Luồng chi tiết

### 1️⃣ **App Khởi Động** (`app/_layout.tsx`)

```
App Start
  ↓
RootLayout render
  ↓
SafeAreaProvider + Stack Navigator
  ↓
User navigate to BLETestingScreen
```

**Log:**
- Không có log ở bước này

---

### 2️⃣ **Component Mount** (`app/ble-testing/ble-testing.tsx`)

```typescript
export default function BLETestingScreen() {
  // Bước 1: Sync EventBus với Store
  useBLEStoreSync();  // ← Hook này subscribe tất cả events
  
  // Bước 2: Lấy state từ Store
  const { devices, connectionState, logs, ... } = useBLEStore();
  
  // Bước 3: Lấy methods từ useBLE hook
  const { startScan, monitorCharacteristic } = useBLE();
  
  // Bước 4: Auto scan khi mount
  useEffect(() => {
    startScan(15000);
  }, []);
}
```

**Log:**
```
[BLE Testing] Auto scan effect - hasInitiatedScan: false, isScanning: false
[BLE Testing] Initiating auto scan...
```

**useBLEStoreSync hook làm gì:**
- Subscribe tất cả events từ EventBus
- Tự động update Store khi có events
- Tự động log vào Store

---

### 3️⃣ **Scan Devices** (`module/ble/services/BLEService.ts`)

```typescript
// Component gọi
startScan(15000);

// → useBLE hook gọi
bleService.scanDevices(15000);

// → BLEService bắt đầu scan
this.manager.startDeviceScan(null, null, (error, device) => {
  if (device) {
    // Emit event
    eventBus.emit(BLEEventType.ALL_DEVICE_DISCOVERED, device);
    eventBus.emit(BLEEventType.DEVICE_DISCOVERED, device); // Nếu là target device
  }
});
```

**Log:**
```
[BLE] 🔍 Starting scan for 15000ms...
[EventBus] Emit: ble:scan:started { timestamp: ... }
[EventBus] Emit: ble:all:device:discovered { id: "...", name: "...", rssi: -75 }
[EventBus] Emit: ble:device:discovered { id: "...", name: "AgriBeacon DRONE", rssi: -75 }
```

**Store được update:**
- `isScanning = true`
- `devices` Map được thêm device mới
- `logs` được thêm: `"🔍 Đang quét thiết bị..."`

---

### 4️⃣ **Connect Device** (`module/ble/services/BLEService.ts`)

```typescript
// Component gọi (tự động khi tìm thấy target device)
connectToDevice(deviceId);

// → BLEService connect
const device = await this.manager.connectToDevice(deviceId);
this.connectedDevice = device;

await device.discoverAllServicesAndCharacteristics();
await device.requestMTU(512);

// Emit events
eventBus.emit(BLEEventType.DEVICE_CONNECTED, { deviceId, deviceName });
eventBus.emit(BLEEventType.CONNECTION_STATE_CHANGED, { 
  deviceId, 
  isConnected: true, 
  mtu: 512 
});
```

**Log:**
```
[BLE] 🔌 Starting connection to device: ...
[BLE] ✅ Device connection established: ...
[BLE] 🔍 Discovering services and characteristics...
[BLE] ✅ Services discovered successfully
[BLE] 📦 MTU requested: 512, actual: 512
[EventBus] Emit: ble:device:connected { deviceId: "...", deviceName: "..." }
[EventBus] Emit: ble:connection:state:changed { deviceId: "...", isConnected: true, mtu: 512 }
```

**Store được update:**
- `connectionState = { deviceId, isConnected: true, mtu: 512 }`
- `logs` được thêm: `"✅ Đã kết nối: ..."` và `"🔗 Kết nối thành công! ..."`

---

### 5️⃣ **Monitor Data** (`module/ble/services/BLEService.ts`)

```typescript
// Component gọi (tự động sau khi connect)
monitorCharacteristic(SERVICE_UUID, CHARACTERISTIC_UUID);

// → BLEService monitor
this.connectedDevice.monitorCharacteristicForService(
  serviceUUID,
  characteristicUUID,
  (error, characteristic) => {
    if (characteristic?.value) {
      const decodedValue = this.decodeBase64(characteristic.value);
      
      // Emit raw data
      eventBus.emit(BLEEventType.DATA_RECEIVED, {
        deviceId,
        value: decodedValue,
        timestamp: Date.now()
      });
      
      // Parse KEY:"value" format
      const parsed = this.parseKeyValue(decodedValue, deviceId);
      if (parsed) {
        eventBus.emit(BLEEventType.DATA_PARSED, parsed);
      }
    }
  }
);
```

**Log:**
```
[BLE] 👀 Start monitoring: 6e400003-b5a3-f393-e0a9-e50e24dcca9e
[BLE] 📨 Data received: HOME:"123.45"
[EventBus] Emit: ble:data:received { deviceId: "...", value: "HOME:\"123.45\"", ... }
[BLE] 🔑 Parsed data: HOME = "123.45"
[EventBus] Emit: ble:data:parsed { key: "HOME", value: "123.45", timestamp: ..., deviceId: "..." }
```

**Store được update:**
- `latestData = { value: "HOME:\"123.45\"", ... }`
- `parsedData` Map: `HOME → { key: "HOME", value: "123.45", timestamp: ... }`
- `logs` được thêm: `"📨 Data: HOME:\"123.45\""` và `"🔑 HOME: \"123.45\""`

---

### 6️⃣ **Component Lắng Nghe Data Theo Key**

#### Cách 1: Dùng `eventBus.onKey()` (Recommended)

```typescript
// Trong component
useEffect(() => {
  // Lắng nghe khi có data với key "HOME"
  const unsubscribe = eventBus.onKey("HOME", (data) => {
    console.log("Home value:", data.value); // "123.45"
    // data = { key: "HOME", value: "123.45", timestamp: ..., deviceId: "..." }
    
    // Có thể update UI, save to database, etc.
    setHomeValue(data.value);
  });
  
  return () => unsubscribe(); // Cleanup
}, []);
```

**Log:**
```
[EventBus] Emit: ble:data:parsed { key: "HOME", value: "123.45", ... }
→ Handler được gọi với data
```

#### Cách 2: Dùng Store

```typescript
// Lấy value từ store
const homeValue = useBLEStore(state => state.getParsedValue("HOME"));

// Hoặc subscribe để tự động update
const homeValue = useBLEStore(state => {
  const parsed = state.parsedData.get("HOME");
  return parsed?.value || null;
});
```

**Log:**
- Không có log, chỉ re-render component khi value thay đổi

#### Cách 3: Lắng nghe tất cả parsed data

```typescript
useEffect(() => {
  const unsubscribe = eventBus.on(
    BLEEventType.DATA_PARSED,
    (data) => {
      if (data.key === "HOME") {
        console.log("Home:", data.value);
      } else if (data.key === "TEMPERATURE") {
        console.log("Temperature:", data.value);
      }
    }
  );
  
  return () => unsubscribe();
}, []);
```

**Log:**
```
[EventBus] Emit: ble:data:parsed { key: "HOME", value: "123.45", ... }
→ Handler được gọi, check key và xử lý
```

---

### 7️⃣ **Ghi Data** (`module/ble/services/BLEService.ts`)

```typescript
// Component gọi
writeCharacteristic(SERVICE_UUID, TX_UUID, "COMMAND:START");

// → BLEService ghi
const base64Data = this.encodeToBase64("COMMAND:START");
await this.connectedDevice.writeCharacteristicWithResponseForService(
  serviceUUID,
  characteristicUUID,
  base64Data
);
```

**Log:**
```
[BLE] ✍️ Writing to characteristic: ...
[BLE] ✅ Write successful
```

**Store:**
- Không có event emit cho write (chỉ log)

---

## 📊 Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    APP START                                 │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              Component Mount (BLETestingScreen)              │
│  - useBLEStoreSync() → Subscribe events                      │
│  - useBLEStore() → Get state                                 │
│  - Auto scan                                                 │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                    SCAN DEVICES                              │
│  BLEService.scanDevices()                                    │
│    ↓                                                          │
│  EventBus.emit(ALL_DEVICE_DISCOVERED)                        │
│    ↓                                                          │
│  useBLEStoreSync → Store.addDevice()                         │
│    ↓                                                          │
│  Store.logs += "🔍 Đang quét..."                             │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                  CONNECT DEVICE                              │
│  BLEService.connectToDevice()                                │
│    ↓                                                          │
│  EventBus.emit(DEVICE_CONNECTED)                             │
│  EventBus.emit(CONNECTION_STATE_CHANGED)                     │
│    ↓                                                          │
│  useBLEStoreSync → Store.setConnectionState()                │
│    ↓                                                          │
│  Store.logs += "✅ Đã kết nối..."                            │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                  MONITOR DATA                                │
│  BLEService.monitorCharacteristic()                          │
│    ↓                                                          │
│  Device gửi data: "HOME:\"123.45\""                          │
│    ↓                                                          │
│  BLEService.decodeBase64() → "HOME:\"123.45\""               │
│    ↓                                                          │
│  EventBus.emit(DATA_RECEIVED)                                │
│    ↓                                                          │
│  BLEService.parseKeyValue() → { key: "HOME", value: "123.45" }│
│    ↓                                                          │
│  EventBus.emit(DATA_PARSED)                                  │
│    ↓                                                          │
│  useBLEStoreSync → Store.addParsedData("HOME", "123.45")     │
│    ↓                                                          │
│  Store.logs += "🔑 HOME: \"123.45\""                          │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│            COMPONENT LẮNG NGHE                               │
│  eventBus.onKey("HOME", callback)                            │
│    ↓                                                          │
│  Callback được gọi khi có DATA_PARSED với key="HOME"         │
│    ↓                                                          │
│  Component update UI                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Ví dụ cụ thể

### Component lắng nghe "HOME" key:

```typescript
export default function HomeScreen() {
  const [homeValue, setHomeValue] = useState<string | null>(null);
  
  useEffect(() => {
    // Cách 1: Dùng eventBus.onKey()
    const unsubscribe = eventBus.onKey("HOME", (data) => {
      console.log("[HomeScreen] Received HOME:", data.value);
      setHomeValue(data.value);
    });
    
    return () => unsubscribe();
  }, []);
  
  return (
    <View>
      <Text>Home Value: {homeValue || "N/A"}</Text>
    </View>
  );
}
```

**Khi device gửi `HOME:"123.45"`:**
```
[BLE] 📨 Data received: HOME:"123.45"
[BLE] 🔑 Parsed data: HOME = "123.45"
[EventBus] Emit: ble:data:parsed { key: "HOME", value: "123.45", ... }
[HomeScreen] Received HOME: 123.45
→ Component re-render với homeValue = "123.45"
```

---

## 📝 Tóm tắt

1. **App Start** → Component mount
2. **Component** → Gọi `useBLEStoreSync()` để subscribe events
3. **Component** → Gọi `startScan()` → BLEService scan devices
4. **BLEService** → Emit events → EventBus
5. **EventBus** → useBLEStoreSync nhận events → Update Store
6. **Store** → Component re-render với state mới
7. **Connect** → Tương tự flow trên
8. **Monitor** → Device gửi data → Parse KEY:"value" → Emit DATA_PARSED
9. **Component** → `eventBus.onKey("HOME", callback)` → Nhận data → Update UI

**Tất cả đều có log tự động vào Store!** 🎉

