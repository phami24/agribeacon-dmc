// components/CompassOverlay.tsx
import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  Dimensions,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const COMPASS_SIZE_RATIO = 0.65;
const MIN_DRAG_DISTANCE_RATIO = 0.08;
const DRAG_ACTIVATION_DISTANCE_RATIO = 0.02;
const DRAG_ACTIVATION_MIN_PX = 12;
const ROTATION_GAIN = 1.35;

interface CompassOverlayProps {
  initialAngle: number; // -180 to 180
  onAngleChange: (angle: number) => void;
  onClose: () => void;
}

export default function CompassOverlay({
  initialAngle,
  onAngleChange,
  onClose,
}: CompassOverlayProps) {
  const [rotationAngle, setRotationAngle] = useState(initialAngle);
  const [dimensions, setDimensions] = useState(() => Dimensions.get("window"));
  const [compassPosition, setCompassPosition] = useState<{ left: number; top: number } | null>(null);
  const [compassSize, setCompassSize] = useState(() => {
    const { width, height } = Dimensions.get("window");
    return Math.min(width, height) * COMPASS_SIZE_RATIO;
  });

  // Update dimensions when screen changes
  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setDimensions(window);
    });
    
    // Also update on mount to ensure correct dimensions
    setDimensions(Dimensions.get("window"));
    
    return () => subscription?.remove();
  }, []);

  const { width, height } = dimensions;

  const isDragging = useRef(false);
  const dragActivatedRef = useRef(false);
  const initialTouchRef = useRef<{ x: number; y: number } | null>(null);
  const lastTouchAngleRef = useRef<number | null>(null);
  const rotationAngleRef = useRef(initialAngle);

  // Sync rotationAngle when initialAngle changes (when overlay opens with new value)
  useEffect(() => {
    setRotationAngle(initialAngle);
    rotationAngleRef.current = initialAngle;
  }, [initialAngle]);

  // Luôn giữ kích thước la bàn lớn, cố định theo màn hình
  useEffect(() => {
    setCompassSize(Math.min(dimensions.width, dimensions.height) * COMPASS_SIZE_RATIO);
  }, [dimensions]);
  
  // Luôn đặt la bàn ở giữa màn hình để dễ thao tác
  useEffect(() => {
    setCompassPosition({
      left: (width - compassSize) / 2,
      top: (height - compassSize) / 2,
    });
  }, [width, height, compassSize]);

  // La bàn ở giữa màn hình (vì camera đã center vào polygon center)
  const compassLeft = compassPosition?.left ?? (width - compassSize) / 2;
  const compassTop = compassPosition?.top ?? (height - compassSize) / 2;
  const compassCenter = useMemo(() => ({
    x: compassLeft + compassSize / 2,
    y: compassTop + compassSize / 2,
  }), [compassLeft, compassTop, compassSize]);

  const dragThreshold = compassSize * MIN_DRAG_DISTANCE_RATIO;
  const dragActivationDistance = useMemo(
    () => Math.max(DRAG_ACTIVATION_MIN_PX, compassSize * DRAG_ACTIVATION_DISTANCE_RATIO),
    [compassSize]
  );

  const calculateAngleFromTouch = useCallback((pageX: number, pageY: number, ignoreThreshold = false) => {
    const dx = pageX - compassCenter.x;
    const dy = pageY - compassCenter.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (!ignoreThreshold && distance < dragThreshold) {
      return null;
    }

    const radians = Math.atan2(dx, -dy);
    let degrees = radians * (180 / Math.PI);
    if (degrees > 180) degrees -= 360;
    if (degrees < -180) degrees += 360;
    return degrees;
  }, [compassCenter, dragThreshold]);

  const normalizeAngle = useCallback((angle: number) => {
    let normalized = angle;
    while (normalized > 180) normalized -= 360;
    while (normalized < -180) normalized += 360;
    return normalized;
  }, []);

  // Chỉ cập nhật state để hiển thị, không gọi onAngleChange (để tránh vẽ line liên tục)
  const updateRotation = useCallback((angle: number) => {
    const normalized = normalizeAngle(angle);
    rotationAngleRef.current = normalized;
    setRotationAngle(normalized);
    // KHÔNG gọi onAngleChange ở đây - chỉ gọi khi đóng la bàn
  }, [normalizeAngle]);

  const hasMovedEnough = useCallback((pageX: number, pageY: number) => {
    const start = initialTouchRef.current;
    if (!start) return false;
    const dx = pageX - start.x;
    const dy = pageY - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance >= dragActivationDistance;
  }, [dragActivationDistance]);

  // Pan responder để vuốt màn hình điều chỉnh hướng
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => evt.nativeEvent.touches?.length === 1,
      onMoveShouldSetPanResponder: (evt) => evt.nativeEvent.touches?.length === 1,
      onPanResponderGrant: (evt) => {
        if (evt.nativeEvent.touches?.length !== 1) {
          isDragging.current = false;
          return;
        }
        const touch = evt.nativeEvent.touches[0];
        const angle = calculateAngleFromTouch(touch.pageX, touch.pageY);
        if (angle === null) {
          isDragging.current = false;
          return;
        }
        isDragging.current = true;
        dragActivatedRef.current = false;
        initialTouchRef.current = { x: touch.pageX, y: touch.pageY };
        lastTouchAngleRef.current = angle;
      },
      onPanResponderMove: (evt) => {
        if (!isDragging.current || evt.nativeEvent.touches?.length !== 1) return;

        const touch = evt.nativeEvent.touches[0];
        if (!dragActivatedRef.current) {
          if (!hasMovedEnough(touch.pageX, touch.pageY)) {
            return;
          }
          dragActivatedRef.current = true;
        }
        const angle = calculateAngleFromTouch(touch.pageX, touch.pageY, true);
        if (angle === null) return;
        if (lastTouchAngleRef.current === null) {
          lastTouchAngleRef.current = angle;
          return;
        }
        const delta = normalizeAngle(angle - lastTouchAngleRef.current) * ROTATION_GAIN;
        const baseAngle = rotationAngleRef.current;
        const targetAngle = baseAngle + delta;
        updateRotation(targetAngle);
        lastTouchAngleRef.current = angle;
      },
      onPanResponderRelease: () => {
        isDragging.current = false;
        dragActivatedRef.current = false;
        initialTouchRef.current = null;
        lastTouchAngleRef.current = null;
      },
      onPanResponderTerminate: () => {
        isDragging.current = false;
        dragActivatedRef.current = false;
        initialTouchRef.current = null;
        lastTouchAngleRef.current = null;
      },
    })
  ).current;

  return (
    <>
      {/* Overlay background - chặn touch để không di chuyển map */}
      <View 
        style={styles.overlay} 
        {...panResponder.panHandlers}
      />
      
      {/* Close button */}
      <TouchableOpacity 
        style={styles.closeButton} 
        onPress={() => {
          // Gọi onAngleChange với giá trị cuối cùng trước khi đóng
          const finalAngle = normalizeAngle(rotationAngleRef.current);
          onAngleChange(finalAngle);
          onClose();
        }}
      >
        <Text style={styles.closeButtonText}>✕</Text>
      </TouchableOpacity>

      {/* Compass container - có thể vuốt để điều chỉnh */}
      <View
        style={[
          styles.compassContainer,
          {
            width: compassSize,
            height: compassSize,
            left: compassLeft,
            top: compassTop,
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Outer ring - Geo North (static) */}
        <Image
          source={require("../assets/nautical_compass_rose_geo_north.png")}
          style={[styles.compassRing, { width: compassSize, height: compassSize }]}
          resizeMode="contain"
        />

        {/* Inner ring - Magnetic North (rotating) */}
        <Image
          source={require("../assets/nautical_compass_rose_mag_north.png")}
          style={[
            styles.rotatingContainer,
            {
              width: compassSize,
              height: compassSize,
              transform: [{ rotate: `${rotationAngle}deg` }],
            },
          ]}
          resizeMode="contain"
        />

        <View pointerEvents="none" style={styles.angleReadout}>
          <Text style={styles.angleText}>{`${Math.round(rotationAngle)}°`}</Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    zIndex: 1000,
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1002,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  closeButtonText: {
    fontSize: 24,
    color: "#000",
    fontWeight: "bold",
  },
  compassContainer: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1001,
  },
  compassRing: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  rotatingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  angleReadout: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
  },
  angleText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#E50083",
    textShadowColor: "rgba(0, 0, 0, 0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

