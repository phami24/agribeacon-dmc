// module/ble/services/AutoConnector.ts
import { bleService } from "./BLEService";

class AutoConnector {
  private reconnecting = false;
  private timer: any = null;

  start() {
    if (this.reconnecting) return;

    this.reconnecting = true;
    console.log("[AutoConnect] 🔁 Auto reconnect started");

    this.loop();
  }

  stop() {
    this.reconnecting = false;
    if (this.timer) clearTimeout(this.timer);
    console.log("[AutoConnect] 🟢 Auto reconnect stopped");
  }

  private async loop() {
    if (!this.reconnecting) return;

    const connected = bleService.getConnectedDevice();

    if (connected) {
      return this.stop();
    }

    console.log("[AutoConnect] 🔄 Not connected → force scan");

    bleService.scanDevices(4000);

    // loop every 5s
    this.timer = setTimeout(() => this.loop(), 5000);
  }
}

export const autoConnector = new AutoConnector();
