// components/mission/MissionSidebar.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Switch, ScrollView, ActivityIndicator, ViewStyle, TextStyle } from "react-native";
import HorizontalSidebar from "../HorizontalSidebar";
import { ALTITUDE_MIN, ALTITUDE_MAX, ALTITUDE_STEP } from "../../hooks/useFlightParameters";
import { MissionTheme, defaultMissionTheme } from "../../types/theme";
import { MissionTranslations, defaultViTranslations } from "../../types/i18n";

interface MissionSidebarProps {
  isExpanded: boolean;
  sidebarWidth: number;
  flightDirection: number;
  altitude: number;
  altitudeText: string;
  previewFlightDirection: boolean;
  isUploading: boolean;
  isUploaded: boolean;
  isReady: boolean;
  polygonCenter: { longitude: number; latitude: number } | null;
  getCompassZoomLevel: () => number;
  canDecreaseAltitude: boolean;
  canIncreaseAltitude: boolean;
  onAltitudeAdjust: (delta: number) => void;
  onAltitudeTextChange: (text: string) => void;
  onAltitudeBlur: () => void;
  onPreviewToggle: (value: boolean) => void;
  onCompassPress: () => void;
  onSendToDrone: () => void;
  onStartFlying: () => void;
  onExpandedChange: (expanded: boolean) => void;
  onWidthChange: (width: number) => void;
  cameraRef: React.RefObject<any>;
  theme?: Partial<MissionTheme>;
  customStyles?: Partial<MissionTheme['styles']>;
  icons?: {
    compass?: string | React.ReactNode;
    send?: string | React.ReactNode;
    sendLoading?: string | React.ReactNode;
    sendCollapsed?: string | React.ReactNode;
    start?: string | React.ReactNode;
  };
  translations?: Partial<MissionTranslations>;
}

