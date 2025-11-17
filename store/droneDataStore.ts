// store/droneDataStore.ts
import { create } from 'zustand';

/**
 * Store để lưu trữ các giá trị BLE đã parse (HOME, BATTERY, STATUS, EKF, WP)
 * Chỉ update khi giá trị thay đổi để tránh re-render không cần thiết
 */

export interface HomePosition {
  latitude: number;
  longitude: number;
}

interface DroneDataStore {
  // HOME position
  homePosition: HomePosition | null;
  hasReceivedHome: boolean; // Đánh dấu đã nhận được HOME từ BLE
  
  // BATTERY (0-100)
  batteryLevel: number | null;
  
  // STATUS (0 = chưa sẵn sàng, 1 = sẵn sàng)
  status: number | null;
  isReady: boolean;
  
  // EKF
  ekf: number | null;
  
  // WP (waypoint)
  wp: string | null;
  
  // Actions
  setHomePosition: (position: HomePosition | null) => void;
  setBatteryLevel: (level: number | null) => void;
  setStatus: (status: number | null) => void;
  setEKF: (ekf: number | null) => void;
  setWP: (wp: string | null) => void;
  
  // Reset all
  reset: () => void;
}

const defaultHomePosition: HomePosition = {
  latitude: 21.002958587069653,
  longitude: 105.73365778133193,
};

export const useDroneDataStore = create<DroneDataStore>((set, get) => ({
  // Initial state
  homePosition: defaultHomePosition,
  hasReceivedHome: false,
  batteryLevel: null,
  status: null,
  isReady: false,
  ekf: null,
  wp: null,
  
  // Actions - chỉ update khi giá trị thay đổi
  setHomePosition: (position) => {
    const current = get().homePosition;
    // So sánh để tránh update không cần thiết
    if (
      !current ||
      !position ||
      Math.abs(current.latitude - position.latitude) > 0.000001 ||
      Math.abs(current.longitude - position.longitude) > 0.000001
    ) {
      set({ 
        homePosition: position,
        hasReceivedHome: position !== null,
      });
    }
  },
  
  setBatteryLevel: (level) => {
    const current = get().batteryLevel;
    if (current !== level) {
      set({ batteryLevel: level });
    }
  },
  
  setStatus: (status) => {
    const current = get().status;
    if (current !== status) {
      set({ 
        status,
        isReady: status === 1,
      });
    }
  },
  
  setEKF: (ekf) => {
    const current = get().ekf;
    if (current !== ekf) {
      set({ ekf });
    }
  },
  
  setWP: (wp) => {
    const current = get().wp;
    if (current !== wp) {
      set({ wp });
    }
  },
  
  reset: () => {
    set({
      homePosition: defaultHomePosition,
      hasReceivedHome: false,
      batteryLevel: null,
      status: null,
      isReady: false,
      ekf: null,
      wp: null,
    });
  },
}));

