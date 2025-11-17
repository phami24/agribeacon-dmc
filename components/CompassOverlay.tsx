// components/CompassOverlay.tsx
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  PanResponder,
  Dimensions,
  TouchableOpacity,
  Animated,
} from "react-native";

interface CompassOverlayProps {
  initialAngle: number; // -180 to 180
  centerPosition?: { latitude: number; longitude: number } | null; // Vị trí center của polygon
  mapRef?: React.RefObject<any>; // MapView ref để convert coordinates
  onAngleChange: (angle: number) => void;
  onClose: () => void;
}

export default function CompassOverlay({
  initialAngle,
  centerPosition,
  mapRef,
  onAngleChange,
  onClose,
}: CompassOverlayProps) {
  const [rotationAngle, setRotationAngle] = useState(initialAngle);
  const [dimensions, setDimensions] = useState(Dimensions.get("window"));
  const [compassPosition, setCompassPosition] = useState<{ left: number; top: number } | null>(null);

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

  // Gesture state để vuốt màn hình điều chỉnh hướng
  const startX = useRef(0);
  const startY = useRef(0);
  const startRotationAngle = useRef(initialAngle);
  const isDragging = useRef(false);
  const lastUpdateAngle = useRef(initialAngle);

  // Sync rotationAngle when initialAngle changes (when overlay opens with new value)
  useEffect(() => {
    setRotationAngle(initialAngle);
    startRotationAngle.current = initialAngle;
    lastUpdateAngle.current = initialAngle;
  }, [initialAngle]);

  const compassSize = Math.min(width, height) * 0.6;
  
  // Tính toán vị trí la bàn: vì camera đã center vào polygon center,
  // nên la bàn ở giữa màn hình sẽ đúng với tâm polygon
  // Tuy nhiên, nếu có mapRef, có thể convert chính xác hơn
  useEffect(() => {
    if (centerPosition && mapRef?.current) {
      // Thử convert coordinates sang screen coordinates
      // @rnmapbox/maps có thể có method khác, nhưng vì camera đã center,
      // nên giữa màn hình sẽ đúng
      try {
        // Vì camera đã center vào polygon center, giữa màn hình = polygon center
        setCompassPosition({
          left: (width - compassSize) / 2,
          top: (height - compassSize) / 2,
        });
      } catch {
        // Fallback: giữa màn hình
        setCompassPosition({
          left: (width - compassSize) / 2,
          top: (height - compassSize) / 2,
        });
      }
    } else {
      // Không có centerPosition: giữa màn hình
      setCompassPosition({
        left: (width - compassSize) / 2,
        top: (height - compassSize) / 2,
      });
    }
  }, [centerPosition, mapRef, width, height, compassSize]);

  // La bàn ở giữa màn hình (vì camera đã center vào polygon center)
  const compassLeft = compassPosition?.left ?? (width - compassSize) / 2;
  const compassTop = compassPosition?.top ?? (height - compassSize) / 2;

  // Pan responder để vuốt màn hình điều chỉnh hướng
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        isDragging.current = true;
        const { pageX, pageY } = evt.nativeEvent;
        startX.current = pageX;
        startY.current = pageY;
        startRotationAngle.current = rotationAngle;
        lastUpdateAngle.current = rotationAngle;
      },
      onPanResponderMove: (evt) => {
        if (!isDragging.current) return;

        const { pageX, pageY } = evt.nativeEvent;
        
        // Tính góc từ center của la bàn đến điểm touch
        const compassCenterX = compassLeft + compassSize / 2;
        const compassCenterY = compassTop + compassSize / 2;
        
        // Vector từ center đến điểm touch hiện tại
        const toX = pageX - compassCenterX;
        const toY = pageY - compassCenterY;
        const toAngle = Math.atan2(toY, toX) * (180 / Math.PI);
        
        // Vector từ center đến điểm touch ban đầu
        const fromX = startX.current - compassCenterX;
        const fromY = startY.current - compassCenterY;
        const fromAngle = Math.atan2(fromY, fromX) * (180 / Math.PI);
        
        // Tính góc quay (delta) - góc mà người dùng đã vuốt
        let angleDelta = toAngle - fromAngle;
        
        // Normalize to -180 to 180
        while (angleDelta > 180) angleDelta -= 360;
        while (angleDelta < -180) angleDelta += 360;
        
        // Giảm sensitivity: nhân với hệ số 0.4 để vuốt chậm hơn
        angleDelta = angleDelta * 0.4;
        
        // Tính góc mới của la bàn
        let newAngle = startRotationAngle.current + angleDelta;
        
        // Normalize to -180 to 180
        while (newAngle > 180) newAngle -= 360;
        while (newAngle < -180) newAngle += 360;

        // Chỉ update nếu góc thay đổi đáng kể (tránh lag)
        const angleDiff = Math.abs(newAngle - lastUpdateAngle.current);
        const normalizedAngleDiff = Math.min(angleDiff, 360 - angleDiff);
        
        if (normalizedAngleDiff > 0.5) {
          lastUpdateAngle.current = newAngle;
          setRotationAngle(newAngle);
          onAngleChange(newAngle);
        }
      },
      onPanResponderRelease: () => {
        isDragging.current = false;
      },
      onPanResponderTerminate: () => {
        isDragging.current = false;
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
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
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
});

