// components/mission/DrawToolbar.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle, TextStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MissionTheme, defaultMissionTheme } from "../../types/theme";
import { MissionTranslations } from "../../types/i18n";

interface DrawToolbarProps {
  historyLength: number;
  isDeleteMode: boolean;
  polygonPointsLength: number;
  onUndo: () => void;
  onToggleDeleteMode: () => void;
  onClearAll: () => void;
  theme?: Partial<MissionTheme>;
  customStyles?: {
    drawToolbar?: ViewStyle;
    drawIconButton?: ViewStyle;
    drawIconButtonActive?: ViewStyle;
    drawIconButtonDisabled?: ViewStyle;
    drawIconText?: TextStyle;
  };
  icons?: {
    undo?: string | React.ReactNode;
    delete?: string | React.ReactNode;
    clear?: string | React.ReactNode;
  };
  translations?: Partial<MissionTranslations>;
}

export default function DrawToolbar({
  historyLength,
  isDeleteMode,
  polygonPointsLength,
  onUndo,
  onToggleDeleteMode,
  onClearAll,
  theme = defaultMissionTheme,
  customStyles = {},
  icons = {},
}: DrawToolbarProps) {
  const insets = useSafeAreaInsets();
  const mergedTheme = { ...defaultMissionTheme, ...theme };
  const mergedStyles = { ...styles, ...customStyles };
  
  // Default icons
  const defaultIcons = {
    undo: "↶",
    delete: "🗑️",
    clear: "✕",
  };
  const mergedIcons = { ...defaultIcons, ...icons };

  return (
    <View style={[mergedStyles.drawToolbar, { top: insets.top + 80 }]}>
      <TouchableOpacity
        style={[
          mergedStyles.drawIconButton,
          { backgroundColor: mergedTheme.colors.surface },
          historyLength === 0 && mergedStyles.drawIconButtonDisabled,
        ]}
        onPress={onUndo}
        disabled={historyLength === 0}
      >
        {typeof mergedIcons.undo === "string" ? (
          <Text style={[mergedStyles.drawIconText, { color: mergedTheme.colors.textSecondary }]}>
            {mergedIcons.undo}
          </Text>
        ) : (
          mergedIcons.undo
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          mergedStyles.drawIconButton,
          { backgroundColor: mergedTheme.colors.surface },
          isDeleteMode && [
            mergedStyles.drawIconButtonActive,
            { backgroundColor: mergedTheme.colors.warning },
          ],
        ]}
        onPress={onToggleDeleteMode}
      >
        {typeof mergedIcons.delete === "string" ? (
          <Text style={[mergedStyles.drawIconText, { color: mergedTheme.colors.textSecondary }]}>
            {mergedIcons.delete}
          </Text>
        ) : (
          mergedIcons.delete
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          mergedStyles.drawIconButton,
          { backgroundColor: mergedTheme.colors.surface },
          polygonPointsLength === 0 && mergedStyles.drawIconButtonDisabled,
        ]}
        onPress={onClearAll}
        disabled={polygonPointsLength === 0}
      >
        {typeof mergedIcons.clear === "string" ? (
          <Text style={[mergedStyles.drawIconText, { color: mergedTheme.colors.textSecondary }]}>
            {mergedIcons.clear}
          </Text>
        ) : (
          mergedIcons.clear
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  drawToolbar: {
    position: "absolute",
    left: 12,
    zIndex: 12,
    flexDirection: "column",
    gap: 12,
  },
  drawIconButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  drawIconButtonActive: {
    backgroundColor: "#FFD54F",
  },
  drawIconButtonDisabled: {
    opacity: 0.4,
  },
  drawIconText: {
    fontSize: 18,
    color: "#000",
    fontWeight: "600",
  },
});

