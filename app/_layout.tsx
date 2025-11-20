// app/_layout.tsx
// DEMO APP - Đây là ví dụ sử dụng library
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppConfigProvider } from '../module/app/context/AppConfigProvider';
import { agriBeaconBLEConfig } from '../constants/exampleBLEConfig';
import { useBLEStoreSync } from '../hooks/useBLEStoreSync';

// DEMO: Example config - Trong thực tế, bạn phải tạo config của riêng mình
const demoAppConfig = {
  ble: agriBeaconBLEConfig,
  mapbox: {
    accessToken: 'sk.eyJ1IjoicGhhbWl6IiwiYSI6ImNtaHlpYjdncjA0aDgyaXF6YWV0Y3RiN2EifQ.LFy_I6P8E4_umZ5ALIW8gQ', // DEMO TOKEN
  },
};

function AppContent() {
  useBLEStoreSync();
  // NOTE: useAutoConnect removed - using AutoConnector in BLEService instead to avoid conflicts

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
      {/* DEMO: Sử dụng AppConfigProvider để wrap tất cả configs */}
      <AppConfigProvider config={demoAppConfig}>
        <AppContent />
      </AppConfigProvider>
    </SafeAreaProvider>
  );
}