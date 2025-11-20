// module/ble/services/AutoConnector.ts
import { bleService } from "./BLEService";

class AutoConnector {
  private reconnecting = false;
  private timer: any = null;
  private lastScanTime: number = 0;
  private scanDebounceMs: number = 3000; // Minimum 3 seconds between scans

  start() {
    if (this.reconnecting) {
      console.log("[AutoConnect] ⏭️ Already reconnecting, skipping");
      return;
    }

    this.reconnecting = true;
    console.log("[AutoConnect] 🔁 Auto reconnect started");

    this.loop();
  }

  stop() {
    this.reconnecting = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log("[AutoConnect] 🟢 Auto reconnect stopped");
  }

  private async loop() {
    if (!this.reconnecting) return;

    const connected = bleService.getConnectedDevice();

    if (connected) {
      console.log("[AutoConnect] ✅ Device connected, stopping reconnect");
      return this.stop();
    }

    const now = Date.now();
    const timeSinceLastScan = now - this.lastScanTime;

    // Debounce scans to prevent too frequent attempts
    if (timeSinceLastScan < this.scanDebounceMs) {
      const waitTime = this.scanDebounceMs - timeSinceLastScan;
      console.log(`[AutoConnect] ⏳ Waiting ${waitTime}ms before next scan...`);
      this.timer = setTimeout(() => this.loop(), waitTime);
      return;
    }

    console.log("[AutoConnect] 🔄 Not connected → force scan");
    this.lastScanTime = now;

    try {
      await bleService.scanDevices(4000);
    } catch (error: any) {
      console.log("[AutoConnect] ⚠️ Scan error:", error.message);
      // Continue loop even if scan fails
    }

    // loop every 5s
    this.timer = setTimeout(() => this.loop(), 5000);
  }
}

export const autoConnector = new AutoConnector();
