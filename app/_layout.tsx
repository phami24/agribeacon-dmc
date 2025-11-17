// app/_layout.tsx
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import MapboxGL from '@rnmapbox/maps';
import { MAPBOX_ACCESS_TOKEN } from '../constants/MapboxConstants';
import { useAutoConnect } from '../module/ble/hooks/useAutoConnect';

// Initialize Mapbox
MapboxGL.setAccessToken(MAPBOX_ACCESS_TOKEN);

export default function RootLayout() {
  // Auto connect/reconnect BLE - chỉ chạy 1 lần cho toàn bộ app
  useAutoConnect();

  return (
    <SafeAreaProvider>
      <StatusBar hidden />
      <Stack
        screenOptions={{
          headerShown: false, // Ẩn header cho tất cả màn hình
          navigationBarHidden: true, // Ẩn navigation bar (Android)
          contentStyle: { backgroundColor: '#000' }, // Background màu đen
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{ 
            headerShown: false,
          }} 
        />
        <Stack.Screen 
          name="mission" 
          options={{ 
            headerShown: false,
          }} 
        />
      </Stack>
    </SafeAreaProvider>
  );
}