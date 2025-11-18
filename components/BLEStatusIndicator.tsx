// components/BLEStatusIndicator.tsx
import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { BLEConnectionState } from "../module/ble/types";

interface BLEStatusIndicatorProps {
  connectionState: BLEConnectionState | null;
  isScanning: boolean;
  error: string | null;
  deviceName?: string | null;
  sourceScreen?: string; // Màn hình nào đang kết nối
}

export default function BLEStatusIndicator({
  connectionState,
  isScanning,
  error,
  deviceName,
  sourceScreen,
}: BLEStatusIndicatorProps) {
  const isConnected = connectionState?.isConnected ?? false;

  // Xác định trạng thái và màu sắc
  let statusText = "";
  let statusColor = "#666";
  let showSpinner = false;

  if (isConnected) {
    statusText = `Đã kết nối${deviceName ? `: ${deviceName}` : ""}`;
    statusColor = "#2e7d32"; // Xanh lá
  } else if (isScanning) {
    statusText = "Đang tìm thiết bị...";
    statusColor = "#ff9800"; // Cam
    showSpinner = true;
  } else if (connectionState && !connectionState.isConnected && !error) {
    // Đang trong quá trình kết nối (có connectionState nhưng chưa connected)
    statusText = "Đang kết nối...";
    statusColor = "#2196f3"; // Xanh dương
    showSpinner = true;
  } else if (error) {
    statusText = `Lỗi: ${error}`;
    statusColor = "#f44336"; // Đỏ
  } else {
    statusText = "Chưa kết nối";
    statusColor = "#666"; // Xám
  }

  // Thêm thông tin màn hình nguồn nếu có
  if (sourceScreen && (isScanning || showSpinner)) {
    statusText += ` (từ ${sourceScreen})`;
  }

  return (
    <View style={[styles.container, { borderColor: statusColor }]}>
      <View style={styles.content}>
        <View style={[styles.indicator, { backgroundColor: statusColor }]} />
        {showSpinner && (
          <ActivityIndicator
            size="small"
            color={statusColor}
            style={styles.spinner}
          />
        )}
        <Text style={[styles.text, { color: statusColor }]} numberOfLines={1}>
          {statusText}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    minHeight: 36,
    justifyContent: "center",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  indicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  spinner: {
    marginLeft: -4,
  },
  text: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
});

