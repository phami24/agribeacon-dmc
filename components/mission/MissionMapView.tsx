// components/mission/MissionMapView.tsx
import React from "react";
import { View, Text, StyleSheet, Image, ActivityIndicator, Alert, ViewStyle, TextStyle } from "react-native";
import MapboxGL from "@rnmapbox/maps";
import { Point } from "../../utils/polygonUtils";
import { getPolygonCoordinates } from "../../utils/polygonUtils";
import { MissionTheme, defaultMissionTheme } from "../../types/theme";
import { MissionTranslations, defaultViTranslations } from "../../types/i18n";
import DroneIcon from "../../assets/map/drone.svg";

interface MissionMapViewProps {
  mapRef: React.RefObject<MapboxGL.MapView | null>;
  cameraRef: React.RefObject<MapboxGL.Camera | null>;
  polygonPoints: Point[];
  bufferPolygon?: Point[] | null;
  showBufferPolygon?: boolean;
  waypoints: Array<{ latitude: number; longitude: number; altitude: number }>;
  homePosition: { longitude: number; latitude: number } | null;
  hasReceivedHome: boolean;
  isMapLoaded: boolean;
  isDeleteMode: boolean;
  showCompassOverlay: boolean;
  showMissionControls: boolean;
  previewFlightDirection: boolean;
  isGeneratingPath: boolean;
  draggingPointId: string | null;
  onMapPress: (event: any) => void;
  onPointDrag: (pointId: string, coords: [number, number]) => void;
  onPointDragEnd: () => void;
  onPointDelete: (pointId: string) => void;
  onMapLoad: () => void;
  defaultCenter?: [number, number];
  defaultZoom?: number;
  theme?: Partial<MissionTheme>;
  customStyles?: {
    drawPointMarker?: ViewStyle;
    drawPointMarkerDelete?: ViewStyle;
    waypointMarker?: ViewStyle;
    waypointNumber?: TextStyle;
    loadingOverlay?: ViewStyle;
    loadingContainer?: ViewStyle;
    loadingText?: TextStyle;
    droneMarkerContainer?: ViewStyle;
    droneMarkerCircle?: ViewStyle;
  };
  translations?: Partial<MissionTranslations>;
}

