// app/mission/parameters.tsx
// DEMO APP - Đây là ví dụ sử dụng library
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Switch,
  TextInput,
  ScrollView,
  Modal,
  useWindowDimensions,
  Linking,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import MapboxGL from "@rnmapbox/maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ScreenOrientation from "expo-screen-orientation";
import CompassOverlay from "../../components/CompassOverlay";
import DrawToolbar from "../../components/mission/DrawToolbar";
import MissionTopBar from "../../components/mission/MissionTopBar";
import MissionSidebar from "../../components/mission/MissionSidebar";
import MissionMapView from "../../components/mission/MissionMapView";
import WPProgressDialog from "../../components/mission/WPProgressDialog";
import BluetoothConnectButton from "../../components/BluetoothConnectButton";
import StatusCard from "../../components/StatusCard";
import StatusIndicator from "../../components/StatusIndicator";
import HorizontalSidebar from "../../components/HorizontalSidebar";
import { generateOptimizedPath } from "../../services/pathGenerator";
import { useBLE } from "../../module/ble/hooks/useBLE";
import { useDroneDataStore } from "../../store/droneDataStore";
import { bleService } from "../../module/ble/services";
import { State } from "react-native-ble-plx";
import { usePolygonDrawing } from "../../hooks/usePolygonDrawing";
import { useMissionUpload } from "../../hooks/useMissionUpload";
import { useFlightParameters, ALTITUDE_MIN, ALTITUDE_MAX, ALTITUDE_STEP } from "../../hooks/useFlightParameters";
import {
  Point,
  orderSimplePolygon,
  ensurePolygonClosed,
  getPolygonCoordinates,
  calculatePolygonBounds,
  calculatePolygonCenter,
  getCompassZoomLevel,
} from "../../utils/polygonUtils";
import { defaultMissionTheme } from "../../types/theme";
import { defaultViTranslations } from "../../constants/i18n";

