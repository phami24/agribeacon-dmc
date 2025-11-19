// components/mission/MissionSelectionScreen.tsx
import MapboxGL from "@rnmapbox/maps";
import { useRouter, useFocusEffect } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import HorizontalSidebar from "../HorizontalSidebar";
import BluetoothConnectButton from "../BluetoothConnectButton";
import { FlightArea } from "../../data/flightAreas";
import { MissionTheme, defaultMissionTheme } from "../../types/theme";
import { MissionTranslations, defaultViTranslations } from "../../types/i18n";

interface MissionSelectionScreenProps {
  flightAreas: FlightArea[];
  homePosition: { longitude: number; latitude: number } | null;
  hasReceivedHome: boolean;
  connectionState: any;
  isScanning: boolean;
  onBackPress?: () => void;
  onManualDrawPress?: () => void;
  onAreaSelect?: (area: FlightArea) => void;
  onBluetoothPress?: () => Promise<void>;
  defaultCenter?: { longitude: number; latitude: number };
  defaultZoom?: number;
  theme?: Partial<MissionTheme>;
  customStyles?: {
    container?: ViewStyle;
    topBar?: ViewStyle;
    backButton?: ViewStyle;
    backButtonCircle?: ViewStyle;
    backButtonIcon?: TextStyle;
    manualDrawButton?: ViewStyle;
    manualDrawContent?: ViewStyle;
    manualDrawIcon?: TextStyle;
    manualDrawText?: TextStyle;
    sidebarTitle?: TextStyle;
    areaCard?: ViewStyle;
    areaCardSelected?: ViewStyle;
    areaName?: TextStyle;
    areaInfo?: ViewStyle;
    areaInfoItem?: ViewStyle;
    areaInfoIcon?: TextStyle;
    areaInfoText?: TextStyle;
    droneMarkerContainer?: ViewStyle;
    droneMarkerCircle?: ViewStyle;
    droneIcon?: ImageStyle;
  };
  icons?: {
    back?: string | React.ReactNode;
    manualDraw?: string | React.ReactNode;
    area?: string | React.ReactNode;
    beds?: string | React.ReactNode;
  };
  polygonColors?: {
    selected?: string;
    unselected?: string;
    selectedLine?: string;
    unselectedLine?: string;
  };
  translations?: Partial<MissionTranslations>;
}