export default function MissionMapView({
  mapRef,
  cameraRef,
  polygonPoints,
  bufferPolygon,
  showBufferPolygon = false,
  waypoints,
  homePosition,
  hasReceivedHome,
  isMapLoaded,
  isDeleteMode,
  showCompassOverlay,
  showMissionControls,
  previewFlightDirection,
  isGeneratingPath,
  draggingPointId,
  onMapPress,
  onPointDrag,
  onPointDragEnd,
  onPointDelete,
  onMapLoad,
  defaultCenter = [106.660172, 10.762622],
  defaultZoom = 16,
  theme = defaultMissionTheme,
  customStyles = {},
  translations = {},
}: MissionMapViewProps) {
  const mergedTheme = { ...defaultMissionTheme, ...theme };
  const mergedStyles = { ...styles, ...customStyles };
  const mergedTranslations = { ...defaultViTranslations, ...translations };
  return (
    <MapboxGL.MapView
      ref={mapRef}
      style={StyleSheet.absoluteFillObject}
      styleURL={MapboxGL.StyleURL.Satellite}
      logoEnabled={false}
      attributionEnabled={false}
      zoomEnabled={!showCompassOverlay}
      scrollEnabled={!showCompassOverlay}
      pitchEnabled={false}
      rotateEnabled={false}
      compassEnabled={false}
      scaleBarEnabled={false}
      onPress={onMapPress}
      onDidFinishLoadingMap={onMapLoad}
    >
      <MapboxGL.Camera
        ref={cameraRef}
        defaultSettings={{
          centerCoordinate: homePosition 
            ? [homePosition.longitude, homePosition.latitude]
            : defaultCenter,
          zoomLevel: defaultZoom,
        }}
      />

      {/* Render drone icon at HOME position - Luôn hiển thị khi có homePosition */}
      {homePosition && (
        <MapboxGL.PointAnnotation
          id="drone-home"
          coordinate={[homePosition.longitude, homePosition.latitude]}
        >
          <View style={styles.droneMarkerContainer}>
            <View style={[
              mergedStyles.droneMarkerCircle,
              { backgroundColor: mergedTheme.colors.buttonSecondary, borderColor: mergedTheme.colors.droneMarker },
            ]}>
              <DroneIcon width={18} height={18} />
            </View>
          </View>
        </MapboxGL.PointAnnotation>
      )}

      {/* Render buffer polygon (tab 2) - Ẩn khi ở mode chụp ảnh */}
      {isMapLoaded &&
        showBufferPolygon &&
        bufferPolygon &&
        bufferPolygon.length >= 3 &&
        (() => {
          const coords = getPolygonCoordinates(bufferPolygon);
          if (coords.length === 0) return null;
          return (
            <MapboxGL.ShapeSource
              id="buffer-polygon"
              shape={{
                type: "Feature",
                geometry: {
                  type: "Polygon",
                  coordinates: [coords],
                },
                properties: {},
              }}
            >
              <MapboxGL.FillLayer
                id="buffer-polygon-fill"
                style={{
                  fillColor: "rgba(255, 152, 0, 0.2)", // Orange với độ trong suốt
                }}
              />
              <MapboxGL.LineLayer
                id="buffer-polygon-line"
                style={{
                  lineColor: "#FF9800", // Orange
                  lineWidth: 3,
                  lineDasharray: [5, 5], // Đường nét đứt
                }}
              />
            </MapboxGL.ShapeSource>
          );
        })()}

      {/* Render polygon */}
      {isMapLoaded &&
        polygonPoints &&
        polygonPoints.length >= 3 &&
        (() => {
          const coords = getPolygonCoordinates(polygonPoints);
          if (coords.length === 0) return null;
          return (
            <MapboxGL.ShapeSource
              id="drawn-polygon"
              shape={{
                type: "Feature",
                geometry: {
                  type: "Polygon",
                  coordinates: [coords],
                },
                properties: {},
              }}
            >
              <MapboxGL.FillLayer
                id="polygon-fill"
                style={{
                  fillColor: mergedTheme.colors.polygonFill,
                }}
              />
              <MapboxGL.LineLayer
                id="polygon-line"
                style={{
                  lineColor: mergedTheme.colors.polygonLine,
                  lineWidth: 3,
                }}
              />
            </MapboxGL.ShapeSource>
          );
        })()}

      {/* Render polygon points - Ẩn khi vào màn cài đặt thông số */}
      {!showMissionControls && polygonPoints.map((point) => (
        <MapboxGL.PointAnnotation
          key={point.id}
          id={`draw-point-${point.id}`}
          coordinate={[point.longitude, point.latitude]}
          draggable={!showCompassOverlay && !showMissionControls}
          onDrag={(feature) => {
            const coords = feature.geometry.coordinates as [number, number];
            onPointDrag(point.id, coords);
          }}
          onDragEnd={onPointDragEnd}
          onSelected={() => {
            if (isDeleteMode && !showMissionControls) {
              Alert.alert(
                mergedTranslations.deletePoint,
                mergedTranslations.confirmDelete,
                [
                  { text: mergedTranslations.cancel, style: "cancel" },
                  {
                    text: mergedTranslations.delete,
                    style: "destructive",
                    onPress: () => onPointDelete(point.id),
                  },
                ]
              );
            }
          }}
        >
          <View
            style={[
              mergedStyles.drawPointMarker,
              { backgroundColor: mergedTheme.colors.primary, borderColor: mergedTheme.colors.buttonSecondary },
              isDeleteMode && [
                mergedStyles.drawPointMarkerDelete,
                { backgroundColor: mergedTheme.colors.error },
              ],
            ]}
          />
        </MapboxGL.PointAnnotation>
      ))}

      {/* Loading indicator khi đang generate path */}
      {isMapLoaded && previewFlightDirection && isGeneratingPath && (
          <View style={mergedStyles.loadingOverlay}>
            <View style={mergedStyles.loadingContainer}>
              <ActivityIndicator size="large" color={mergedTheme.colors.success} />
              <Text style={[mergedStyles.loadingText, { color: mergedTheme.colors.text }]}>
                {mergedTranslations.calculatingPath}
              </Text>
            </View>
          </View>
      )}

      {/* Render waypoint path when preview is enabled - chỉ hiện khi đã vào mode setup */}
      {isMapLoaded && previewFlightDirection && waypoints.length >= 2 && !isGeneratingPath && !showCompassOverlay && showMissionControls && (
        <>
          {/* Render line first - will be behind markers */}
          <MapboxGL.ShapeSource
            id="waypoint-path"
            shape={{
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: waypoints
                  .slice(0, -1)
                  .map((wp) => [wp.longitude, wp.latitude]),
              },
              properties: {},
            }}
          >
            <MapboxGL.LineLayer
              id="waypoint-path-line"
              style={{
                lineColor: mergedTheme.colors.waypointLine,
                lineWidth: 3,
                lineOpacity: 0.8,
              }}
            />
          </MapboxGL.ShapeSource>
        </>
      )}
      
      {/* Waypoint markers - render separately after line to ensure they appear on top - chỉ hiện khi đã vào mode setup */}
      {isMapLoaded && previewFlightDirection && waypoints.length >= 2 && !isGeneratingPath && !showCompassOverlay && showMissionControls && (
        <>
          {waypoints.slice(0, -1).map((wp, idx) => (
            <MapboxGL.PointAnnotation
              key={`wp-${idx}`}
              id={`wp-marker-${idx}`}
              coordinate={[wp.longitude, wp.latitude]}
              anchor={{ x: 0.5, y: 0.5 }}
            >
                <View style={[
                  mergedStyles.waypointMarker,
                  { backgroundColor: mergedTheme.colors.waypointMarker, borderColor: mergedTheme.colors.buttonSecondary },
                ]}>
                  <Text style={[mergedStyles.waypointNumber, { color: mergedTheme.colors.buttonSecondary }]}>
                    {idx + 2}
                  </Text>
                </View>
            </MapboxGL.PointAnnotation>
          ))}
        </>
      )}
    </MapboxGL.MapView>
  );
}

const styles = StyleSheet.create({
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
  drawPointMarker: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#2196F3",
    borderWidth: 2,
    borderColor: "#fff",
  },
  drawPointMarkerDelete: {
    backgroundColor: "#ff5252",
  },
  waypointMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ff6f00",
    borderWidth: 1,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  waypointNumber: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 8,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    zIndex: 500,
  },
  loadingContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 12,
  },
});

