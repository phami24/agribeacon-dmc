// app/mission/mission.tsx
// DEMO APP - Đây là ví dụ sử dụng library
import React from "react";
import MissionSelectionScreen from "../../components/mission/MissionSelectionScreen";
import { flightAreas } from "../../data/flightAreas";
import { useBLE } from "../../module/ble/hooks/useBLE";
import { useDroneDataStore } from "../../store/droneDataStore";
import { defaultMissionTheme } from "../../types/theme";
import { defaultViTranslations } from "../../constants/i18n";

export default function MissionScreen() {
  // BLE setup
  const { connectionState, isScanning, startScan } = useBLE();
  
  // Lấy HOME position từ store
  const homePosition = useDroneDataStore((state) => state.homePosition);
  const hasReceivedHome = useDroneDataStore((state) => state.hasReceivedHome);

  return (
    <MissionSelectionScreen
      flightAreas={flightAreas}
      homePosition={homePosition}
      hasReceivedHome={hasReceivedHome}
      connectionState={connectionState}
      isScanning={isScanning}
      theme={defaultMissionTheme}
      translations={defaultViTranslations}
      onBluetoothPress={async () => {
        if (!connectionState?.isConnected) {
          await startScan(5000);
        }
      }}
    />
  );
}
