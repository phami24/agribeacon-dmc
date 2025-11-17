// components/StatusIndicator.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface StatusIndicatorProps {
  isReady: boolean;
}

export default function StatusIndicator({ isReady }: StatusIndicatorProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.dot, isReady ? styles.dotReady : styles.dotNotReady]} />
      <Text style={styles.text}>
        {isReady ? "Sẵn sàng bay" : "Chưa sẵn sàng bay"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
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
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  dotReady: {
    backgroundColor: "#4CAF50", // Xanh lá khi sẵn sàng
  },
  dotNotReady: {
    backgroundColor: "#ff4444", // Đỏ khi chưa sẵn sàng
  },
  text: {
    fontSize: 11,
    fontWeight: "600",
    color: "#000",
  },
});

