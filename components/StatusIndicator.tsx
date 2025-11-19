// components/StatusIndicator.tsx
import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";

interface StatusIndicatorProps {
  isReady: boolean;
  readyText?: string;
  notReadyText?: string;
  readyColor?: string;
  notReadyColor?: string;
  customStyles?: {
    container?: ViewStyle;
    dot?: ViewStyle;
    dotReady?: ViewStyle;
    dotNotReady?: ViewStyle;
    text?: TextStyle;
  };
}

export default function StatusIndicator({
  isReady,
  readyText = "Sẵn sàng bay",
  notReadyText = "Chưa sẵn sàng bay",
  readyColor = "#4CAF50",
  notReadyColor = "#ff4444",
  customStyles = {},
}: StatusIndicatorProps) {
  const mergedStyles = { ...styles, ...customStyles };

  return (
    <View style={mergedStyles.container}>
      <View
        style={[
          mergedStyles.dot,
          isReady
            ? [mergedStyles.dotReady, { backgroundColor: readyColor }]
            : [mergedStyles.dotNotReady, { backgroundColor: notReadyColor }],
        ]}
      />
      <Text style={mergedStyles.text}>
        {isReady ? readyText : notReadyText}
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

