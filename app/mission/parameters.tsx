// app/mission/parameters.tsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  TextInput,
  Switch,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import MapboxGL from "@rnmapbox/maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ScreenOrientation from "expo-screen-orientation";
import HorizontalSidebar from "../../components/HorizontalSidebar";
import StatusCard from "../../components/StatusCard";
import StatusIndicator from "../../components/StatusIndicator";
import CompassOverlay from "../../components/CompassOverlay";
import Slider from "@react-native-community/slider";
import { usePolygonStore } from "../../store/polygonStore";
import { generateOptimizedPath } from "../../services/pathGenerator";
import { useBLE } from "../../module/ble/hooks/useBLE";
import { useBLEStoreSync } from "../../hooks/useBLEStoreSync";
import { useDroneDataStore } from "../../store/droneDataStore";
import { bleService } from "../../module/ble/services";
import * as BleConstants from "../../constants/BLEConstants";

interface Point {
  id: string;
  latitude: number;
  longitude: number;
}

const { width, height } = Dimensions.get("window");

export default function FlightParametersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapboxGL.MapView>(null);
  const cameraRef = useRef<MapboxGL.Camera>(null);

  // BLE setup
  useBLEStoreSync();
  const { connectionState, writeCharacteristic } = useBLE();
  
  // Lấy dữ liệu từ store (dùng chung)
  const batteryLevel = useDroneDataStore((state) => state.batteryLevel);
  const isReady = useDroneDataStore((state) => state.isReady);
  const homePosition = useDroneDataStore((state) => state.homePosition);
  const hasReceivedHome = useDroneDataStore((state) => state.hasReceivedHome);
  const wp = useDroneDataStore((state) => state.wp);
  
  const hasFocusedHomeRef = useRef(false); // Đánh dấu đã focus HOME lần đầu
  
  // Status states
  const [flightTime, setFlightTime] = useState("50 phút");
  const [distance, setDistance] = useState("200 m");

  // Flight parameters
  const [flightDirection, setFlightDirection] = useState(0);
  const [altitude, setAltitude] = useState(5.5);
  const [flightDirectionText, setFlightDirectionText] = useState("0");
  const [altitudeText, setAltitudeText] = useState("5.5");
  const [previewFlightDirection, setPreviewFlightDirection] = useState(false);
  const [showCompassOverlay, setShowCompassOverlay] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [wpDialogVisible, setWpDialogVisible] = useState(false);
  const [wpValue, setWpValue] = useState<string>("");
  const [isUploaded, setIsUploaded] = useState(false);
  const wpCheckTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Debounced values để tránh generate waypoints liên tục khi đang kéo slider
  const [debouncedFlightDirection, setDebouncedFlightDirection] = useState(0);
  const [debouncedAltitude, setDebouncedAltitude] = useState(5.5);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [sidebarCurrentWidth, setSidebarCurrentWidth] = useState(
    Math.min(width * 0.4, 200)
  );
  const polygonPoints = usePolygonStore((state) => state.points);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [waypoints, setWaypoints] = useState<
    Array<{ latitude: number; longitude: number; altitude: number }>
  >([]);
  const [isGeneratingPath, setIsGeneratingPath] = useState(false);

  // Get polygon coordinates for rendering
  const getPolygonCoordinates = (): number[][] => {
    if (!polygonPoints || polygonPoints.length < 3) return [];
    const coords = polygonPoints.map((p: Point) => [p.longitude, p.latitude]);
    // Close the polygon
    coords.push([polygonPoints[0].longitude, polygonPoints[0].latitude]);
    return coords;
  };

  // Lock screen to landscape and focus to HOME
  useFocusEffect(
    React.useCallback(() => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);

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

      return () => {};
    }, [homePosition, isMapLoaded])
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

  // Order points to form a simple polygon (approximate) by sorting around centroid
  // Memoize để tránh tính toán lại không cần thiết
  const orderSimplePolygon = useCallback((points: Point[]): Point[] => {
    if (points.length < 3) return [...points];

    // Remove duplicate last point if polygon is already closed
    let pointsToSort = [...points];
    if (pointsToSort.length > 3) {
      const first = pointsToSort[0];
      const last = pointsToSort[pointsToSort.length - 1];
      const isClosed =
        Math.abs(first.latitude - last.latitude) < 1e-7 &&
        Math.abs(first.longitude - last.longitude) < 1e-7;
      if (isClosed) {
        pointsToSort = pointsToSort.slice(0, -1);
      }
    }

    // Calculate centroid
    let cx = 0,
      cy = 0;
    for (const p of pointsToSort) {
      cy += p.latitude;
      cx += p.longitude;
    }
    cx /= pointsToSort.length;
    cy /= pointsToSort.length;

    // Sort by angle from centroid
    const sorted = [...pointsToSort];
    sorted.sort((a, b) => {
      const aa = Math.atan2(a.latitude - cy, a.longitude - cx);
      const bb = Math.atan2(b.latitude - cy, b.longitude - cx);
      return aa - bb;
    });

    return sorted;
  }, []);

  // Ensure polygon is closed (first point = last point)
  // Memoize để tránh tính toán lại không cần thiết
  const ensurePolygonClosed = useCallback((points: Point[]): Point[] => {
    if (points.length < 3) return [...points];

    const closed = [...points];
    const first = closed[0];
    const last = closed[closed.length - 1];
    const isClosed =
      Math.abs(first.latitude - last.latitude) < 1e-7 &&
      Math.abs(first.longitude - last.longitude) < 1e-7;

    if (!isClosed) {
      closed.push({ ...first });
    }

    return closed;
  }, []);

  // Sync text inputs when values change from slider
  React.useEffect(() => {
    setFlightDirectionText(flightDirection.toString());
  }, [flightDirection]);

  React.useEffect(() => {
    setAltitudeText(altitude.toString());
  }, [altitude]);

  // Debounce flightDirection và altitude để tránh generate waypoints liên tục
  React.useEffect(() => {
    // Set loading state ngay khi bắt đầu thay đổi (nếu preview đang bật)
    if (previewFlightDirection) {
      setIsGeneratingPath(true);
    }
    
    // Clear timer cũ nếu có
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Set timer mới - chỉ update sau 300ms không có thay đổi (tăng lên để giảm lag)
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedFlightDirection(flightDirection);
      setDebouncedAltitude(altitude);
    }, 300);
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [flightDirection, altitude, previewFlightDirection]);

  // Memoize ordered và closed polygon để tránh tính toán lại
  const orderedAndClosedPolygon = useMemo(() => {
    if (!polygonPoints || polygonPoints.length < 3) return null;
    const ordered = orderSimplePolygon(polygonPoints);
    return ensurePolygonClosed(ordered);
  }, [polygonPoints, orderSimplePolygon, ensurePolygonClosed]);

  // Tính toán center của polygon (centroid)
  const polygonCenter = useMemo(() => {
    if (!orderedAndClosedPolygon || orderedAndClosedPolygon.length < 3) return null;
    // Remove duplicate last point if exists
    const points = orderedAndClosedPolygon.slice(0, -1);
    let cx = 0;
    let cy = 0;
    for (const p of points) {
      cx += p.longitude;
      cy += p.latitude;
    }
    cx /= points.length;
    cy /= points.length;
    return { longitude: cx, latitude: cy };
  }, [orderedAndClosedPolygon]);

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

  // Encode polyline using Google Polyline algorithm (same as Dart version)
  const encodePolyline = (coords: Array<{ latitude: number; longitude: number }>): string => {
    if (coords.length === 0) return "";
    
    let prevLat = 0;
    let prevLng = 0;
    let encoded = "";
    
    for (const coord of coords) {
      // Scale by 1e5 (same as Dart version)
      const lat = Math.round(coord.latitude * 1e5);
      const lng = Math.round(coord.longitude * 1e5);
      
      // Encode delta
      encoded += encodeNumber(lat - prevLat);
      encoded += encodeNumber(lng - prevLng);
      
      prevLat = lat;
      prevLng = lng;
    }
    
    return encoded;
  };

  // Encode a single number for polyline
  const encodeNumber = (num: number): string => {
    // Left shift by 1, invert if negative
    num = num < 0 ? ~(num << 1) : (num << 1);
    let encoded = "";
    
    while (num >= 0x20) {
      encoded += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
      num >>= 5;
    }
    
    encoded += String.fromCharCode(num + 63);
    return encoded;
  };

  const handleSendToDrone = async () => {
    // Validate polygon
    if (!polygonPoints || polygonPoints.length < 3) {
      Alert.alert("Lỗi", "Cần ít nhất 3 điểm để gửi mission");
      return;
    }

    // Check BLE connection - kiểm tra từ service trực tiếp (chính xác hơn)
    const connectedDevice = bleService.getConnectedDevice();
    if (!connectedDevice) {
      Alert.alert("Lỗi", "Chưa kết nối BLE. Vui lòng đợi kết nối...");
      return;
    }

    // KHÔNG reset isUploaded - giữ nguyên màu trắng khi gửi lại
    // setIsUploaded(false); // REMOVED

    try {
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

      // Encode polygon
      const encodedPolygon = encodePolyline(polygon);

      // Round altitude and bearing (same as Dart version)
      const altInt = Math.round(altitude);
      const bearingInt = Math.round(flightDirection);

      // Build command: MISSION_SCAN<alt>::<bearing>::<encoded>
      const missionCmd = `MISSION_SCAN${altInt}::${bearingInt}::${encodedPolygon}\r\n`;

      // Log command to console
      console.log("=== LỆNH GỬI LÊN DRONE ===");
      console.log(missionCmd);
      console.log("==========================");

      // Clear timer cũ nếu có
      if (wpCheckTimerRef.current) {
        clearTimeout(wpCheckTimerRef.current);
        wpCheckTimerRef.current = null;
      }
      
      // Hiển thị loading và dialog ngay lập tức
      setIsUploading(true);
      setWpDialogVisible(true);
      setWpValue("Đang gửi...");

      // Send via BLE
      const success = await writeCharacteristic(
        BleConstants.NORDIC_UART_SERVICE,
        BleConstants.NORDIC_TX_UUID,
        missionCmd
      );

      if (success) {
        console.log("✓ Đã gửi lệnh thành công qua BLE");
        
        // Sau 3 giây, kiểm tra WP
        wpCheckTimerRef.current = setTimeout(() => {
          checkWPStatus();
        }, 3000);
      } else {
        console.error("✗ Gửi lệnh thất bại");
        setIsUploading(false);
        setWpDialogVisible(false);
        Alert.alert("Lỗi", "Gửi lệnh thất bại");
      }
    } catch (error) {
      console.error("Error sending mission command:", error);
      setIsUploading(false);
      setWpDialogVisible(false);
      Alert.alert("Lỗi", "Có lỗi xảy ra khi gửi lệnh");
    }
  };

  // Kiểm tra WP status và hiển thị dialog nếu cần
  const checkWPStatus = () => {
    // Clear timer cũ nếu có
    if (wpCheckTimerRef.current) {
      clearTimeout(wpCheckTimerRef.current);
      wpCheckTimerRef.current = null;
    }

    const currentWP = useDroneDataStore.getState().wp;
    
    if (!currentWP) {
      // Chưa có WP, tiếp tục đợi
      wpCheckTimerRef.current = setTimeout(() => {
        checkWPStatus();
      }, 1000);
      return;
    }

    // Parse WP format "a/b"
    const parts = currentWP.split('/');
    if (parts.length !== 2) {
      // Format không đúng, tiếp tục đợi
      wpCheckTimerRef.current = setTimeout(() => {
        checkWPStatus();
      }, 1000);
      return;
    }

    const a = parseInt(parts[0], 10);
    const b = parseInt(parts[1], 10);

    if (isNaN(a) || isNaN(b)) {
      // Không parse được, tiếp tục đợi
      wpCheckTimerRef.current = setTimeout(() => {
        checkWPStatus();
      }, 1000);
      return;
    }

    if (a === b) {
      // Hoàn thành - tắt loading và dialog
      setIsUploading(false);
      setWpDialogVisible(false);
      setIsUploaded(true); // Đánh dấu đã upload xong
      Alert.alert("Thành công", "Đã gửi mission thành công!");
    } else {
      // Chưa hoàn thành - hiển thị dialog và tiếp tục kiểm tra
      setWpValue(currentWP);
      setWpDialogVisible(true);
      
      // Tiếp tục kiểm tra mỗi giây
      wpCheckTimerRef.current = setTimeout(() => {
        checkWPStatus();
      }, 1000);
    }
  };

  // Cleanup timer khi component unmount
  useEffect(() => {
    return () => {
      if (wpCheckTimerRef.current) {
        clearTimeout(wpCheckTimerRef.current);
        wpCheckTimerRef.current = null;
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      {/* Map View - Full Screen */}
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
            centerCoordinate: homePosition 
              ? [homePosition.longitude, homePosition.latitude]
              : [106.660172, 10.762622],
            zoomLevel: 16,
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

        {/* Render polygon from store */}
        {isMapLoaded &&
          polygonPoints &&
          polygonPoints.length >= 3 &&
          (() => {
            const coords = getPolygonCoordinates();
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
                    fillColor: "rgba(33, 150, 243, 0.2)",
                  }}
                />
                <MapboxGL.LineLayer
                  id="polygon-line"
                  style={{
                    lineColor: "#2196F3",
                    lineWidth: 3,
                  }}
                />
              </MapboxGL.ShapeSource>
            );
          })()}

        {/* Loading indicator khi đang generate path */}
        {isMapLoaded && previewFlightDirection && isGeneratingPath && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4CAF50" />
              <Text style={styles.loadingText}>Đang tính toán đường bay...</Text>
            </View>
          </View>
        )}

        {/* Render waypoint path when preview is enabled */}
        {isMapLoaded && previewFlightDirection && waypoints.length >= 2 && !isGeneratingPath && (
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
                  lineColor: "#ff6f00",
                  lineWidth: 3,
                  lineOpacity: 0.8,
                }}
              />
            </MapboxGL.ShapeSource>
          </>
        )}
        
        {/* Waypoint markers - render separately after line to ensure they appear on top */}
        {isMapLoaded && previewFlightDirection && waypoints.length >= 2 && !isGeneratingPath && (
          <>
            {waypoints.slice(0, -1).map((wp, idx) => (
              <MapboxGL.PointAnnotation
                key={`wp-${idx}`}
                id={`wp-marker-${idx}`}
                coordinate={[wp.longitude, wp.latitude]}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.waypointMarker}>
                  <Text style={styles.waypointNumber}>{idx + 2}</Text>
                </View>
              </MapboxGL.PointAnnotation>
            ))}
          </>
        )}
      </MapboxGL.MapView>

      {/* Top Bar - Status Cards - Ẩn khi mở la bàn */}
      {!showCompassOverlay && (
        <View style={[styles.topBar, { top: insets.top + 10 }]}>
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <View style={styles.backButtonCircle}>
              <Text style={styles.backButtonIcon}>←</Text>
            </View>
          </TouchableOpacity>

          {/* Status Cards */}
          <View style={styles.statusContainer}>
            <StatusIndicator isReady={isReady} />
            <StatusCard icon="🕐" label="Thời gian bay" value={flightTime} />
            <StatusCard icon="📏" label="Khoảng cách" value={distance} />
            <StatusCard
              icon="🔋"
              label="Dung lượng pin"
              value={batteryLevel !== null ? `${batteryLevel}%` : "-/-"}
              statusType={batteryLevel !== null && batteryLevel > 20 ? "success" : "warning"}
            />
          </View>
        </View>
      )}

      {/* Horizontal Sidebar - Flight Parameters */}
      {!showCompassOverlay && (
        <HorizontalSidebar
          collapsedWidth={60}
          expandedWidth={width/2}
          minWidth={width/2}
          backgroundColor="rgba(0, 0, 0, 0.75)"
          initialWidth={width/2}
          onExpandedChange={(expanded) => {
            setIsSidebarExpanded(expanded);
          }}
          onWidthChange={(width) => {
            setSidebarCurrentWidth(width);
          }}
        >
        <View style={styles.sidebarContent}>
          {/* Flight Direction */}
          {isSidebarExpanded && (
            <View style={styles.parameterSection}>
              <View style={styles.labelRow}>
                <Text style={styles.parameterLabel}>Hướng bay</Text>
              </View>
              <View style={styles.sliderContainer}>
                <View style={styles.customSliderContainer}>
                  {/* Custom track with center point */}
                  <View style={styles.customSliderTrack}>
                    {/* Left side (negative) - inactive */}
                    <View 
                      style={[
                        styles.customSliderTrackSegment,
                        styles.customSliderTrackInactive,
                        { 
                          flex: flightDirection < 0 ? (180 + flightDirection) / 180 : 1 
                        }
                      ]} 
                    />
                    {/* Left side (negative) - active (from center to value) */}
                    {flightDirection < 0 && (
                      <View 
                        style={[
                          styles.customSliderTrackSegment,
                          styles.customSliderTrackActive,
                          { 
                            flex: Math.abs(flightDirection) / 180 
                          }
                        ]} 
                      />
                    )}
                    {/* Center indicator */}
                    <View style={styles.customSliderCenter} />
                    {/* Right side (positive) - active (from center to value) */}
                    {flightDirection > 0 && (
                      <View 
                        style={[
                          styles.customSliderTrackSegment,
                          styles.customSliderTrackActive,
                          { 
                            flex: flightDirection / 180 
                          }
                        ]} 
                      />
                    )}
                    {/* Right side (positive) - inactive */}
                    <View 
                      style={[
                        styles.customSliderTrackSegment,
                        styles.customSliderTrackInactive,
                        { 
                          flex: flightDirection > 0 ? (180 - flightDirection) / 180 : 1 
                        }
                      ]} 
                    />
                  </View>
                  {/* Invisible slider for interaction */}
                  <Slider
                    value={flightDirection}
                    minimumValue={-180}
                    maximumValue={180}
                    step={1}
                    onValueChange={setFlightDirection}
                    style={StyleSheet.absoluteFill}
                    minimumTrackTintColor="transparent"
                    maximumTrackTintColor="transparent"
                    thumbTintColor="#4CAF50"
                  />
                </View>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.valueInput}
                    value={flightDirectionText}
                    onChangeText={(text) => {
                      // Allow any text input for better UX
                      setFlightDirectionText(text);
                      // Try to parse and update value if valid
                      if (text === "" || text === "-") {
                        return;
                      }
                      const num = parseInt(text);
                      if (!isNaN(num)) {
                        if (num >= -180 && num <= 180) {
                          setFlightDirection(num);
                        }
                      }
                    }}
                    onBlur={() => {
                      // Validate and fix on blur
                      const num = parseInt(flightDirectionText);
                      if (isNaN(num) || flightDirectionText === "" || flightDirectionText === "-") {
                        setFlightDirectionText(flightDirection.toString());
                        setFlightDirection(flightDirection);
                      } else {
                        let validNum = num;
                        if (num < -180) validNum = -180;
                        if (num > 180) validNum = 180;
                        setFlightDirection(validNum);
                        setFlightDirectionText(validNum.toString());
                      }
                    }}
                    keyboardType="numeric"
                  />
                  <Text style={styles.unitText}>°</Text>
                </View>
              </View>
              {/* Button to adjust on map */}
              <TouchableOpacity
                style={styles.adjustOnMapButton}
                onPress={() => {
                  // Center camera vào polygon center khi mở la bàn
                  if (polygonCenter && cameraRef.current) {
                    cameraRef.current.setCamera({
                      centerCoordinate: [polygonCenter.longitude, polygonCenter.latitude],
                      zoomLevel: 16,
                      animationDuration: 500,
                    });
                  }
                  setShowCompassOverlay(true);
                }}
              >
                <Text style={styles.adjustOnMapButtonText}>
                  Điều chỉnh trên bản đồ
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Altitude */}
          {isSidebarExpanded && (
            <View style={styles.parameterSection}>
              <View style={styles.labelRow}>
                <Text style={styles.parameterLabel}>Độ cao (m)</Text>
              </View>
              <View style={styles.sliderContainer}>
                <Slider
                  value={altitude}
                  minimumValue={5.5}
                  maximumValue={300}
                  step={0.5}
                  onValueChange={setAltitude}
                  style={styles.slider}
                  minimumTrackTintColor="#4CAF50"
                  maximumTrackTintColor="#333"
                  thumbTintColor="#4CAF50"
                />
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
                        if (num >= 5.5 && num <= 300) {
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
                        if (num < 5.5) validNum = 5.5;
                        if (num > 300) validNum = 300;
                        setAltitude(validNum);
                        setAltitudeText(validNum.toString());
                      }
                    }}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>
          )}

          {/* Preview Flight Direction Checkbox - Ở trên nút Gửi thông tin */}
          {isSidebarExpanded && (
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
                  <Text style={styles.sendButtonIcon}>☁️</Text>
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
              <Text style={styles.iconButtonText}>
                {isUploading ? "⏳" : "☁️↑"}
              </Text>
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
              <Text style={styles.startButtonIcon}>▶</Text>
              <Text style={styles.startButtonText}>Bắt đầu bay</Text>
            </TouchableOpacity>
          )}
        </View>
        </HorizontalSidebar>
      )}

      {/* Compass Overlay */}
      {showCompassOverlay && polygonCenter && (
        <CompassOverlay
          initialAngle={flightDirection}
          centerPosition={polygonCenter}
          mapRef={mapRef}
          onAngleChange={(angle) => {
            const roundedAngle = Math.round(angle);
            setFlightDirection(roundedAngle);
            setFlightDirectionText(roundedAngle.toString());
          }}
          onClose={() => {
            setShowCompassOverlay(false);
          }}
        />
      )}

      {/* WP Progress Dialog */}
      <Modal
        visible={wpDialogVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          // Không cho phép đóng bằng nút back
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Đang gửi mission...</Text>
            <Text style={styles.modalWPText}>Waypoint: {wpValue}</Text>
            <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 20 }} />
          </View>
        </View>
      </Modal>
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
  sidebarContent: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
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
    justifyContent: "flex-end",
  },
  customSliderContainer: {
    flex: 1,
    marginRight: 12,
    height: 40,
    position: "relative",
    justifyContent: "center",
  },
  customSliderTrack: {
    flexDirection: "row",
    height: 4,
    backgroundColor: "#333",
    borderRadius: 2,
    position: "absolute",
    left: 0,
    right: 0,
  },
  customSliderTrackSegment: {
    height: "100%",
  },
  customSliderTrackActive: {
    backgroundColor: "#4CAF50",
  },
  customSliderTrackInactive: {
    backgroundColor: "#333",
  },
  customSliderCenter: {
    width: 2,
    height: 4,
    backgroundColor: "#fff",
    position: "absolute",
    left: "50%",
    marginLeft: -1,
    zIndex: 1,
  },
  slider: {
    flex: 1,
    marginRight: 12,
    height: 40,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 6,
    paddingRight: 8,
    height: 36,
    width: 80,
    justifyContent: "center",
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
  adjustOnMapButton: {
    backgroundColor: "#fff",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  adjustOnMapButtonText: {
    fontSize: 12,
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
    marginLeft: 10,
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
