// components/HorizontalSidebar.tsx
// Component cho màn hình ngang (landscape) - Sidebar ở bên phải, full height
import React, { useRef, useState, useCallback, useMemo, useEffect } from "react";
import {
    Animated,
    StyleSheet,
    View,
    TouchableOpacity,
    Text,
    useWindowDimensions,
} from "react-native";

const TOGGLE_BUTTON_SIZE = 40;

interface HorizontalSidebarProps {
  children: React.ReactNode;
  collapsedWidth?: number;
  expandedWidth?: number;
  backgroundColor?: string;
  defaultExpanded?: boolean;
  initialWidth?: number; // Width ban đầu khi mount
  onExpandedChange?: (isExpanded: boolean) => void;
  onWidthChange?: (width: number) => void; // Callback khi width thay đổi
  minWidth?: number; // Minimum width - khi scroll đến giá trị này sẽ tự động đóng sidebar (khép vào hẳn)
}

export default function HorizontalSidebar({
  children,
  collapsedWidth = 60,
  expandedWidth: expandedWidthProp,
  backgroundColor = "rgba(0, 0, 0, 0.75)",
  defaultExpanded = false,
  initialWidth,
  onExpandedChange,
  onWidthChange,
  minWidth, // Nếu có minWidth, khi scroll đến giá trị này sẽ tự động đóng sidebar
}: HorizontalSidebarProps) {
  const { width: windowWidth } = useWindowDimensions();

  const actualCollapsedWidth = Math.max(collapsedWidth, TOGGLE_BUTTON_SIZE + 16);
  const maxSidebarWidth = Math.max(windowWidth - 16, actualCollapsedWidth);

  const expandedTargetWidth = useMemo(() => {
    const requestedExpanded = expandedWidthProp ?? windowWidth * 0.4;
    const requestedMin = minWidth ?? requestedExpanded;
    const desired = Math.max(requestedExpanded, requestedMin, actualCollapsedWidth + 1);
    return Math.min(desired, maxSidebarWidth);
  }, [expandedWidthProp, minWidth, windowWidth, maxSidebarWidth, actualCollapsedWidth]);

  const initialTargetWidth = useMemo(() => {
    const preferred = initialWidth ?? (defaultExpanded ? expandedTargetWidth : actualCollapsedWidth);
    return Math.min(Math.max(preferred, actualCollapsedWidth), maxSidebarWidth);
  }, [initialWidth, defaultExpanded, expandedTargetWidth, actualCollapsedWidth, maxSidebarWidth]);

  const [isExpanded, setIsExpanded] = useState(initialTargetWidth > actualCollapsedWidth + 1);
  const [currentWidth, setCurrentWidth] = useState(initialTargetWidth);
  const sidebarWidth = useRef(new Animated.Value(initialTargetWidth)).current;

  useEffect(() => {
    const listenerId = sidebarWidth.addListener(({ value }) => {
      setCurrentWidth(value);
    });
    return () => {
      sidebarWidth.removeListener(listenerId);
    };
  }, [sidebarWidth]);

  useEffect(() => {
    onWidthChange?.(currentWidth);
  }, [currentWidth, onWidthChange]);

  useEffect(() => {
    onExpandedChange?.(isExpanded);
  }, [isExpanded, onExpandedChange]);

  useEffect(() => {
    const targetWidth = isExpanded ? expandedTargetWidth : actualCollapsedWidth;
    sidebarWidth.stopAnimation();
    Animated.timing(sidebarWidth, {
      toValue: targetWidth,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [isExpanded, expandedTargetWidth, actualCollapsedWidth, sidebarWidth]);

  const toggleSidebar = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: sidebarWidth,
          backgroundColor,
        },
      ]}
      pointerEvents="box-none"
    >
      {/* Content - Hiển thị khi width đủ lớn */}
      {currentWidth > actualCollapsedWidth + 20 && (
        <View style={styles.content} pointerEvents="auto">
          {children}
        </View>
      )}

      <TouchableOpacity
        style={styles.toggleButton}
        onPress={toggleSidebar}
        activeOpacity={0.8}
      >
        <Text style={styles.toggleButtonText}>{isExpanded ? ">" : "<"}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: 8, // Margin bên phải để dễ kéo
    top: 8, // Margin trên
    bottom: 8, // Margin dưới
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
    overflow: "hidden",
    zIndex: 10,
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingLeft: 20, // Thêm padding trái để tránh drag handle
  },
  toggleButton: {
    position: "absolute",
    bottom: 12,
    left: "50%",
    transform: [{ translateX: -20 }],
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.85)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 6,
  },
  toggleButtonText: {
    color: "#000",
    fontSize: 18,
    fontWeight: "700",
  },
});