export default function FlightParametersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const SIDEBAR_TARGET_WIDTH = Math.min(Math.max(windowWidth * 0.45, 320), windowWidth - 24);
  const mapRef = useRef<MapboxGL.MapView>(null);
  const cameraRef = useRef<MapboxGL.Camera>(null);

  // BLE setup
  const { 
    connectionState, 
    writeCharacteristic, 
    isScanning, 
    startScan 
  } = useBLE();
  
  // Lấy dữ liệu từ store (dùng chung)
  const batteryLevel = useDroneDataStore((state) => state.batteryLevel);
  const isReady = useDroneDataStore((state) => state.isReady);
  const homePosition = useDroneDataStore((state) => state.homePosition);
  const hasReceivedHome = useDroneDataStore((state) => state.hasReceivedHome);
  
  const hasFocusedHomeRef = useRef(false); // Đánh dấu đã focus HOME lần đầu
  const hasTriedAutoConnectRef = useRef(false); // Đánh dấu đã thử auto-connect chưa
  const hasShownBluetoothDialogRef = useRef(false); // Đánh dấu đã hiển thị dialog yêu cầu bật Bluetooth chưa
  
  // Status states
  const [flightTime, setFlightTime] = useState("50 phút");
  const [distance, setDistance] = useState("200 m");

  // Flight parameters hook
  const flightParams = useFlightParameters({
    writeCharacteristic,
    isReady,
  });
  const {
    flightDirection,
    setFlightDirection,
    altitude,
    setAltitude,
    altitudeText,
    setAltitudeText,
    previewFlightDirection,
    setPreviewFlightDirection,
    debouncedFlightDirection,
    debouncedAltitude,
    handleAltitudeAdjust,
    canDecreaseAltitude,
    canIncreaseAltitude,
    handleStartFlying,
  } = flightParams;

  const [showCompassOverlay, setShowCompassOverlay] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [sidebarCurrentWidth, setSidebarCurrentWidth] = useState(SIDEBAR_TARGET_WIDTH);
  const [showMissionControls, setShowMissionControls] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [waypoints, setWaypoints] = useState<
    Array<{ latitude: number; longitude: number; altitude: number }>
  >([]);
  const [isGeneratingPath, setIsGeneratingPath] = useState(false);

  useEffect(() => {
    setSidebarCurrentWidth(SIDEBAR_TARGET_WIDTH);
  }, [SIDEBAR_TARGET_WIDTH]);

  // Polygon drawing hook
  const polygonDrawing = usePolygonDrawing();
  const {
    polygonPoints,
    history,
    isDeleteMode,
    draggingPointId,
    handleUndo,
    handleToggleDeleteMode,
    handleClearAll,
    handlePointDragStart,
    handlePointDrag,
    handlePointDragEnd,
    addPointAtCoords,
    handlePointDelete,
  } = polygonDrawing;

  // Memoize ordered và closed polygon để tránh tính toán lại
  const orderedAndClosedPolygon = useMemo(() => {
    if (!polygonPoints || polygonPoints.length < 3) return null;
    const ordered = orderSimplePolygon(polygonPoints);
    return ensurePolygonClosed(ordered);
  }, [polygonPoints]);

  const polygonBounds = useMemo(() => {
    return calculatePolygonBounds(orderedAndClosedPolygon || []);
  }, [orderedAndClosedPolygon]);

  const polygonCenter = useMemo(() => {
    return calculatePolygonCenter(orderedAndClosedPolygon || []);
  }, [orderedAndClosedPolygon]);

  const getCompassZoomLevelCallback = useCallback(() => {
    return getCompassZoomLevel(polygonBounds);
  }, [polygonBounds]);

  // Mission upload hook
  const missionUpload = useMissionUpload();
  const {
    isUploading,
    wpDialogVisible,
    wpValue,
    isUploaded,
    handleSendToDrone: handleSendToDroneFromHook,
  } = missionUpload;

  // Wrapper for handleSendToDrone to get polygon from state
  const handleSendToDrone = useCallback(async () => {
    if (!polygonPoints || polygonPoints.length < 3) {
      Alert.alert("Lỗi", "Cần ít nhất 3 điểm để gửi mission");
      return;
    }

    // Get polygon (remove last point if it's duplicate of first)
    const polygon = orderedAndClosedPolygon 
      ? orderedAndClosedPolygon.slice(0, -1).map((p: Point) => ({
          latitude: p.latitude,
          longitude: p.longitude,
        }))
      : polygonPoints.map((p: Point) => ({
          latitude: p.latitude,
          longitude: p.longitude,
        }));

    await handleSendToDroneFromHook(polygon, altitude, flightDirection);
  }, [polygonPoints, orderedAndClosedPolygon, altitude, flightDirection, handleSendToDroneFromHook]);

  const handleBackButtonPress = useCallback(() => {
    if (showMissionControls) {
      setShowMissionControls(false);
      return;
    }
    router.replace("/mission");
  }, [router, showMissionControls]);

  // Lock screen to landscape and focus to HOME
  useFocusEffect(
    React.useCallback(() => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);

      // Auto-connect BLE khi vào màn hình mission (chỉ thử 1 lần)
      const autoConnectBLE = async () => {
        // Chỉ thử connect 1 lần khi vào màn hình
        if (hasTriedAutoConnectRef.current) {
          return;
        }

        try {
          // Kiểm tra nếu đã kết nối rồi thì không cần làm gì
          if (connectionState?.isConnected) {
            console.log("[Mission] BLE already connected");
            hasTriedAutoConnectRef.current = true;
            return;
          }

          // Kiểm tra nếu đang scan/connect thì không làm gì
          if (isScanning) {
            console.log("[Mission] BLE is already scanning/connecting");
            return;
          }

          // Kiểm tra Bluetooth state trước khi scan
          const manager = (bleService as any).manager;
          if (manager) {
            const state = await manager.state();
            if (state !== State.PoweredOn) {
              console.log(`[Mission] Bluetooth is ${state}, requesting user to enable`);
              
              // Hiển thị dialog yêu cầu bật Bluetooth (chỉ 1 lần)
              if (!hasShownBluetoothDialogRef.current) {
                hasShownBluetoothDialogRef.current = true;
                
                Alert.alert(
                  "Bluetooth chưa bật",
                  "Vui lòng bật Bluetooth để kết nối với thiết bị bay.",
                  [
                    {
                      text: "Hủy",
                      style: "cancel",
                      onPress: () => {
                        hasTriedAutoConnectRef.current = true;
                      },
                    },
                    {
                      text: "Mở Cài đặt",
                      onPress: async () => {
                        try {
                          if (Platform.OS === "android") {
                            await Linking.openSettings();
                          } else {
                            await Linking.openURL("app-settings:");
                          }
                        } catch (error) {
                          console.error("[Mission] Error opening settings:", error);
                        }
                        // Reset flag để có thể thử lại sau khi quay lại
                        hasTriedAutoConnectRef.current = false;
                        hasShownBluetoothDialogRef.current = false;
                      },
                    },
                  ],
                  { cancelable: false }
                );
              }
              
              hasTriedAutoConnectRef.current = true; // Đánh dấu đã thử, không thử lại nữa
              return;
            }
          }

          console.log("[Mission] Auto-connecting BLE from mission screen...");
          hasTriedAutoConnectRef.current = true; // Đánh dấu đã thử
          
          // Request permissions trước
          const hasPermission = await bleService.requestPermissions();
          if (!hasPermission) {
            console.log("[Mission] BLE permissions denied");
            return;
          }

          // Bắt đầu scan (sẽ tự động connect khi tìm thấy target device)
          await startScan(10000); // Scan 10 giây
        } catch (error: any) {
          console.error("[Mission] Auto-connect BLE error:", error);
        }
      };

      // Gọi auto-connect ngay lập tức khi vào màn hình
      autoConnectBLE();

      // Luôn focus vào HOME khi màn hình được focus
      if (homePosition && isMapLoaded) {
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

      return () => {
        // Reset flag khi rời màn hình để có thể thử lại lần sau
        // Nhưng giữ hasShownBluetoothDialogRef để không hiển thị dialog lại ngay lập tức
      };
    }, [homePosition, isMapLoaded]) // Loại bỏ dependencies không cần thiết để tránh trigger nhiều lần
  );

  // Thử lại kết nối khi Bluetooth state thay đổi thành PoweredOn
  useEffect(() => {
    // Chỉ chạy interval nếu đã từng hiển thị dialog (tức là Bluetooth đã từng tắt)
    if (!hasShownBluetoothDialogRef.current) {
      return;
    }

    const checkAndRetry = async () => {
      // Chỉ thử lại nếu chưa kết nối và không đang scan
      if (connectionState?.isConnected || isScanning) {
        return;
      }

      try {
        const manager = (bleService as any).manager;
        if (manager) {
          const state = await manager.state();
          if (state === State.PoweredOn) {
            console.log("[Mission] Bluetooth is now on, retrying auto-connect...");
            hasTriedAutoConnectRef.current = false; // Reset để có thể thử lại
            hasShownBluetoothDialogRef.current = false; // Reset dialog flag
            
            // Thử kết nối lại
            const hasPermission = await bleService.requestPermissions();
            if (hasPermission) {
              await startScan(10000);
            }
          }
        }
      } catch (error) {
        console.error("[Mission] Error retrying connection:", error);
      }
    };

    // Kiểm tra mỗi 2 giây
    const interval = setInterval(checkAndRetry, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [connectionState?.isConnected, isScanning, startScan]);


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


  const handleMapPress = useCallback(
    (event: any) => {
      if (showCompassOverlay || isDeleteMode) return;
      if (draggingPointId) {
        handlePointDragEnd();
      }

      const geometry = event?.geometry;
      if (!geometry || !geometry.coordinates) return;

      let pointCoords: [number, number] | null = null;
      const coords = geometry.coordinates;

      if (Array.isArray(coords)) {
        if (coords.length >= 2 && typeof coords[0] === "number") {
          pointCoords = [coords[0], coords[1]];
        } else if (Array.isArray(coords[0])) {
          const first = coords[0];
          if (Array.isArray(first) && first.length >= 2) {
            pointCoords = [first[0], first[1]];
          }
        }
      }

      if (pointCoords) {
        addPointAtCoords(pointCoords[0], pointCoords[1]);
      }
    },
    [
      addPointAtCoords,
      draggingPointId,
      handlePointDragEnd,
      isDeleteMode,
      showCompassOverlay,
    ]
  );


  // Generate waypoints effect - trigger when preview is enabled and debounced values change
  useEffect(() => {
    if (previewFlightDirection) {
      setIsGeneratingPath(true);
    }
  }, [previewFlightDirection, debouncedFlightDirection, debouncedAltitude]);

  // Generate waypoints when preview is enabled - chỉ dùng debounced values
  React.useEffect(() => {
    if (previewFlightDirection && orderedAndClosedPolygon) {
      // Get home point từ store (HOME từ BLE) hoặc first point of polygon
      const home = homePosition 
        ? { latitude: homePosition.latitude, longitude: homePosition.longitude }
        : orderedAndClosedPolygon[0];

      // Convert polygon points to format for path generator (without last duplicate point)
      const polygon = orderedAndClosedPolygon.slice(0, -1).map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
      }));

      // Generate waypoints với debounced values để tránh lag
      // Sử dụng setTimeout để chạy trong background và không block UI thread
      let cancelled = false;
      
      const generatePath = () => {
        if (cancelled) {
          setIsGeneratingPath(false);
          return;
        }
        
        // Chạy tính toán trong setTimeout để không block UI thread
        setTimeout(() => {
          if (cancelled) {
            setIsGeneratingPath(false);
            return;
          }
          
          try {
            const fov = 23.0; // Fixed FOV
            const generatedWaypoints = generateOptimizedPath(
              polygon,
              home,
              debouncedAltitude,
              fov,
              debouncedFlightDirection
            );
            
            if (!cancelled) {
              setWaypoints(generatedWaypoints);
              setIsGeneratingPath(false);
            }
          } catch (error) {
            console.error("Error generating path:", error);
            setIsGeneratingPath(false);
          }
        }, 0);
      };

      // Delay nhỏ để UI có thể render loading indicator trước
      const timeoutId = setTimeout(generatePath, 50);
      return () => {
        cancelled = true;
        clearTimeout(timeoutId);
        setIsGeneratingPath(false);
      };
    } else {
      setWaypoints([]);
    }
  }, [previewFlightDirection, orderedAndClosedPolygon, debouncedAltitude, debouncedFlightDirection, homePosition]);


  return (
    <View style={styles.container}>
      {/* Map View - Full Screen */}
      <MissionMapView
        mapRef={mapRef}
        cameraRef={cameraRef}
        polygonPoints={polygonPoints}
        waypoints={waypoints}
        homePosition={homePosition}
        isMapLoaded={isMapLoaded}
        isDeleteMode={isDeleteMode}
        showCompassOverlay={showCompassOverlay}
        previewFlightDirection={previewFlightDirection}
        isGeneratingPath={isGeneratingPath}
        draggingPointId={draggingPointId}
        onMapPress={handleMapPress}
        onPointDrag={handlePointDrag}
        onPointDragEnd={handlePointDragEnd}
        onPointDelete={handlePointDelete}
        theme={defaultMissionTheme}
        translations={defaultViTranslations}
        onMapLoad={() => {
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
      />

      <DrawToolbar
        historyLength={history.length}
        isDeleteMode={isDeleteMode}
        polygonPointsLength={polygonPoints.length}
        onUndo={handleUndo}
        onToggleDeleteMode={handleToggleDeleteMode}
        onClearAll={handleClearAll}
        theme={defaultMissionTheme}
        translations={defaultViTranslations}
      />

      {/* Top Bar - luôn hiển thị nút back và trạng thái Bluetooth */}
      <MissionTopBar
        connectionState={connectionState}
        isScanning={isScanning}
        isReady={isReady}
        flightTime={flightTime}
        distance={distance}
        batteryLevel={batteryLevel}
        showMissionControls={showMissionControls}
        showCompassOverlay={showCompassOverlay}
        onBackPress={handleBackButtonPress}
        theme={defaultMissionTheme}
        translations={defaultViTranslations}
        onBluetoothPress={async () => {
          try {
            if (connectionState?.isConnected) {
              return;
            }

            const manager = (bleService as any).manager;
            if (manager) {
              const state = await manager.state();
              if (state !== State.PoweredOn) {
                Alert.alert(
                  "Bluetooth chưa bật",
                  "Vui lòng bật Bluetooth để kết nối với thiết bị bay.",
                  [
                    {
                      text: "Hủy",
                      style: "cancel",
                    },
                    {
                      text: "Mở Cài đặt",
                      onPress: async () => {
                        try {
                          if (Platform.OS === "android") {
                            await Linking.openSettings();
                          } else {
                            await Linking.openURL("app-settings:");
                          }
                        } catch (error) {
                          console.error("[Mission] Error opening settings:", error);
                        }
                      },
                    },
                  ]
                );
                return;
              }
            }

            const hasPermission = await bleService.requestPermissions();
            if (hasPermission) {
              await startScan(10000);
            }
          } catch (error: any) {
            console.error("[Mission] Manual connect error:", error);
            Alert.alert("Lỗi", `Không thể kết nối: ${error.message || error}`);
          }
        }}
      />

      {/* Horizontal Sidebar - Flight Parameters */}
      {showMissionControls && !showCompassOverlay && (
        <MissionSidebar
          isExpanded={isSidebarExpanded}
          sidebarWidth={sidebarCurrentWidth}
          flightDirection={flightDirection}
          altitude={altitude}
          altitudeText={altitudeText}
          previewFlightDirection={previewFlightDirection}
          isUploading={isUploading}
          isUploaded={isUploaded}
          isReady={isReady}
          polygonCenter={polygonCenter}
          getCompassZoomLevel={getCompassZoomLevelCallback}
          canDecreaseAltitude={canDecreaseAltitude}
          canIncreaseAltitude={canIncreaseAltitude}
          onAltitudeAdjust={handleAltitudeAdjust}
          onAltitudeTextChange={(text) => {
            const normalizedText = text.replace(',', '.');
            setAltitudeText(normalizedText);
            if (normalizedText === "" || normalizedText === "." || normalizedText === "-") {
              return;
            }
            const num = parseFloat(normalizedText);
            if (!isNaN(num) && num >= ALTITUDE_MIN && num <= ALTITUDE_MAX) {
              setAltitude(num);
            }
          }}
          onAltitudeBlur={() => {
            const normalizedText = altitudeText.replace(',', '.');
            const num = parseFloat(normalizedText);
            if (isNaN(num) || normalizedText === "" || normalizedText === "." || normalizedText === "-") {
              setAltitudeText(altitude.toString());
              setAltitude(altitude);
            } else {
              let validNum = num;
              if (num < ALTITUDE_MIN) validNum = ALTITUDE_MIN;
              if (num > ALTITUDE_MAX) validNum = ALTITUDE_MAX;
              setAltitude(validNum);
              setAltitudeText(validNum.toString());
            }
          }}
          onPreviewToggle={setPreviewFlightDirection}
          onCompassPress={() => setShowCompassOverlay(true)}
          onSendToDrone={handleSendToDrone}
          onStartFlying={handleStartFlying}
          onExpandedChange={setIsSidebarExpanded}
          onWidthChange={setSidebarCurrentWidth}
          cameraRef={cameraRef}
          theme={defaultMissionTheme}
          translations={defaultViTranslations}
        />
      )}

      {!showMissionControls && (
        <TouchableOpacity
          style={[styles.bottomRightButton, { bottom: insets.bottom + 20 }]}
          onPress={() => setShowMissionControls(true)}
        >
          <Text style={styles.bottomRightButtonText}>Cài đặt thông số bay</Text>
          <Text style={styles.bottomRightButtonIcon}>→</Text>
        </TouchableOpacity>
      )}

      {/* Compass Overlay */}
      {showCompassOverlay && polygonCenter && (
        <CompassOverlay
          initialAngle={flightDirection}
          onAngleChange={(angle) => {
            const roundedAngle = Math.round(angle);
            setFlightDirection(roundedAngle);
          }}
          onClose={() => {
            setShowCompassOverlay(false);
          }}
        />
      )}

      {/* WP Progress Dialog */}
      <WPProgressDialog
        visible={wpDialogVisible}
        wpValue={wpValue}
        theme={defaultMissionTheme}
        translations={defaultViTranslations}
      />
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
  sidebarScroll: {
    flex: 1,
  },
  sidebarContent: {
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    paddingBottom: 72, // tránh đè lên nút toggle
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
  inputOnlyContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 6,
    paddingRight: 8,
    height: 36,
    minWidth: 60,
    justifyContent: "flex-end",
    alignSelf: "flex-end",
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
  unitText: {
    fontSize: 13,
    color: "#666",
    marginRight: 4,
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
  bottomRightButton: {
    position: "absolute",
    right: 16,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4CAF50",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  bottomRightButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginRight: 8,
  },
  bottomRightButtonIcon: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
