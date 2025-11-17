// components/HorizontalSidebar.tsx
// Component cho màn hình ngang (landscape) - Sidebar ở bên phải, full height
import React, { useRef, useState } from "react";
import {
    Animated,
    Dimensions,
    PanResponder,
    StyleSheet,
    View,
} from "react-native";

const { width, height } = Dimensions.get("window");

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
  expandedWidth = width * 0.35,
  backgroundColor = "rgba(0, 0, 0, 0.75)",
  defaultExpanded = false,
  initialWidth,
  onExpandedChange,
  onWidthChange,
  minWidth, // Nếu có minWidth, khi scroll đến giá trị này sẽ tự động đóng sidebar
}: HorizontalSidebarProps) {
  // Khi collapsed, chỉ còn một nửa width
  const actualCollapsedWidth = collapsedWidth / 2;
  // Nếu có minWidth, default là minWidth; nếu có initialWidth, dùng nó; nếu không, dùng defaultExpanded logic
  const startWidth = initialWidth ?? (minWidth ?? (defaultExpanded ? expandedWidth : actualCollapsedWidth));
  const sidebarWidth = useRef(new Animated.Value(startWidth)).current;
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || (initialWidth ? initialWidth > (actualCollapsedWidth + expandedWidth) / 2 : false));
  const [currentWidth, setCurrentWidth] = useState(startWidth);
  const startWidthRef = useRef(startWidth);

  // Lắng nghe thay đổi width để cập nhật state
  React.useEffect(() => {
    const listener = ({ value }: { value: number }) => {
      setCurrentWidth(value);
      const threshold = (actualCollapsedWidth + expandedWidth) / 2;
      const newExpanded = value > threshold;
      setIsExpanded(newExpanded);
      // Notify parent about expanded state change
      if (onExpandedChange) {
        onExpandedChange(newExpanded);
      }
      // Notify parent about width change
      if (onWidthChange) {
        onWidthChange(value);
      }
    };
    const listenerId = sidebarWidth.addListener(listener);
    
    return () => {
      sidebarWidth.removeListener(listenerId);
    };
  }, [sidebarWidth, actualCollapsedWidth, expandedWidth, onExpandedChange, onWidthChange]);

  // Pan responder for drag gesture - chỉ kéo từ drag handle
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Chỉ phản hồi với swipe ngang
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 3;
      },
      onPanResponderGrant: (evt) => {
        sidebarWidth.stopAnimation();
        sidebarWidth.flattenOffset();
        // Lấy giá trị hiện tại từ state
        startWidthRef.current = currentWidth;
      },
      onPanResponderMove: (evt, gestureState) => {
        // Tính width mới dựa trên drag (dx âm = kéo trái = mở rộng)
        const newWidth = startWidthRef.current - gestureState.dx;
        
        let clampedWidth: number;
        if (minWidth) {
          // Cho phép kéo tự do, cho phép kéo nhỏ hơn minWidth để user có thể kéo qua minWidth và đóng
          // Giới hạn tối thiểu là collapsed, tối đa là width màn hình
          clampedWidth = Math.max(actualCollapsedWidth, Math.min(width - 16, newWidth));
        } else {
          // Behavior cũ: cho phép kéo trong khoảng collapsed và expanded
          clampedWidth = Math.max(actualCollapsedWidth, Math.min(expandedWidth, newWidth));
        }
        
        // Set trực tiếp, không animation để mượt hơn
        sidebarWidth.setValue(clampedWidth);
      },
      onPanResponderRelease: (evt, gestureState) => {
        // Tính width cuối cùng
        const finalWidth = startWidthRef.current - gestureState.dx;
        
        let targetWidth: number;
        if (minWidth) {
          // Nếu có minWidth: khi kéo đến minWidth hoặc nhỏ hơn thì tự đóng về collapsed
          if (finalWidth <= minWidth) {
            // Kéo đến minWidth hoặc nhỏ hơn -> tự đóng về collapsed
            targetWidth = actualCollapsedWidth;
          } else {
            // Nếu đang ở trên minWidth, giữ nguyên (có thể lớn hơn minWidth, giới hạn tối đa bằng width màn hình)
            targetWidth = Math.min(width - 16, finalWidth);
          }
        } else {
          // Behavior cũ: snap về một trong hai trạng thái
          const clampedWidth = Math.max(actualCollapsedWidth, Math.min(expandedWidth, finalWidth));
          const threshold = (actualCollapsedWidth + expandedWidth) / 2;
          targetWidth = clampedWidth > threshold ? expandedWidth : actualCollapsedWidth;
        }
        
        // Animate về trạng thái đích
        Animated.timing(sidebarWidth, {
          toValue: targetWidth,
          duration: 200,
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;


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
      {/* Drag handle ở giữa sidebar - chỉ để kéo */}
      <View 
        style={styles.dragHandleContainer} 
        pointerEvents="auto"
        {...panResponder.panHandlers}
      >
        <View style={styles.dragHandle} />
      </View>

      {/* Content - Hiển thị khi width đủ lớn */}
      {currentWidth > actualCollapsedWidth + 20 && (
        <View style={styles.content} pointerEvents="auto">
          {children}
        </View>
      )}
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
  dragHandleContainer: {
    position: "absolute",
    left: -8, // Mở rộng ra ngoài một chút để dễ kéo
    top: "50%",
    transform: [{ translateY: -20 }],
    width: 24, // Tăng width để dễ kéo hơn
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },
  dragHandle: {
    width: 4,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingLeft: 20, // Thêm padding trái để tránh drag handle
  },
});