export default function MissionSelectionScreen({
  flightAreas,
  homePosition,
  hasReceivedHome,
  connectionState,
  isScanning,
  onBackPress,
  onManualDrawPress,
  onAreaSelect,
  onBluetoothPress,
  defaultCenter = { longitude: 106.660172, latitude: 10.762622 },
  defaultZoom = 15,
  theme = defaultMissionTheme,
  customStyles = {},
  icons = {},
  polygonColors = {},
  translations = {},
}: MissionSelectionScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const SIDEBAR_TARGET_WIDTH = Math.min(Math.max(windowWidth * 0.45, 320), windowWidth - 24);
  const mapRef = useRef<MapboxGL.MapView>(null);
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const [selectedArea, setSelectedArea] = useState<FlightArea | null>(
    flightAreas[0] || null
  );
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [sidebarCurrentWidth, setSidebarCurrentWidth] = useState(SIDEBAR_TARGET_WIDTH);

  const mergedTheme = { ...defaultMissionTheme, ...theme };
  const mergedStyles = { ...styles, ...customStyles };
  
  // Default icons
  const defaultIcons = {
    back: "←",
    manualDraw: "✏️",
    area: "🌾",
    beds: "📊",
  };
  const mergedIcons = { ...defaultIcons, ...icons };
  
  // Default polygon colors
  const defaultPolygonColors = {
    selected: "rgba(33, 150, 243, 0.2)",
    unselected: "rgba(0, 0, 0, 0.1)",
    selectedLine: "#2196F3",
    unselectedLine: "#666",
  };
  const mergedPolygonColors = { ...defaultPolygonColors, ...polygonColors };
  
  // Default translations
  const mergedTranslations = { ...defaultViTranslations, ...translations };

  useEffect(() => {
    setSidebarCurrentWidth(SIDEBAR_TARGET_WIDTH);
  }, [SIDEBAR_TARGET_WIDTH]);

  const hasFocusedHomeRef = useRef(false);

  // Tính toán center point gần nhất với tất cả polygons
  const calculateInitialCenter = () => {
    if (flightAreas.length === 0) {
      return defaultCenter;
    }
    
    // Tính trung bình của tất cả centers
    const avgLng = flightAreas.reduce((sum, area) => sum + area.center.longitude, 0) / flightAreas.length;
    const avgLat = flightAreas.reduce((sum, area) => sum + area.center.latitude, 0) / flightAreas.length;
    
    return { longitude: avgLng, latitude: avgLat };
  };

  const initialCenter = calculateInitialCenter();

  // Lock screen to landscape when entering this screen
  useFocusEffect(
    React.useCallback(() => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      
      return () => {
        // Unlock when leaving (optional)
      };
    }, [])
  );

  // Focus camera về HOME mặc định khi map load (chỉ focus lần đầu)
  useEffect(() => {
    if (homePosition && isMapLoaded && !hasFocusedHomeRef.current) {
      hasFocusedHomeRef.current = true;
      setTimeout(() => {
        if (cameraRef.current) {
          cameraRef.current.setCamera({
            centerCoordinate: [homePosition.longitude, homePosition.latitude],
            zoomLevel: 16,
            animationDuration: hasReceivedHome ? 500 : 0,
          });
        }
      }, 300);
    }
  }, [homePosition, isMapLoaded, hasReceivedHome]);
  
  // Focus lại khi nhận được HOME từ BLE (nếu chưa focus lần đầu)
  useEffect(() => {
    if (hasReceivedHome && homePosition && isMapLoaded && !hasFocusedHomeRef.current) {
      hasFocusedHomeRef.current = true;
      setTimeout(() => {
        if (cameraRef.current) {
          cameraRef.current.setCamera({
            centerCoordinate: [homePosition.longitude, homePosition.latitude],
            zoomLevel: 16,
            animationDuration: 500,
          });
        }
      }, 300);
    }
  }, [hasReceivedHome, homePosition, isMapLoaded]);

  const handleAreaSelect = (area: FlightArea) => {
    setSelectedArea(area);
    
    // Zoom to selected area
    if (cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [area.center.longitude, area.center.latitude],
        zoomLevel: 16,
        animationDuration: 500,
      });
    }
    
    // Call custom handler if provided
    if (onAreaSelect) {
      onAreaSelect(area);
    }
  };

  const handleManualDraw = () => {
    if (onManualDrawPress) {
      onManualDrawPress();
    } else {
      router.push("/mission/parameters");
    }
  };

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.push("/");
    }
  };

  return (
    <View style={[mergedStyles.container, { backgroundColor: mergedTheme.colors.background }]}>
      {/* Map View - Full Screen */}
      <MapboxGL.MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        styleURL={MapboxGL.StyleURL.Satellite}
        logoEnabled={false}
        attributionEnabled={false}
        zoomEnabled={true}
        scrollEnabled={true}
        pitchEnabled={false}
        rotateEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
        onDidFinishLoadingMap={() => {
          setIsMapLoaded(true);
          // Focus về HOME mặc định khi map load (nếu chưa có HOME từ BLE)
          if (homePosition && !hasReceivedHome) {
            setTimeout(() => {
              if (cameraRef.current) {
                cameraRef.current.setCamera({
                  centerCoordinate: [homePosition.longitude, homePosition.latitude],
                  zoomLevel: 16,
                  animationDuration: 0,
                });
                hasFocusedHomeRef.current = true;
              }
            }, 300);
          }
        }}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [initialCenter.longitude, initialCenter.latitude],
            zoomLevel: defaultZoom,
          }}
        />
        
        {/* Render drone icon at HOME position */}
        {homePosition && (
          <MapboxGL.PointAnnotation
            id="drone-home"
            coordinate={[homePosition.longitude, homePosition.latitude]}
          >
            <View style={mergedStyles.droneMarkerContainer}>
              <View style={[
                mergedStyles.droneMarkerCircle,
                { backgroundColor: mergedTheme.colors.buttonSecondary, borderColor: mergedTheme.colors.droneMarker },
              ]}>
                <Image
                  source={require("../../assets/drone.png")}
                  style={mergedStyles.droneIcon}
                  resizeMode="contain"
                />
              </View>
            </View>
          </MapboxGL.PointAnnotation>
        )}
        
        {/* Render polygons for all areas */}
        {flightAreas.map((area) => {
          const coordinates = area.coordinates.map((coord) => [
            coord.longitude,
            coord.latitude,
          ]);
          // Close the polygon by adding the first coordinate at the end
          const closedCoordinates = [...coordinates, coordinates[0]];
          
          const isSelected = selectedArea?.id === area.id;
          
          return (
            <MapboxGL.ShapeSource
              key={area.id}
              id={`area-${area.id}`}
              shape={{
                type: "Feature",
                geometry: {
                  type: "Polygon",
                  coordinates: [closedCoordinates],
                },
                properties: {
                  id: area.id,
                  name: area.name,
                },
              }}
              onPress={() => handleAreaSelect(area)}
            >
              <MapboxGL.FillLayer
                id={`fill-${area.id}`}
                style={{
                  fillColor: isSelected ? mergedPolygonColors.selected : mergedPolygonColors.unselected,
                }}
              />
              <MapboxGL.LineLayer
                id={`line-${area.id}`}
                style={{
                  lineColor: isSelected ? mergedPolygonColors.selectedLine : mergedPolygonColors.unselectedLine,
                  lineWidth: isSelected ? 3 : 1,
                }}
              />
            </MapboxGL.ShapeSource>
          );
        })}
      </MapboxGL.MapView>

      {/* Top Bar - Back + Bluetooth status */}
      <View style={[mergedStyles.topBar, { top: insets.top + 10 }]}>
        <TouchableOpacity style={mergedStyles.backButton} onPress={handleBack}>
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

        <BluetoothConnectButton
          connectionState={connectionState}
          isScanning={isScanning}
          onPress={onBluetoothPress}
        />
      </View>

      {/* Manual Draw Button */}
      <TouchableOpacity
        style={[mergedStyles.manualDrawButton, { bottom: 20 }]}
        onPress={handleManualDraw}
      >
        <View style={[mergedStyles.manualDrawContent, { backgroundColor: mergedTheme.colors.buttonSecondary }]}>
          {typeof mergedIcons.manualDraw === "string" ? (
            <Text style={mergedStyles.manualDrawIcon}>{mergedIcons.manualDraw}</Text>
          ) : (
            mergedIcons.manualDraw
          )}
          <Text style={[mergedStyles.manualDrawText, { color: mergedTheme.colors.textSecondary }]}>
            {mergedTranslations.manualDraw}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Horizontal Sidebar - Flight Areas List */}
      <HorizontalSidebar
        collapsedWidth={60}
        expandedWidth={SIDEBAR_TARGET_WIDTH}
        minWidth={SIDEBAR_TARGET_WIDTH}
        backgroundColor={mergedTheme.colors.surface}
        initialWidth={SIDEBAR_TARGET_WIDTH}
        onExpandedChange={(expanded) => {
          setIsSidebarExpanded(expanded);
        }}
        onWidthChange={(width) => {
          setSidebarCurrentWidth(width);
        }}
      >
        <Text style={[mergedStyles.sidebarTitle, { color: mergedTheme.colors.text }]}>
          {mergedTranslations.selectFlightArea}
        </Text>
        <FlatList
          data={flightAreas}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                mergedStyles.areaCard,
                { backgroundColor: mergedTheme.colors.surface, borderColor: mergedTheme.colors.border },
                selectedArea?.id === item.id && [
                  mergedStyles.areaCardSelected,
                  { backgroundColor: mergedTheme.colors.primary + "4D", borderColor: mergedTheme.colors.primary },
                ],
              ]}
              onPress={() => handleAreaSelect(item)}
            >
              <Text
                style={[mergedStyles.areaName, { color: mergedTheme.colors.text }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {item.name}
              </Text>
              <View style={mergedStyles.areaInfo}>
                <View style={mergedStyles.areaInfoItem}>
                  {typeof mergedIcons.area === "string" ? (
                    <Text style={mergedStyles.areaInfoIcon}>{mergedIcons.area}</Text>
                  ) : (
                    mergedIcons.area
                  )}
                  <Text style={[mergedStyles.areaInfoText, { color: mergedTheme.colors.textSecondary }]}>
                    {item.area.toFixed(2)} {mergedTranslations.hectares}
                  </Text>
                </View>
                <View style={mergedStyles.areaInfoItem}>
                  {typeof mergedIcons.beds === "string" ? (
                    <Text style={mergedStyles.areaInfoIcon}>{mergedIcons.beds}</Text>
                  ) : (
                    mergedIcons.beds
                  )}
                  <Text style={[mergedStyles.areaInfoText, { color: mergedTheme.colors.textSecondary }]}>
                    {item.beds} {mergedTranslations.beds}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          style={styles.areasList}
          showsVerticalScrollIndicator={true}
        />
      </HorizontalSidebar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    columnGap: 12,
  },
  backButton: {
    zIndex: 10,
  },
  backButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    fontSize: 20,
    color: "#000",
    fontWeight: "bold",
  },
  manualDrawButton: {
    position: "absolute",
    left: 16,
    zIndex: 10,
  },
  sidebarTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 12,
  },
  manualDrawContent: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  manualDrawIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  manualDrawText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  areasList: {
    flex: 1,
  },
  areaCard: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  areaCardSelected: {
    backgroundColor: "rgba(33, 150, 243, 0.3)",
    borderColor: "#2196F3",
    borderWidth: 2,
  },
  areaName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
  },
  areaInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  areaInfoItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  areaInfoIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  areaInfoText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
  },
  droneMarkerContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  droneMarkerCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#2196F3",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  droneIcon: {
    width: 18,
    height: 18,
  },
});

