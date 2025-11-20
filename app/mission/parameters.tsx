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
import WhiteUploadIcon from "../../assets/map/white-upload.svg";
import BlackUploadIcon from "../../assets/map/black-upload.svg";
import StartIcon from "../../assets/map/start.svg";
import ClockIcon from "../../assets/map/clock.svg";
import LineIcon from "../../assets/map/line.svg";
import BatteryIcon from "../../assets/map/battery.svg";
import BedIcon from "../../assets/map/bed.svg";
import { useRouter, useFocusEffect } from "expo-router";
import MapboxGL from "@rnmapbox/maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ScreenOrientation from "expo-screen-orientation";
import CompassOverlay from "../../components/CompassOverlay";
import DrawToolbar from "../../components/mission/DrawToolbar";
import MissionTopBar from "../../components/mission/MissionTopBar";
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
import * as BleConstants from "../../constants/BLEConstants";
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
  calculateBufferPolygon,
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
    translations: defaultViTranslations,
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
  const [activeTab, setActiveTab] = useState<1 | 2>(1); // Tab 1: mặc định, Tab 2: chụp ảnh
  const [waypoints, setWaypoints] = useState<
    Array<{ latitude: number; longitude: number; altitude: number }>
  >([]);
  const [isGeneratingPath, setIsGeneratingPath] = useState(false);

  useEffect(() => {
    setSidebarCurrentWidth(SIDEBAR_TARGET_WIDTH);
  }, [SIDEBAR_TARGET_WIDTH]);

  // Polygon drawing hook
  const polygonDrawing = usePolygonDrawing({ translations: defaultViTranslations });
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

  // Calculate buffer polygon for tab 2 (chụp ảnh)
  // Buffer distance: 50 meters (có thể điều chỉnh)
  const bufferPolygon = useMemo(() => {
    if (!orderedAndClosedPolygon || activeTab !== 2) return null;
    const bufferDistance = 50; // meters
    return calculateBufferPolygon(orderedAndClosedPolygon, bufferDistance);
  }, [orderedAndClosedPolygon, activeTab]);

  // Auto-enable preview when switching to tab 2
  useEffect(() => {
    if (activeTab === 2 && bufferPolygon) {
      setPreviewFlightDirection(true);
    }
  }, [activeTab, bufferPolygon]);

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
  const missionUpload = useMissionUpload({ translations: defaultViTranslations });
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
      Alert.alert(defaultViTranslations.error, defaultViTranslations.errorNeed3Points);
      return;
    }

    // Tab 2: gửi buffer polygon với hướng 0 độ, độ cao 300m
    if (activeTab === 2 && bufferPolygon) {
      const polygon = bufferPolygon.slice(0, -1).map((p: Point) => ({
        latitude: p.latitude,
        longitude: p.longitude,
      }));
      await handleSendToDroneFromHook(polygon, 300, 0); // Độ cao 300m, hướng 0 độ
      return;
    }

    // Tab 1: logic cũ
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
  }, [polygonPoints, orderedAndClosedPolygon, bufferPolygon, activeTab, altitude, flightDirection, handleSendToDroneFromHook]);

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
      // Không cho chỉnh sửa khi đã vào màn cài đặt thông số
      if (showCompassOverlay || isDeleteMode || showMissionControls) return;
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
      showMissionControls,
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
    // Tab 2: tự động vẽ waypoints trên buffer polygon với hướng 0 độ, độ cao 300m
    if (activeTab === 2 && bufferPolygon) {
      setIsGeneratingPath(true);
      let cancelled = false;
      
      const generatePath = () => {
        if (cancelled) {
          setIsGeneratingPath(false);
          return;
        }
        
        setTimeout(() => {
          if (cancelled) {
            setIsGeneratingPath(false);
            return;
          }
          
          try {
            const home = homePosition 
              ? { latitude: homePosition.latitude, longitude: homePosition.longitude }
              : bufferPolygon[0];
            
            const polygon = bufferPolygon.slice(0, -1).map((p) => ({
              latitude: p.latitude,
              longitude: p.longitude,
            }));
            
            const fov = 23.0;
            const photoAltitude = 300; // Độ cao cố định 300m cho tab 2
            const photoDirection = 0; // Hướng cố định 0 độ cho tab 2
            
            const generatedWaypoints = generateOptimizedPath(
              polygon,
              home,
              photoAltitude,
              fov,
              photoDirection
            );
            
            if (!cancelled) {
              setWaypoints(generatedWaypoints);
              setIsGeneratingPath(false);
            }
          } catch (error) {
            console.error("Error generating photo path:", error);
            setIsGeneratingPath(false);
          }
        }, 0);
      };
      
      const timeoutId = setTimeout(generatePath, 50);
      return () => {
        cancelled = true;
        clearTimeout(timeoutId);
        setIsGeneratingPath(false);
      };
    } else if (previewFlightDirection && orderedAndClosedPolygon && activeTab === 1) {
      // Tab 1: logic cũ với preview và debounced values
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
  }, [previewFlightDirection, orderedAndClosedPolygon, bufferPolygon, activeTab, debouncedAltitude, debouncedFlightDirection, homePosition]);


  return (
    <View style={styles.container}>
      {/* Map View - Full Screen */}
      <MissionMapView
        mapRef={mapRef}
        cameraRef={cameraRef}
        polygonPoints={polygonPoints}
        bufferPolygon={activeTab === 2 ? bufferPolygon : null}
        showBufferPolygon={false}
        waypoints={waypoints}
        homePosition={homePosition}
        hasReceivedHome={hasReceivedHome}
        isMapLoaded={isMapLoaded}
        isDeleteMode={isDeleteMode}
        showCompassOverlay={showCompassOverlay}
        showMissionControls={showMissionControls}
        previewFlightDirection={previewFlightDirection || activeTab === 2}
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

      {/* DrawToolbar - chỉ hiện khi không ở mode setup */}
      {!showMissionControls && (
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
      )}

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
        icons={{
          flightTime: <ClockIcon width={16} height={16} />,
          distance: <LineIcon width={16} height={16} />,
          battery: <BatteryIcon width={16} height={16} />,
        }}
      />

      {/* Horizontal Sidebar - Flight Parameters */}
      {showMissionControls && !showCompassOverlay && (
        <HorizontalSidebar
          collapsedWidth={60}
          expandedWidth={SIDEBAR_TARGET_WIDTH}
          minWidth={SIDEBAR_TARGET_WIDTH}
          backgroundColor="rgba(0, 0, 0, 0.75)"
          initialWidth={SIDEBAR_TARGET_WIDTH}
          onExpandedChange={(expanded) => {
            setIsSidebarExpanded(expanded);
          }}
          onWidthChange={(width) => {
            setSidebarCurrentWidth(width);
          }}
        >
        <ScrollView
          style={styles.sidebarScroll}
          contentContainerStyle={styles.sidebarContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Tab System - Chỉ icon, không có chữ */}
          {isSidebarExpanded && (
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 1 && styles.tabActive]}
                onPress={() => setActiveTab(1)}
              >
                <BedIcon width={20} height={20} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 2 && styles.tabActive]}
                onPress={() => setActiveTab(2)}
              >
                <Text style={styles.tabIcon}>📷</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Tab 1 Content - Flight Direction */}
          {isSidebarExpanded && activeTab === 1 && (
            <View style={[styles.parameterSection, styles.directionSection]}>
              <View style={styles.labelRow}>
                <View style={styles.directionLabelGroup}>
                  <Text style={[styles.parameterLabel, styles.directionLabel]}>Hướng bay</Text>
                  <View style={styles.directionValueInline}>
                    <Text style={styles.directionValue}>{flightDirection}</Text>
                    <Text style={styles.directionUnit}>°</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.adjustOnMapButton, styles.directionMapButton]}
                onPress={() => {
                  if (polygonCenter && cameraRef.current) {
                    const zoomLevel = getCompassZoomLevelCallback();
                    cameraRef.current.setCamera({
                      centerCoordinate: [polygonCenter.longitude, polygonCenter.latitude],
                      zoomLevel,
                      animationDuration: 600,
                    });
                  }
                  setShowCompassOverlay(true);
                }}
              >
                <Text style={styles.directionMapButtonIcon}>🧭</Text>
                <Text style={styles.directionMapButtonText}>Điều chỉnh trên bản đồ</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Tab 1 Content - Altitude */}
          {isSidebarExpanded && activeTab === 1 && (
            <View style={styles.parameterSection}>
              <View style={styles.labelRow}>
                <Text style={styles.parameterLabel}>Độ cao (m)</Text>
              </View>
              <View style={styles.sliderContainer}>
                <TouchableOpacity
                  style={[
                    styles.altitudeButton,
                    !canDecreaseAltitude && styles.altitudeButtonDisabled,
                  ]}
                  onPress={() => handleAltitudeAdjust(-ALTITUDE_STEP)}
                  disabled={!canDecreaseAltitude}
                >
                  <Text style={styles.altitudeButtonText}>-</Text>
                </TouchableOpacity>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.valueInput}
                    value={altitudeText}
                    onChangeText={(text) => {
                      // Allow any text input for better UX, including . and ,
                      // Replace comma with dot for parsing
                      const normalizedText = text.replace(',', '.');
                      setAltitudeText(normalizedText);
                      
                      // Allow empty string, single dot, or comma for typing
                      if (normalizedText === "" || normalizedText === "." || normalizedText === "-") {
                        return;
                      }
                      
                      // Try to parse and update value if valid
                      const num = parseFloat(normalizedText);
                      if (!isNaN(num)) {
                        if (num >= ALTITUDE_MIN && num <= ALTITUDE_MAX) {
                          setAltitude(num);
                        }
                      }
                    }}
                    onBlur={() => {
                      // Validate and fix on blur
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
                    keyboardType="decimal-pad"
                  />
                </View>
                <TouchableOpacity
                  style={[
                    styles.altitudeButton,
                    !canIncreaseAltitude && styles.altitudeButtonDisabled,
                  ]}
                  onPress={() => handleAltitudeAdjust(ALTITUDE_STEP)}
                  disabled={!canIncreaseAltitude}
                >
                  <Text style={styles.altitudeButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Tab 1 Content - Preview Flight Direction Checkbox - Ở trên nút Gửi thông tin */}
          {isSidebarExpanded && activeTab === 1 && (
            <View style={styles.checkboxContainer}>
              <Switch
                value={previewFlightDirection}
                onValueChange={setPreviewFlightDirection}
                trackColor={{ false: "#767577", true: "#4CAF50" }}
                thumbColor="#fff"
              />
              <Text style={styles.checkboxLabel}>Xem trước hướng bay</Text>
            </View>
          )}

          {/* Tab 2 Content - Chụp ảnh - Hiển thị thông số nhưng không cho chỉnh sửa */}
          {isSidebarExpanded && activeTab === 2 && (
            <>
              <View style={[styles.parameterSection, styles.directionSection]}>
                <View style={styles.labelRow}>
                  <View style={styles.directionLabelGroup}>
                    <Text style={[styles.parameterLabel, styles.directionLabel]}>Hướng bay</Text>
                    <View style={styles.directionValueInline}>
                      <Text style={styles.directionValue}>0</Text>
                      <Text style={styles.directionUnit}>°</Text>
                    </View>
                  </View>
                </View>
                <View style={[styles.adjustOnMapButton, styles.directionMapButton, styles.disabledButton]}>
                  <Text style={[styles.directionMapButtonIcon, styles.disabledText]}>🧭</Text>
                  <Text style={[styles.directionMapButtonText, styles.disabledText]}>Điều chỉnh trên bản đồ</Text>
                </View>
              </View>

              <View style={styles.parameterSection}>
                <View style={styles.labelRow}>
                  <Text style={styles.parameterLabel}>Độ cao (m)</Text>
                </View>
                <View style={styles.sliderContainer}>
                  <TouchableOpacity
                    style={[styles.altitudeButton, styles.altitudeButtonDisabled]}
                    disabled={true}
                  >
                    <Text style={styles.altitudeButtonText}>-</Text>
                  </TouchableOpacity>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.valueInput}
                      value="300"
                      editable={false}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.altitudeButton, styles.altitudeButtonDisabled]}
                    disabled={true}
                  >
                    <Text style={styles.altitudeButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.checkboxContainer}>
                <Switch
                  value={true}
                  disabled={true}
                  trackColor={{ false: "#767577", true: "#4CAF50" }}
                  thumbColor="#fff"
                />
                <Text style={[styles.checkboxLabel, styles.disabledText]}>Xem trước hướng bay</Text>
              </View>
            </>
          )}

          {/* Send to Drone Button */}
          <TouchableOpacity
            style={isSidebarExpanded 
              ? (isUploaded ? styles.sendButtonWhite : styles.sendButton) 
              : styles.iconButton}
            onPress={handleSendToDrone}
            disabled={isUploading}
          >
            {isSidebarExpanded ? (
              <>
                {isUploading ? (
                  <ActivityIndicator size="small" color={isUploaded ? "#000" : "#fff"} style={{ marginRight: 8 }} />
                ) : (
                  isUploaded ? (
                    <BlackUploadIcon width={16} height={16} style={{ marginRight: 6 }} />
                  ) : (
                    <WhiteUploadIcon width={16} height={16} style={{ marginRight: 6 }} />
                  )
                )}
                <Text style={[
                  styles.sendButtonText,
                  isUploaded && styles.sendButtonTextBlack
                ]}>
                  {isUploading ? "Đang gửi..." : "Gửi thông tin lên drone"}
                </Text>
                {!isUploading && <Text style={[
                  styles.sendButtonArrow,
                  isUploaded && styles.sendButtonArrowBlack
                ]}>↑</Text>}
              </>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                {isUploading ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <WhiteUploadIcon width={14} height={14} />
                    <Text style={{ fontSize: 10, marginLeft: 2 }}>↑</Text>
                  </>
                )}
              </View>
            )}
          </TouchableOpacity>

          {/* Start Flying Button - chỉ hiển thị sau khi upload xong */}
          {isUploaded && isSidebarExpanded && (
            <TouchableOpacity
              style={[
                styles.startButton,
                !isReady && styles.startButtonDisabled
              ]}
              onPress={async () => {
                // Check BLE connection
                const connectedDevice = bleService.getConnectedDevice();
                if (!connectedDevice) {
                  Alert.alert("Lỗi", "Chưa kết nối BLE. Vui lòng đợi kết nối...");
                  return;
                }

                // Check status
                if (!isReady) {
                  Alert.alert("Lỗi", "Drone chưa sẵn sàng. Status phải = 1");
                  return;
                }

                try {
                  // Gửi lệnh START
                  const startCmd = "START\r\n";
                  console.log("=== LỆNH START ===");
                  console.log(startCmd);
                  console.log("==================");

                  const success = await writeCharacteristic(
                    BleConstants.NORDIC_UART_SERVICE,
                    BleConstants.NORDIC_TX_UUID,
                    startCmd
                  );

                  if (success) {
                    console.log("✓ Đã gửi lệnh START thành công");
                    Alert.alert("Thành công", "Đã gửi lệnh bắt đầu bay!");
                  } else {
                    console.error("✗ Gửi lệnh START thất bại");
                    Alert.alert("Lỗi", "Gửi lệnh START thất bại");
                  }
                } catch (error) {
                  console.error("Error sending START command:", error);
                  Alert.alert("Lỗi", "Có lỗi xảy ra khi gửi lệnh START");
                }
              }}
              disabled={!isReady}
            >
              <StartIcon width={16} height={16} style={{ marginRight: 6 }} />
              <Text style={styles.startButtonText}>Bắt đầu bay</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
        </HorizontalSidebar>
      )}

      {!showMissionControls && (
        <TouchableOpacity
          style={[styles.bottomRightButton, { bottom: insets.bottom + 20 }]}
          onPress={() => {
            // Kiểm tra đã vẽ polygon chưa
            if (!polygonPoints || polygonPoints.length < 3) {
              Alert.alert(
                defaultViTranslations.error || "Lỗi",
                defaultViTranslations.errorNeed3Points || "Cần vẽ ít nhất 3 điểm để cài đặt thông số bay"
              );
              return;
            }
            setShowMissionControls(true);
          }}
        >
          <Text style={styles.bottomRightButtonText}>Cài đặt thông số bay</Text>
          <Text style={styles.bottomRightButtonIcon}>→</Text>
        </TouchableOpacity>
      )}

      {/* Bluetooth Button - góc dưới bên trái */}
      <View style={[styles.bottomLeftButton, { bottom: insets.bottom + 20, left: 20 }]}>
        <BluetoothConnectButton
          connectionState={connectionState}
          isScanning={isScanning}
          onPress={async () => {
            try {
              if (connectionState?.isConnected) {
                return;
              }

              const manager = (bleService as any).manager;
              if (manager) {
                const state = await manager.state();
                if (state !== State.PoweredOn) {
                Alert.alert(
                  defaultViTranslations.bluetoothNotEnabled,
                  defaultViTranslations.bluetoothNotEnabledMessage,
                  [
                    {
                      text: defaultViTranslations.cancel,
                      style: "cancel",
                    },
                    {
                      text: defaultViTranslations.openSettings,
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
              Alert.alert(defaultViTranslations.error, `${defaultViTranslations.errorCannotConnect}: ${error.message || error}`);
            }
          }}
        />
      </View>

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
  bottomLeftButton: {
    position: "absolute",
    zIndex: 10,
  },
  tabContainer: {
    flexDirection: "row",
    marginBottom: 16,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: "#fff",
  },
  tabIcon: {
    fontSize: 20,
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledText: {
    opacity: 0.6,
  },
  disabledInput: {
    opacity: 0.6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
});
