// app/_layout.tsx
// DEMO APP - Đây là ví dụ sử dụng library
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import MapboxGL from '@rnmapbox/maps';
import { MAPBOX_ACCESS_TOKEN } from '../constants/MapboxConstants';
import { BLEConfigProvider } from '../module/ble/context/BLEConfigContext';
import { agriBeaconBLEConfig } from '../constants/exampleBLEConfig';
import { useAutoConnect } from '../module/ble/hooks/useAutoConnect';
import { useBLEStoreSync } from '../hooks/useBLEStoreSync';

// Initialize Mapbox
MapboxGL.setAccessToken(MAPBOX_ACCESS_TOKEN);

function AppContent() {
  useBLEStoreSync();
  useAutoConnect();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        navigationBarHidden: true,
        contentStyle: { backgroundColor: '#000' },
      }}
    />
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar hidden />
      {/* DEMO: Sử dụng example config - Trong thực tế, bạn phải tạo config của riêng mình */}
      <BLEConfigProvider config={agriBeaconBLEConfig}>
        <AppContent />
      </BLEConfigProvider>
    </SafeAreaProvider>
  );
}