// components/mission/MissionTopBar.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle, TextStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import StatusIndicator from "../StatusIndicator";
import StatusCard from "../StatusCard";
import { BLEConnectionState } from "../../module/ble/types";
import { MissionTheme, defaultMissionTheme } from "../../types/theme";
import { MissionTranslations, defaultViTranslations } from "../../types/i18n";

interface MissionTopBarProps {
  connectionState: BLEConnectionState | null;
  isScanning: boolean;
  isReady: boolean;
  flightTime: string;
  distance: string;
  batteryLevel: number | null;
  showMissionControls: boolean;
  showCompassOverlay: boolean;
  onBackPress: () => void;
  theme?: Partial<MissionTheme>;
  customStyles?: {
    topBar?: ViewStyle;
    backButton?: ViewStyle;
    backButtonCircle?: ViewStyle;
    backButtonIcon?: TextStyle;
    statusContainer?: ViewStyle;
  };
  icons?: {
    back?: string | React.ReactNode;
    flightTime?: string | React.ReactNode;
    distance?: string | React.ReactNode;
    battery?: string | React.ReactNode;
  };
  translations?: Partial<MissionTranslations>;
}

export default function MissionTopBar({
  connectionState,
  isScanning,
  isReady,
  flightTime,
  distance,
  batteryLevel,
  showMissionControls,
  showCompassOverlay,
  onBackPress,
  theme = defaultMissionTheme,
  customStyles = {},
  icons = {},
  translations = {},
}: MissionTopBarProps) {
  const insets = useSafeAreaInsets();
  const mergedTheme = { ...defaultMissionTheme, ...theme };
  const mergedStyles = { ...styles, ...customStyles };
  
  // Default icons
  const defaultIcons = {
    back: "←",
    flightTime: "🕐",
    distance: "📏",
    battery: "🔋",
  };
  const mergedIcons = { ...defaultIcons, ...icons };
  
  // Default translations
  const mergedTranslations = { ...defaultViTranslations, ...translations };

  const renderIcon = (icon: string | React.ReactNode) => {
    if (typeof icon === "string") {
      return <Text>{icon}</Text>;
    }
    return icon;
  };

  return (
    <View style={[mergedStyles.topBar, { top: insets.top + 10 }]}>
      <TouchableOpacity style={mergedStyles.backButton} onPress={onBackPress}>
        <View style={[mergedStyles.backButtonCircle, { backgroundColor: mergedTheme.colors.buttonSecondary }]}>
          {typeof mergedIcons.back === "string" ? (
            <Text style={[mergedStyles.backButtonIcon, { color: mergedTheme.colors.textSecondary }]}>
              {mergedIcons.back}
            </Text>
          ) : (
            mergedIcons.back
          )}
        </View>
      </TouchableOpacity>

      <View style={mergedStyles.statusContainer}>
        {showMissionControls && !showCompassOverlay && (
          <>
            <StatusIndicator isReady={isReady} readyText={mergedTranslations.ready} notReadyText={mergedTranslations.notReady} />
            <StatusCard icon={mergedIcons.flightTime} label={mergedTranslations.flightTime} value={flightTime} />
            <StatusCard icon={mergedIcons.distance} label={mergedTranslations.distance} value={distance} />
            <StatusCard
              icon={mergedIcons.battery}
              label={mergedTranslations.batteryLevel}
              value={batteryLevel !== null ? `${batteryLevel}%` : "-/-"}
              statusType={batteryLevel !== null && batteryLevel > 20 ? "success" : "warning"}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    marginRight: 8,
  },
  backButtonCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  backButtonIcon: {
    fontSize: 18,
    color: "#000",
    fontWeight: "bold",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    flexWrap: "wrap",
  },
});

