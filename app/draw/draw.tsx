// app/draw/draw.tsx
import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  Alert,
  Modal,
  GestureResponderEvent,
  Image,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import MapboxGL from "@rnmapbox/maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ScreenOrientation from "expo-screen-orientation";
import { usePolygonStore } from "../../store/polygonStore";
import { useBLE } from "../../module/ble/hooks/useBLE";
import { useBLEStoreSync } from "../../hooks/useBLEStoreSync";
import { useDroneDataStore } from "../../store/droneDataStore";
import * as BleConstants from "../../constants/BLEConstants";

const { width, height } = Dimensions.get("window");

interface Point {
  id: string;
  latitude: number;
  longitude: number;
}

type HistoryAction = 
  | { type: "add"; point: Point }
  | { type: "delete"; point: Point } // Lưu cả điểm để có thể undo
  | { type: "move"; pointId: string; oldCoords: { longitude: number; latitude: number }; newCoords: { longitude: number; latitude: number } }
  | { type: "state"; points: Point[] }; // Lưu toàn bộ state (dùng cho drag)

export default function DrawScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapboxGL.MapView>(null);
  const cameraRef = useRef<MapboxGL.Camera>(null);
  
  // BLE setup - KHÔNG sync store để giảm lag (chỉ cần connection state)
  const { connectionState } = useBLE();
  
  // Lấy HOME position từ store (dùng chung)
  const homePosition = useDroneDataStore((state) => state.homePosition);
  const hasReceivedHome = useDroneDataStore((state) => state.hasReceivedHome);
  
  const hasFocusedHomeRef = useRef(false); // Đánh dấu đã focus HOME lần đầu
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  
  const [points, setPoints] = useState<Point[]>([]);
  const [history, setHistory] = useState<HistoryAction[]>([]);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pointToDelete, setPointToDelete] = useState<string | null>(null);
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const [dragStartCoords, setDragStartCoords] = useState<{ longitude: number; latitude: number } | null>(null);
  const [hasSavedDragState, setHasSavedDragState] = useState(false); // Track xem đã lưu state cho lần drag hiện tại chưa
  const setPolygonPoints = usePolygonStore((state) => state.setPoints);

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
      
      return () => {
        // Keep locked
      };
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

  // Undo - undo từng thao tác một
  const handleUndo = () => {
    // Reset drag state nếu đang drag
    if (draggingPointId) {
      setDraggingPointId(null);
      setDragStartCoords(null);
      setHasSavedDragState(false);
    }
    
    if (history.length > 0) {
      const lastAction = history[history.length - 1];
      setHistory((prev) => prev.slice(0, -1));
      
      // Undo action
      let updatedPoints: Point[] = [];
      if (lastAction.type === "add") {
        // Undo add: xóa điểm vừa thêm
        updatedPoints = points.filter((p) => p.id !== lastAction.point.id);
      } else if (lastAction.type === "delete") {
        // Undo delete: thêm lại điểm đã xóa
        updatedPoints = [...points, lastAction.point];
      } else if (lastAction.type === "move") {
        // Undo move: di chuyển điểm về vị trí cũ
        updatedPoints = points.map((p) =>
          p.id === lastAction.pointId
            ? { ...p, longitude: lastAction.oldCoords.longitude, latitude: lastAction.oldCoords.latitude }
            : p
        );
      } else if (lastAction.type === "state") {
        // Undo state: restore lại toàn bộ state (dùng cho drag)
        updatedPoints = lastAction.points;
      }
      
      // Sắp xếp lại các điểm sau khi undo (trừ khi là state - đã được sắp xếp rồi)
      if (updatedPoints.length > 0 && lastAction.type !== "state") {
        const orderedPoints = orderSimplePolygon(updatedPoints);
        setPoints(orderedPoints);
      } else {
        setPoints(updatedPoints);
      }
    }
  };

  // Clear all
  const handleClearAll = () => {
    Alert.alert(
      "Xóa tất cả",
      "Bạn có chắc chắn muốn xóa tất cả các điểm?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: () => {
            // Lưu tất cả các điểm vào history để có thể undo
            points.forEach((point) => {
              setHistory((prev) => [...prev, { type: "delete", point }]);
            });
            setPoints([]);
          },
        },
      ]
    );
  };

  // Toggle delete mode
  const handleToggleDeleteMode = () => {
    setIsDeleteMode((prev) => !prev);
  };

  // Handle map press - always add point (đã deprecated, dùng onPress của MapView)
  const handleMapPress = (feature: any) => {
    // Always allow drawing when clicking on map
    const coordinates = feature.geometry.coordinates;
    const newPoint: Point = {
      id: Date.now().toString(),
      longitude: coordinates[0],
      latitude: coordinates[1],
    };
    // Lưu action vào history
    setHistory((prev) => [...prev, { type: "add", point: newPoint }]);
    setPoints((prev) => [...prev, newPoint]);
  };

  // Confirm delete point
  const confirmDeletePoint = () => {
    if (pointToDelete) {
      const pointToDeleteData = points.find((p) => p.id === pointToDelete);
      if (pointToDeleteData) {
        // Lưu action vào history với thông tin điểm đầy đủ
        setHistory((prev) => [...prev, { type: "delete", point: pointToDeleteData }]);
        
        // Xóa điểm và sắp xếp lại
        const updatedPoints = points.filter((p) => p.id !== pointToDelete);
        if (updatedPoints.length >= 3) {
          const orderedPoints = orderSimplePolygon(updatedPoints);
          setPoints(orderedPoints);
        } else {
          setPoints(updatedPoints);
        }
      }
      setPointToDelete(null);
      setShowDeleteDialog(false);
    }
  };

  // Order points to form a simple polygon by sorting around centroid
  // Logic từ Flutter: sắp xếp các điểm theo góc từ centroid để tạo polygon đơn giản
  const orderSimplePolygon = (pointsToSort: Point[]): Point[] => {
    if (pointsToSort.length < 3) return [...pointsToSort];
    
    // Tính centroid (tâm của polygon)
    let cx = 0;
    let cy = 0;
    for (const p of pointsToSort) {
      cx += p.longitude;
      cy += p.latitude;
    }
    cx /= pointsToSort.length;
    cy /= pointsToSort.length;
    
    // Sắp xếp các điểm theo góc từ centroid
    const sorted = [...pointsToSort];
    sorted.sort((a, b) => {
      const angleA = Math.atan2(a.latitude - cy, a.longitude - cx);
      const angleB = Math.atan2(b.latitude - cy, b.longitude - cx);
      return angleA - angleB;
    });
    
    return sorted;
  };

  // Get polygon coordinates for rendering - Memoize để tránh tính toán lại
  const getPolygonCoordinates = React.useMemo(() => {
    if (points.length < 3) return [];
    return [...points.map((p) => [p.longitude, p.latitude]), [points[0].longitude, points[0].latitude]];
  }, [points]);

  // Save polygon to store whenever points change - Debounce để tránh update quá nhiều
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (points.length >= 3) {
        setPolygonPoints(points);
      } else {
        // Clear store if less than 3 points
        setPolygonPoints([]);
      }
    }, 100); // Debounce 100ms để tránh update quá nhiều khi drag/đang vẽ
    
    return () => clearTimeout(timer);
  }, [points, setPolygonPoints]);

  // Save current state to history (dùng cho drag - lưu toàn bộ state)
  const saveStateToHistory = useCallback(() => {
    setHistory((prev) => [
      ...prev,
      { type: "state", points: [...points] },
    ]);
    // Giới hạn history tối đa 50 lần
    setHistory((prev) => {
      if (prev.length > 50) {
        return prev.slice(prev.length - 50);
      }
      return prev;
    });
  }, [points]);

  // Handle point drag start - lưu state trước khi bắt đầu drag
  const handlePointDragStart = useCallback((pointId: string) => {
    // Lưu state trước khi bắt đầu drag điểm (chỉ lưu 1 lần cho mỗi lần drag)
    if (!hasSavedDragState) {
      saveStateToHistory();
      setHasSavedDragState(true);
    }
    
    // Lưu start coords
    const point = points.find((p) => p.id === pointId);
    if (point) {
      setDraggingPointId(pointId);
      setDragStartCoords({ longitude: point.longitude, latitude: point.latitude });
    }
  }, [hasSavedDragState, points, saveStateToHistory]);

  // Handle point drag - always allow dragging, then reorder points
  const handlePointDrag = (pointId: string, newCoordinates: [number, number]) => {
    // Nếu đây là lần đầu drag điểm này, lưu state vào history
    if (draggingPointId !== pointId) {
      handlePointDragStart(pointId);
    }
    
    // OPTIMISTIC UPDATE: Update điểm ngay lập tức (không sắp xếp) để có visual feedback
    setPoints((currentPoints) =>
      currentPoints.map((p) =>
        p.id === pointId
          ? { ...p, longitude: newCoordinates[0], latitude: newCoordinates[1] }
          : p
      )
    );
    
    // Sắp xếp lại các điểm sau (defer để không block UI khi drag)
    // Chỉ sắp xếp khi có >= 3 điểm
    setTimeout(() => {
      setPoints((currentPoints) => {
        if (currentPoints.length >= 3) {
          return orderSimplePolygon(currentPoints);
        }
        return currentPoints;
      });
    }, 50); // Delay nhỏ để không block drag gesture
  };

  // Handle point drag end - reset flag
  const handlePointDragEnd = useCallback(() => {
    setHasSavedDragState(false); // Reset flag khi kết thúc drag
    setDraggingPointId(null);
    setDragStartCoords(null);
  }, []);

  // Handle map touch - from ShapeSource onPress
  const handleMapTouch = useCallback((event: any) => {
    if (isDeleteMode) return;
    
    // Reset drag state trước khi thêm điểm mới
    if (draggingPointId) {
      handlePointDragEnd();
    }
    
    // Get coordinates from event - ShapeSource onPress provides geometry with coordinates
    const feature = event.features?.[0];
    if (feature && feature.geometry) {
      let pointCoords: number[] | null = null;
      
      // Try to get coordinates from different possible structures
      if (feature.geometry.coordinates) {
        const coords = feature.geometry.coordinates;
        if (Array.isArray(coords)) {
          // Polygon coordinates: [[[lng, lat], ...]]
          if (Array.isArray(coords[0])) {
            if (Array.isArray(coords[0][0])) {
              // Polygon ring
              pointCoords = coords[0][0];
            } else if (typeof coords[0][0] === 'number') {
              // Point array [lng, lat]
              pointCoords = coords[0];
            }
          } else if (typeof coords[0] === 'number') {
            // Direct point [lng, lat]
            pointCoords = coords;
          }
        }
      }
      
      // Alternative: try to get from properties or use mapRef to convert
      if (!pointCoords && mapRef.current && event.geometry) {
        // Fallback: use mapRef to get coordinates (if we have screen coordinates)
        // This might not work with ShapeSource onPress, but worth trying
      }
      
      if (pointCoords && pointCoords.length >= 2) {
        const newPoint: Point = {
          id: Date.now().toString(),
          longitude: pointCoords[0],
          latitude: pointCoords[1],
        };
        // Lưu action vào history
        setHistory((prev) => [...prev, { type: "add", point: newPoint }]);
        
        // Thêm điểm mới vào danh sách
        const updatedPoints = [...points, newPoint];
        
        // Sắp xếp lại các điểm để tạo polygon đơn giản
        const orderedPoints = orderSimplePolygon(updatedPoints);
        
        // Update state với các điểm đã sắp xếp
        setPoints(orderedPoints);
      }
    }
  }, [isDeleteMode, draggingPointId, handlePointDragEnd, points, orderSimplePolygon]);

  return (
    <View style={styles.container}>
      {/* Map View */}
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
        onPress={(feature: any) => {
          // Handle map press to add point - chỉ khi không ở delete mode
          if (!isDeleteMode && feature?.geometry) {
            const geometry = feature.geometry;
            let pointCoords: number[] | null = null;
            
            // Try to get coordinates from different geometry types
            if (geometry.type === 'Point' && geometry.coordinates) {
              pointCoords = geometry.coordinates;
            } else if (geometry.type === 'Polygon' && geometry.coordinates) {
              // Get first point of polygon
              const coords = geometry.coordinates;
              if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
                pointCoords = coords[0][0];
              }
            }
            
            if (pointCoords && pointCoords.length >= 2) {
              // Reset drag state trước khi thêm điểm mới
              if (draggingPointId) {
                handlePointDragEnd();
              }
              
              const newPoint: Point = {
                id: Date.now().toString(),
                longitude: pointCoords[0],
                latitude: pointCoords[1],
              };
              
              // OPTIMISTIC UPDATE: Thêm điểm ngay lập tức (không sắp xếp) để có visual feedback
              setPoints((prev) => [...prev, newPoint]);
              
              // Lưu action vào history
              setHistory((prev) => [...prev, { type: "add", point: newPoint }]);
              
              // Sắp xếp lại các điểm sau (defer để không block UI)
              // Chỉ sắp xếp nếu có >= 3 điểm
              setTimeout(() => {
                setPoints((currentPoints) => {
                  if (currentPoints.length >= 3) {
                    return orderSimplePolygon(currentPoints);
                  }
                  return currentPoints;
                });
              }, 0);
            }
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


        {/* Render polygon if we have at least 3 points */}
        {points.length >= 3 && getPolygonCoordinates.length > 0 && (
          <MapboxGL.ShapeSource
            id="drawing-polygon"
            shape={{
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [getPolygonCoordinates],
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
        )}

        {/* Render points - Memoize để tránh re-render không cần thiết */}
        {points.map((point) => {
          const isDelete = isDeleteMode;
          return (
            <MapboxGL.PointAnnotation
              key={point.id}
              id={`point-${point.id}`}
              coordinate={[point.longitude, point.latitude]}
              draggable={true}
              onDrag={(feature) => {
                const coords = feature.geometry.coordinates as [number, number];
                handlePointDrag(point.id, coords);
              }}
              onDragEnd={() => {
                // Kết thúc drag - reset flag và sắp xếp lại
                handlePointDragEnd();
                // Đảm bảo sắp xếp lại sau khi drag xong
                setPoints((currentPoints) => {
                  if (currentPoints.length >= 3) {
                    return orderSimplePolygon(currentPoints);
                  }
                  return currentPoints;
                });
              }}
              onSelected={() => {
                if (isDelete) {
                  setPointToDelete(point.id);
                  setShowDeleteDialog(true);
                }
              }}
            >
              <View style={styles.pointMarker}>
                <View
                  style={[
                    styles.pointCircle,
                    isDelete && styles.pointCircleDelete,
                  ]}
                />
              </View>
            </MapboxGL.PointAnnotation>
          );
        })}
      </MapboxGL.MapView>


      {/* Back Button */}
      <TouchableOpacity
        style={[styles.backButton, { top: insets.top + 10 }]}
        onPress={() => router.push("/mission")}
      >
        <View style={styles.backButtonCircle}>
          <Text style={styles.backButtonIcon}>←</Text>
        </View>
      </TouchableOpacity>

      {/* Center Buttons - Undo, Delete Mode, Clear All */}
      <View style={styles.centerButtons}>
        {/* Undo Button */}
        <TouchableOpacity
          style={[styles.iconButton, styles.undoButton]}
          onPress={handleUndo}
          disabled={history.length === 0}
        >
          <Text style={styles.iconButtonText}>↶</Text>
        </TouchableOpacity>

        {/* Delete Mode Toggle Button - Center */}
        <TouchableOpacity
          style={[
            styles.iconButton,
            styles.deleteButton,
            isDeleteMode && styles.deleteButtonActive,
          ]}
          onPress={handleToggleDeleteMode}
        >
          <Text style={styles.iconButtonText}>🗑️</Text>
        </TouchableOpacity>

        {/* Clear All Button */}
        <TouchableOpacity
          style={[styles.iconButton, styles.clearButton]}
          onPress={handleClearAll}
          disabled={points.length === 0}
        >
          <Text style={styles.iconButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Right Button */}
      <TouchableOpacity
        style={[styles.bottomRightButton, { bottom: insets.bottom + 20 }]}
        onPress={() => router.push("/mission/parameters")}
      >
        <Text style={styles.bottomRightButtonText}>Cài đặt thông số bay</Text>
        <Text style={styles.bottomRightButtonIcon}>→</Text>
      </TouchableOpacity>

      {/* Delete Confirmation Dialog */}
      <Modal
        visible={showDeleteDialog}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowDeleteDialog(false);
          setPointToDelete(null);
        }}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogContainer}>
            <Text style={styles.dialogTitle}>Xóa điểm</Text>
            <Text style={styles.dialogMessage}>
              Bạn có chắc chắn muốn xóa điểm này?
            </Text>
            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={[styles.dialogButton, styles.dialogButtonCancel]}
                onPress={() => {
                  setShowDeleteDialog(false);
                  setPointToDelete(null);
                }}
              >
                <Text style={styles.dialogButtonTextCancel}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogButton, styles.dialogButtonConfirm]}
                onPress={confirmDeletePoint}
              >
                <Text style={styles.dialogButtonTextConfirm}>Xóa</Text>
              </TouchableOpacity>
            </View>
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
  centerButtons: {
    position: "absolute",
    right: 16,
    top: 0,
    bottom: 0,
    zIndex: 10,
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  undoButton: {
    opacity: 1,
  },
  clearButton: {
    backgroundColor: "#ff4444",
  },
  deleteButton: {
    backgroundColor: "#ffffff",
  },
  deleteButtonActive: {
    backgroundColor: "#FFD700", // Màu vàng khi active
  },
  iconButtonText: {
    fontSize: 20,
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
  pointMarker: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  pointCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#2196F3",
    borderWidth: 2,
    borderColor: "#fff",
  },
  pointCircleDelete: {
    backgroundColor: "#ff4444",
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  dialogContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    width: width * 0.8,
    maxWidth: 400,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    color: "#000",
  },
  dialogMessage: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },
  dialogButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  dialogButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  dialogButtonCancel: {
    backgroundColor: "#f0f0f0",
  },
  dialogButtonConfirm: {
    backgroundColor: "#ff4444",
  },
  dialogButtonTextCancel: {
    color: "#000",
    fontSize: 14,
    fontWeight: "600",
  },
  dialogButtonTextConfirm: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
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

