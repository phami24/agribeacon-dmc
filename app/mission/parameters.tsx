// app/mission/parameters.tsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  useWindowDimensions,
  Linking,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import MapboxGL from "@rnmapbox/maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ScreenOrientation from "expo-screen-orientation";
import HorizontalSidebar from "../../components/HorizontalSidebar";
import StatusCard from "../../components/StatusCard";
import StatusIndicator from "../../components/StatusIndicator";
import CompassOverlay from "../../components/CompassOverlay";
import BluetoothConnectButton from "../../components/BluetoothConnectButton";
import { usePolygonStore } from "../../store/polygonStore";
import { generateOptimizedPath } from "../../services/pathGenerator";
import { useBLE } from "../../module/ble/hooks/useBLE";
import { useBLEStoreSync } from "../../hooks/useBLEStoreSync";
import { useDroneDataStore } from "../../store/droneDataStore";
import { bleService } from "../../module/ble/services";
import * as BleConstants from "../../constants/BLEConstants";
import { State } from "react-native-ble-plx";

interface Point {
  id: string;
  latitude: number;
  longitude: number;
}

const ALTITUDE_MIN = 5.5;
const ALTITUDE_MAX = 300;
const ALTITUDE_STEP = 0.5;
const COMPASS_FOCUS_ZOOM = 19.3;

export default function FlightParametersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const SIDEBAR_TARGET_WIDTH = Math.min(Math.max(windowWidth * 0.45, 320), windowWidth - 24);
  const mapRef = useRef<MapboxGL.MapView>(null);
  const cameraRef = useRef<MapboxGL.Camera>(null);

  // BLE setup
  useBLEStoreSync();
  const { 
    connectionState, 
    writeCharacteristic, 
    isScanning, 
    error: bleError,
    devices,
    startScan 
  } = useBLE();
  
  // Lấy dữ liệu từ store (dùng chung)
  const batteryLevel = useDroneDataStore((state) => state.batteryLevel);
  const isReady = useDroneDataStore((state) => state.isReady);
  const homePosition = useDroneDataStore((state) => state.homePosition);
  const hasReceivedHome = useDroneDataStore((state) => state.hasReceivedHome);
  const wp = useDroneDataStore((state) => state.wp);
  
  const hasFocusedHomeRef = useRef(false); // Đánh dấu đã focus HOME lần đầu
  const hasTriedAutoConnectRef = useRef(false); // Đánh dấu đã thử auto-connect chưa
  const hasShownBluetoothDialogRef = useRef(false); // Đánh dấu đã hiển thị dialog yêu cầu bật Bluetooth chưa
  
  // Status states
  const [flightTime, setFlightTime] = useState("50 phút");
  const [distance, setDistance] = useState("200 m");

  // Flight parameters
  const [flightDirection, setFlightDirection] = useState(0);
  const [altitude, setAltitude] = useState(ALTITUDE_MIN);
  const [altitudeText, setAltitudeText] = useState(ALTITUDE_MIN.toString());
  const [previewFlightDirection, setPreviewFlightDirection] = useState(false);
  const [showCompassOverlay, setShowCompassOverlay] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [wpDialogVisible, setWpDialogVisible] = useState(false);
  const [wpValue, setWpValue] = useState<string>("");
  const [isUploaded, setIsUploaded] = useState(false);
  const wpCheckTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Debounced values để tránh generate waypoints liên tục khi đang kéo slider
  const [debouncedFlightDirection, setDebouncedFlightDirection] = useState(0);
  const [debouncedAltitude, setDebouncedAltitude] = useState(ALTITUDE_MIN);
  const handleAltitudeAdjust = useCallback((delta: number) => {
    setAltitude((prev) => {
      let next = prev + delta;
      if (next < ALTITUDE_MIN) next = ALTITUDE_MIN;
      if (next > ALTITUDE_MAX) next = ALTITUDE_MAX;
      const precision = 1 / ALTITUDE_STEP;
      next = Math.round(next * precision) / precision;
      return parseFloat(next.toFixed(2));
    });
  }, []);

  const canDecreaseAltitude = altitude - ALTITUDE_MIN > 1e-6;
  const canIncreaseAltitude = ALTITUDE_MAX - altitude > 1e-6;

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [sidebarCurrentWidth, setSidebarCurrentWidth] = useState(SIDEBAR_TARGET_WIDTH);

  useEffect(() => {
    setSidebarCurrentWidth(SIDEBAR_TARGET_WIDTH);
  }, [SIDEBAR_TARGET_WIDTH]);
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

  const polygonBounds = useMemo(() => {
    if (!orderedAndClosedPolygon || orderedAndClosedPolygon.length < 3) return null;
    const points = orderedAndClosedPolygon.slice(0, -1);
    let minLat = Number.POSITIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;
    let minLon = Number.POSITIVE_INFINITY;
    let maxLon = Number.NEGATIVE_INFINITY;

    for (const p of points) {
      if (p.latitude < minLat) minLat = p.latitude;
      if (p.latitude > maxLat) maxLat = p.latitude;
      if (p.longitude < minLon) minLon = p.longitude;
      if (p.longitude > maxLon) maxLon = p.longitude;
    }

    return {
      minLatitude: minLat,
      maxLatitude: maxLat,
      minLongitude: minLon,
      maxLongitude: maxLon,
    };
  }, [orderedAndClosedPolygon]);

  const getCompassZoomLevel = useCallback(() => {
    if (!polygonBounds) return COMPASS_FOCUS_ZOOM;
    const latSpan = polygonBounds.maxLatitude - polygonBounds.minLatitude;
    const lonSpan = polygonBounds.maxLongitude - polygonBounds.minLongitude;
    const span = Math.max(latSpan, lonSpan);

    if (span < 0.0003) return 20;
    if (span < 0.0008) return 19.2;
    if (span < 0.0015) return 18.7;
    if (span < 0.003) return 18.2;
    return 17.5;
  }, [polygonBounds]);

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
            <BluetoothConnectButton
              connectionState={connectionState}
              isScanning={isScanning}
              onPress={async () => {
                try {
                  // Nếu đã kết nối thì không làm gì
                  if (connectionState?.isConnected) {
                    return;
                  }

                  // Kiểm tra Bluetooth state
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

                  // Request permissions và scan
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
          {/* Flight Direction */}
          {isSidebarExpanded && (
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
                    const zoomLevel = getCompassZoomLevel();
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

          {/* Altitude */}
          {isSidebarExpanded && (
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
        </ScrollView>
        </HorizontalSidebar>
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