export default function MissionSidebar({
  isExpanded,
  sidebarWidth,
  flightDirection,
  altitude,
  altitudeText,
  previewFlightDirection,
  isUploading,
  isUploaded,
  isReady,
  polygonCenter,
  getCompassZoomLevel,
  canDecreaseAltitude,
  canIncreaseAltitude,
  onAltitudeAdjust,
  onAltitudeTextChange,
  onAltitudeBlur,
  onPreviewToggle,
  onCompassPress,
  onSendToDrone,
  onStartFlying,
  onExpandedChange,
  onWidthChange,
  cameraRef,
  theme = defaultMissionTheme,
  customStyles = {},
  icons = {},
  translations = {},
}: MissionSidebarProps) {
  const mergedTheme = { ...defaultMissionTheme, ...theme };
  const mergedStyles = { ...styles, ...customStyles };
  
  // Default icons
  const defaultIcons = {
    compass: "🧭",
    send: "☁️",
    sendLoading: "⏳",
    sendCollapsed: "☁️↑",
    start: "▶",
  };
  const mergedIcons = { ...defaultIcons, ...icons };
  
  // Default translations
  const mergedTranslations = { ...defaultViTranslations, ...translations };

  return (
    <HorizontalSidebar
      collapsedWidth={60}
      expandedWidth={sidebarWidth}
      minWidth={sidebarWidth}
      backgroundColor={mergedTheme.colors.surface}
      initialWidth={sidebarWidth}
      onExpandedChange={onExpandedChange}
      onWidthChange={onWidthChange}
    >
      <ScrollView
        style={styles.sidebarScroll}
        contentContainerStyle={styles.sidebarContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Flight Direction */}
        {isExpanded && (
          <View style={[styles.parameterSection, styles.directionSection]}>
              <View style={mergedStyles.labelRow}>
                <View style={styles.directionLabelGroup}>
                  <Text style={[mergedStyles.parameterLabel, styles.directionLabel, { color: mergedTheme.colors.text }]}>
                    {mergedTranslations.flightDirection}
                  </Text>
                  <View style={[styles.directionValueInline, { backgroundColor: mergedTheme.colors.surface }]}>
                    <Text style={[mergedStyles.directionValue, { color: mergedTheme.colors.text }]}>
                      {flightDirection}
                    </Text>
                    <Text style={[mergedStyles.directionUnit, { color: mergedTheme.colors.textSecondary }]}>
                      {mergedTranslations.unit}
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={[
                  mergedStyles.adjustOnMapButton,
                  styles.directionMapButton,
                  { backgroundColor: mergedTheme.colors.buttonSecondary },
                ]}
                onPress={() => {
                  if (polygonCenter && cameraRef.current) {
                    const zoomLevel = getCompassZoomLevel();
                    cameraRef.current.setCamera({
                      centerCoordinate: [polygonCenter.longitude, polygonCenter.latitude],
                      zoomLevel,
                      animationDuration: 600,
                    });
                  }
                onCompassPress();
              }}
            >
              {typeof mergedIcons.compass === "string" ? (
                <Text style={styles.directionMapButtonIcon}>{mergedIcons.compass}</Text>
              ) : (
                mergedIcons.compass
              )}
              <Text style={[styles.directionMapButtonText, { color: mergedTheme.colors.textSecondary }]}>
                {mergedTranslations.adjustOnMap}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Altitude */}
        {isExpanded && (
            <View style={mergedStyles.parameterSection}>
              <View style={mergedStyles.labelRow}>
                <Text style={[mergedStyles.parameterLabel, { color: mergedTheme.colors.text }]}>
                  {mergedTranslations.altitude} ({mergedTranslations.altitudeUnit})
                </Text>
              </View>
              <View style={mergedStyles.sliderContainer}>
                <TouchableOpacity
                  style={[
                    mergedStyles.altitudeButton,
                    { backgroundColor: mergedTheme.colors.buttonSecondary },
                    !canDecreaseAltitude && [
                      mergedStyles.altitudeButtonDisabled,
                      { backgroundColor: mergedTheme.colors.buttonDisabled },
                    ],
                  ]}
                  onPress={() => onAltitudeAdjust(-ALTITUDE_STEP)}
                  disabled={!canDecreaseAltitude}
                >
                  <Text style={[mergedStyles.altitudeButtonText, { color: mergedTheme.colors.textSecondary }]}>-</Text>
                </TouchableOpacity>
                <View style={[mergedStyles.inputContainer, { backgroundColor: mergedTheme.colors.buttonSecondary }]}>
                  <TextInput
                    style={[mergedStyles.valueInput, { color: mergedTheme.colors.textSecondary }]}
                    value={altitudeText}
                    onChangeText={onAltitudeTextChange}
                    onBlur={onAltitudeBlur}
                    keyboardType="decimal-pad"
                  />
                </View>
                <TouchableOpacity
                  style={[
                    mergedStyles.altitudeButton,
                    { backgroundColor: mergedTheme.colors.buttonSecondary },
                    !canIncreaseAltitude && [
                      mergedStyles.altitudeButtonDisabled,
                      { backgroundColor: mergedTheme.colors.buttonDisabled },
                    ],
                  ]}
                  onPress={() => onAltitudeAdjust(ALTITUDE_STEP)}
                  disabled={!canIncreaseAltitude}
                >
                  <Text style={[mergedStyles.altitudeButtonText, { color: mergedTheme.colors.textSecondary }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
        )}

        {/* Preview Flight Direction Checkbox */}
        {isExpanded && (
          <View style={styles.checkboxContainer}>
            <Switch
              value={previewFlightDirection}
              onValueChange={onPreviewToggle}
              trackColor={{ false: "#767577", true: mergedTheme.colors.success }}
              thumbColor={mergedTheme.colors.buttonSecondary}
            />
            <Text style={[styles.checkboxLabel, { color: mergedTheme.colors.text }]}>
              {mergedTranslations.previewFlightDirection}
            </Text>
          </View>
        )}

        {/* Send to Drone Button */}
        <TouchableOpacity
          style={isExpanded 
            ? (isUploaded 
              ? [mergedStyles.sendButtonWhite, { backgroundColor: mergedTheme.colors.buttonSecondary }]
              : [mergedStyles.sendButton, { backgroundColor: mergedTheme.colors.buttonPrimary }]) 
            : [mergedStyles.iconButton, { backgroundColor: mergedTheme.colors.buttonSecondary }]}
          onPress={onSendToDrone}
          disabled={isUploading}
        >
          {isExpanded ? (
            <>
              {isUploading ? (
                <ActivityIndicator 
                  size="small" 
                  color={isUploaded ? mergedTheme.colors.textSecondary : mergedTheme.colors.buttonText} 
                  style={{ marginRight: 8 }} 
                />
              ) : (
                typeof mergedIcons.send === "string" ? (
                  <Text style={styles.sendButtonIcon}>{mergedIcons.send}</Text>
                ) : (
                  mergedIcons.send
                )
              )}
              <Text style={[
                mergedStyles.sendButtonText,
                { color: isUploaded ? mergedTheme.colors.textSecondary : mergedTheme.colors.buttonText }
              ]}>
                {isUploading ? mergedTranslations.sending : mergedTranslations.sendToDrone}
              </Text>
              {!isUploading && <Text style={[
                styles.sendButtonArrow,
                { color: isUploaded ? mergedTheme.colors.textSecondary : mergedTheme.colors.buttonText }
              ]}>↑</Text>}
            </>
          ) : (
            <Text style={styles.iconButtonText}>
              {isUploading 
                ? (typeof mergedIcons.sendLoading === "string" ? mergedIcons.sendLoading : "⏳")
                : (typeof mergedIcons.sendCollapsed === "string" ? mergedIcons.sendCollapsed : "☁️↑")
              }
            </Text>
          )}
        </TouchableOpacity>

        {/* Start Flying Button - chỉ hiển thị sau khi upload xong */}
        {isUploaded && isExpanded && (
          <TouchableOpacity
            style={[
              mergedStyles.startButton,
              { backgroundColor: mergedTheme.colors.buttonPrimary },
              !isReady && [
                mergedStyles.startButtonDisabled,
                { backgroundColor: mergedTheme.colors.buttonDisabled },
              ],
            ]}
            onPress={onStartFlying}
            disabled={!isReady}
          >
            {typeof mergedIcons.start === "string" ? (
              <Text style={styles.startButtonIcon}>{mergedIcons.start}</Text>
            ) : (
              mergedIcons.start
            )}
            <Text style={[mergedStyles.startButtonText, { color: mergedTheme.colors.buttonText }]}>
              {mergedTranslations.startFlying}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </HorizontalSidebar>
  );
}

const styles = StyleSheet.create({
  sidebarScroll: {
    flex: 1,
  },
  sidebarContent: {
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    paddingBottom: 72,
  },
  parameterSection: {
    marginBottom: 16,
  },
  parameterLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 8,
  },
  sliderContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 6,
    paddingRight: 8,
    height: 36,
    minWidth: 80,
    justifyContent: "center",
    flexShrink: 0,
  },
  valueInput: {
    minWidth: 50,
    height: 36,
    paddingHorizontal: 6,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
    paddingVertical: 0,
  },
  altitudeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  altitudeButtonDisabled: {
    backgroundColor: "#555",
    opacity: 0.4,
  },
  altitudeButtonText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#000",
    marginTop: -2,
  },
  adjustOnMapButton: {
    backgroundColor: "#fff",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  directionSection: {
    paddingVertical: 4,
  },
  directionLabelGroup: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  directionLabel: {
    marginBottom: 0,
  },
  directionValueInline: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 6,
    marginLeft: 12,
  },
  directionValue: {
    fontSize: 32,
    fontWeight: "700",
    color: "#fff",
    lineHeight: 32,
  },
  directionUnit: {
    fontSize: 16,
    fontWeight: "600",
    color: "#B0BEC5",
    marginLeft: 4,
    marginBottom: 4,
  },
  directionMapButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingHorizontal: 10,
  },
  directionMapButtonIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  directionMapButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#000",
  },
  iconButton: {
    backgroundColor: "#fff",
    borderRadius: 6,
    width: 50,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginTop: "auto",
    marginBottom: 12,
    alignSelf: "flex-end",
  },
  iconButtonText: {
    fontSize: 18,
  },
  sendButton: {
    backgroundColor: "#4CAF50",
    borderRadius: 6,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: "auto",
    marginBottom: 12,
    alignSelf: "stretch",
    paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sendButtonWhite: {
    backgroundColor: "#fff",
    borderRadius: 6,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: "auto",
    marginBottom: 12,
    alignSelf: "stretch",
    paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sendButtonIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  sendButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  sendButtonTextBlack: {
    color: "#000",
  },
  sendButtonArrow: {
    fontSize: 14,
    color: "#fff",
    marginLeft: 6,
  },
  sendButtonArrowBlack: {
    color: "#000",
  },
  startButton: {
    backgroundColor: "#4CAF50",
    borderRadius: 6,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    alignSelf: "stretch",
    paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  startButtonDisabled: {
    backgroundColor: "#9E9E9E",
    opacity: 0.6,
  },
  startButtonIcon: {
    fontSize: 14,
    color: "#fff",
    marginRight: 6,
  },
  startButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  checkboxLabel: {
    fontSize: 12,
    color: "#fff",
    marginLeft: 6,
  },
});

