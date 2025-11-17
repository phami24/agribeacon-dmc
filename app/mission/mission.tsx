// app/mission/mission.tsx
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Image,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import MapboxGL from "@rnmapbox/maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ScreenOrientation from "expo-screen-orientation";
import { flightAreas, FlightArea } from "../../data/flightAreas";
import HorizontalSidebar from "../../components/HorizontalSidebar";
import { useBLE } from "../../module/ble/hooks/useBLE";
import { useBLEStoreSync } from "../../hooks/useBLEStoreSync";
import { useDroneDataStore } from "../../store/droneDataStore";
import * as BleConstants from "../../constants/BLEConstants";

const { width, height } = Dimensions.get("window");

export default function MissionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapboxGL.MapView>(null);
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const [selectedArea, setSelectedArea] = useState<FlightArea | null>(
    flightAreas[0] || null
  );
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [sidebarCurrentWidth, setSidebarCurrentWidth] = useState(width / 3);
  
  // BLE setup - KHÔNG sync store để giảm lag (chỉ cần connection state)
  const { connectionState } = useBLE();
  
  // Lấy HOME position từ store (dùng chung)
  const homePosition = useDroneDataStore((state) => state.homePosition);
  const hasReceivedHome = useDroneDataStore((state) => state.hasReceivedHome);
  
  const hasFocusedHomeRef = useRef(false); // Đánh dấu đã focus HOME lần đầu

  // Tính toán center point gần nhất với tất cả polygons
  const calculateInitialCenter = () => {
    if (flightAreas.length === 0) {
      return { longitude: 106.660172, latitude: 10.762622 };
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
      // Lock to landscape
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      
      return () => {
        // Unlock when leaving (optional - you can keep it locked)
        // ScreenOrientation.unlockAsync();
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
            animationDuration: hasReceivedHome ? 500 : 0, // Nếu đã có HOME từ BLE thì animate, nếu không thì set ngay
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
  };

  const handleManualDraw = () => {
    router.push("/draw");
  };

  return (
    <View style={styles.container}>
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
            zoomLevel: 15,
          }}
        />
        
        {/* Render drone icon at HOME position - luôn hiển thị nếu có homePosition */}
        {homePosition && (
          <MapboxGL.PointAnnotation
            id="drone-home"
            coordinate={[homePosition.longitude, homePosition.latitude]}
          >
            <View style={styles.droneMarkerContainer}>
              <View style={styles.droneMarkerCircle}>
                <Image
                  source={require("../../assets/drone.png")}
                  style={styles.droneIcon}
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
                  fillColor:
                    selectedArea?.id === area.id
                      ? "rgba(33, 150, 243, 0.2)"
                      : "rgba(0, 0, 0, 0.1)",
                }}
              />
              <MapboxGL.LineLayer
                id={`line-${area.id}`}
                style={{
                  lineColor:
                    selectedArea?.id === area.id ? "#2196F3" : "#666",
                  lineWidth: selectedArea?.id === area.id ? 3 : 1,
                }}
              />
            </MapboxGL.ShapeSource>
          );
        })}
      </MapboxGL.MapView>

      {/* Back Button */}
      <TouchableOpacity
        style={[styles.backButton, { top: insets.top + 10 }]}
        onPress={() => router.push("/")}
      >
        <View style={styles.backButtonCircle}>
          <Text style={styles.backButtonIcon}>←</Text>
        </View>
      </TouchableOpacity>

      {/* Manual Draw Button - Sát trái */}
      <TouchableOpacity
        style={[styles.manualDrawButton, { bottom: 20 }]}
        onPress={handleManualDraw}
      >
        <View style={styles.manualDrawContent}>
          <Text style={styles.manualDrawIcon}>✏️</Text>
          <Text style={styles.manualDrawText}>Vẽ khu vực bay thủ công</Text>
        </View>
      </TouchableOpacity>

      {/* Horizontal Sidebar - Flight Areas List (bên phải màn hình ngang, full height) */}
      <HorizontalSidebar
        collapsedWidth={60}
        minWidth={width * 0.35} // Minimum width - chỉ được kéo nhỏ đến giá trị này, nếu nhỏ hơn sẽ đóng
        backgroundColor="rgba(0, 0, 0, 0.75)"
        initialWidth={width /2}
        onExpandedChange={(expanded) => {
          setIsSidebarExpanded(expanded);
        }}
        onWidthChange={(width) => {
          setSidebarCurrentWidth(width);
        }}
      >
        <Text style={styles.sidebarTitle}>Chọn khu vực bay</Text>
        <FlatList
          data={flightAreas}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.areaCard,
                selectedArea?.id === item.id && styles.areaCardSelected,
              ]}
              onPress={() => handleAreaSelect(item)}
            >
              <Text
                style={styles.areaName}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {item.name}
              </Text>
              <View style={styles.areaInfo}>
                <View style={styles.areaInfoItem}>
                  <Text style={styles.areaInfoIcon}>🌾</Text>
                  <Text style={styles.areaInfoText}>
                    {item.area.toFixed(2)} ha
                  </Text>
                </View>
                <View style={styles.areaInfoItem}>
                  <Text style={styles.areaInfoIcon}>📊</Text>
                  <Text style={styles.areaInfoText}>{item.beds} luống</Text>
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
  backButton: {
    position: "absolute",
    left: 16,
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
