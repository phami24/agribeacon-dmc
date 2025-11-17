// components/StatusCard.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface StatusCardProps {
  icon: React.ReactNode | string; // Có thể là emoji string hoặc React component
  label: string;
  value: string;
  iconColor?: string; // Màu cho icon (nếu là component)
  statusType?: "default" | "warning" | "error" | "success"; // Loại status để style khác nhau
}

export default function StatusCard({
  icon,
  label,
  value,
  iconColor,
  statusType = "default",
}: StatusCardProps) {
  // Xác định màu dựa trên statusType
  const getStatusColor = () => {
    switch (statusType) {
      case "error":
        return "#ff4444"; // Đỏ
      case "warning":
        return "#ffaa00"; // Vàng
      case "success":
        return "#4CAF50"; // Xanh lá
      default:
        return "#666"; // Xám
    }
  };

  const statusColor = iconColor || getStatusColor();

  // Render icon
  const renderIcon = () => {
    if (typeof icon === "string") {
      // Nếu là emoji hoặc string
      if (statusType === "error") {
        // Nếu là error, hiển thị dot đỏ
        return (
          <View style={[styles.iconContainer, { backgroundColor: statusColor }]}>
            <View style={styles.dot} />
          </View>
        );
      }
      return <Text style={styles.iconText}>{icon}</Text>;
    }
    // Nếu là React component
    return <View style={styles.iconContainer}>{icon}</View>;
  };

  return (
    <View style={styles.container}>
      {renderIcon()}
      <View style={styles.textContainer}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
  },
  iconText: {
    fontSize: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  textContainer: {
    flexDirection: "column",
  },
  label: {
    fontSize: 9,
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: 1,
  },
  value: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
});

