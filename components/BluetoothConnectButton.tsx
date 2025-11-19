// components/BluetoothConnectButton.tsx
import React from "react";
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { BLEConnectionState } from "../module/ble/types";
import { MaterialIcons } from "@expo/vector-icons";

interface BluetoothConnectButtonProps {
  connectionState: BLEConnectionState | null;
  isScanning: boolean;
  onPress?: () => void;
  icons?: {
    connected?: string;
    disconnected?: string;
  };
}

export default function BluetoothConnectButton({
  connectionState,
  isScanning,
  onPress,
  icons = {},
}: BluetoothConnectButtonProps) {
  const isConnected = connectionState?.isConnected ?? false;
  const isConnecting = isScanning || (connectionState ? !connectionState.isConnected : false);

  // Màu sắc và icon dựa trên trạng thái
  const borderColor = isConnected ? "#2e7d32" : "#9e9e9e"; // Xanh lá khi connected, xám khi chưa
  const backgroundColor = isConnected ? "#2e7d32" : "rgba(255, 255, 255, 0.95)"; // Nền xanh khi connected, trắng khi chưa
  const iconColor = isConnected ? "#ffffff" : "#9e9e9e"; // Trắng khi connected, xám khi chưa

  // Default icon names
  const defaultIcons = {
    connected: "bluetooth",
    disconnected: "bluetooth-disabled",
  };
  const mergedIcons = { ...defaultIcons, ...icons };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          borderColor,
          backgroundColor,
        },
      ]}
      onPress={onPress}
      disabled={isConnecting}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        {isConnecting ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <MaterialIcons
            name={isConnected ? mergedIcons.connected : mergedIcons.disconnected}
            size={24}
            color={iconColor}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    borderRadius: 24, // Hình tròn
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    // backgroundColor sẽ được set động
  },
  iconContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
});

