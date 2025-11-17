// components/CustomSlider.tsx
import React, { useRef, useState } from "react";
import { View, StyleSheet, PanResponder, TouchableOpacity } from "react-native";

interface CustomSliderProps {
  value: number;
  minimumValue: number;
  maximumValue: number;
  onValueChange: (value: number) => void;
  step?: number; // Step size for snapping
  minimumTrackTintColor?: string;
  maximumTrackTintColor?: string;
  thumbTintColor?: string;
  style?: any;
}

export default function CustomSlider({
  value,
  minimumValue,
  maximumValue,
  onValueChange,
  step = 1,
  minimumTrackTintColor = "#4CAF50",
  maximumTrackTintColor = "#333",
  thumbTintColor = "#4CAF50",
  style,
}: CustomSliderProps) {
  const sliderRef = useRef<View>(null);
  const [sliderLayout, setSliderLayout] = useState({ x: 0, width: 0 });
  const startValueRef = useRef(value);
  const startXRef = useRef(0);

  const percentage = ((value - minimumValue) / (maximumValue - minimumValue)) * 100;

  const snapToStep = (val: number): number => {
    if (step <= 0) return val;
    const stepped = Math.round((val - minimumValue) / step) * step + minimumValue;
    return Math.max(minimumValue, Math.min(maximumValue, stepped));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Chỉ phản hồi với swipe ngang (dx lớn hơn dy)
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 5;
      },
      onPanResponderGrant: (evt) => {
        startValueRef.current = value;
        startXRef.current = evt.nativeEvent.pageX;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (sliderLayout.width === 0) return;
        
        // Calculate new value based on gesture
        const deltaX = gestureState.dx;
        const deltaValue = (deltaX / sliderLayout.width) * (maximumValue - minimumValue);
        let newValue = startValueRef.current + deltaValue;
        
        // Clamp to range
        newValue = Math.max(minimumValue, Math.min(maximumValue, newValue));
        
        // Snap to step
        newValue = snapToStep(newValue);
        
        onValueChange(newValue);
      },
      onPanResponderTerminationRequest: () => false, // Prevent termination
      onPanResponderRelease: () => {
        // Final snap to step
        const snappedValue = snapToStep(value);
        if (Math.abs(snappedValue - value) > 0.01) {
          onValueChange(snappedValue);
        }
      },
    })
  ).current;

  return (
    <View
      ref={sliderRef}
      style={[styles.sliderWrapper, style]}
      onLayout={(e) => {
        const { x, width } = e.nativeEvent.layout;
        setSliderLayout({ x, width });
      }}
      collapsable={false}
      {...panResponder.panHandlers}
    >
      <View 
        style={[styles.sliderTrack, { backgroundColor: maximumTrackTintColor }]}
        pointerEvents="none"
      >
        <View
          style={[
            styles.sliderFill,
            { width: `${percentage}%`, backgroundColor: minimumTrackTintColor },
          ]}
        />
        <View
          style={[
            styles.sliderThumb,
            { left: `${percentage}%`, backgroundColor: thumbTintColor },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sliderWrapper: {
    height: 40,
    justifyContent: "center",
    position: "relative",
  },
  sliderTrack: {
    height: 4,
    borderRadius: 2,
    position: "relative",
  },
  sliderFill: {
    height: 4,
    borderRadius: 2,
    position: "absolute",
    left: 0,
    top: 0,
  },
  sliderThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    position: "absolute",
    top: -8,
    marginLeft: -10,
  },
});

