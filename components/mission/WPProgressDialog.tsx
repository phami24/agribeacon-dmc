// components/mission/WPProgressDialog.tsx
import React from "react";
import { Modal, View, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from "react-native";
import { MissionTheme, defaultMissionTheme } from "../../types/theme";
import { MissionTranslations, defaultViTranslations } from "../../types/i18n";

interface WPProgressDialogProps {
  visible: boolean;
  wpValue: string;
  theme?: Partial<MissionTheme>;
  customStyles?: {
    modalOverlay?: ViewStyle;
    modalContent?: ViewStyle;
    modalTitle?: TextStyle;
    modalWPText?: TextStyle;
  };
  translations?: Partial<MissionTranslations>;
}

export default function WPProgressDialog({
  visible,
  wpValue,
  theme = defaultMissionTheme,
  customStyles = {},
  translations = {},
}: WPProgressDialogProps) {
  const mergedTheme = { ...defaultMissionTheme, ...theme };
  const mergedStyles = { ...styles, ...customStyles };
  const mergedTranslations = { ...defaultViTranslations, ...translations };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {
        // Không cho phép đóng bằng nút back
      }}
    >
      <View style={mergedStyles.modalOverlay}>
        <View style={[mergedStyles.modalContent, { backgroundColor: mergedTheme.colors.buttonSecondary }]}>
          <Text style={[mergedStyles.modalTitle, { color: mergedTheme.colors.textSecondary }]}>
            {mergedTranslations.sendingMission}
          </Text>
          <Text style={[mergedStyles.modalWPText, { color: mergedTheme.colors.success }]}>
            {mergedTranslations.waypoint}: {wpValue}
          </Text>
          <ActivityIndicator size="large" color={mergedTheme.colors.success} style={{ marginTop: 20 }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    minWidth: 280,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    marginBottom: 12,
  },
  modalWPText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#4CAF50",
    marginTop: 8,
  },
});

