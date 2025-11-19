// store/bleStore.ts
import { create } from 'zustand';
import { BLEConnectionState, BLECharacteristicData } from '../module/ble/types';

/**
 * Parsed data từ format KEY:"value"
 */
export interface ParsedData {
  key: string;
  value: string;
  timestamp: number;
}

interface BLEStore {
  // State
  connectionState: BLEConnectionState | null;
  isScanning: boolean;
  logs: string[];
  latestData: BLECharacteristicData | null;
  parsedData: Map<string, ParsedData>; // Key-value pairs từ data
  rssi: number | null;
  error: string | null;

  // Actions - Connection
  setConnectionState: (state: BLEConnectionState | null) => void;

  // Actions - Scanning
  setIsScanning: (isScanning: boolean) => void;

  // Actions - Logs
  addLog: (log: string) => void;
  clearLogs: () => void;

  // Actions - Data
  setLatestData: (data: BLECharacteristicData | null) => void;
  addParsedData: (key: string, value: string) => void;
  clearParsedData: () => void;
  getParsedValue: (key: string) => string | null;

  // Actions - RSSI
  setRssi: (rssi: number | null) => void;

  // Actions - Error
  setError: (error: string | null) => void;
}

export const useBLEStore = create<BLEStore>((set, get) => ({
  // Initial state
  connectionState: null,
  isScanning: false,
  logs: [],
  latestData: null,
  parsedData: new Map(),
  rssi: null,
  error: null,

  // Actions - Connection
  setConnectionState: (state) => set({ connectionState: state }),

  // Actions - Scanning
  setIsScanning: (isScanning) => set({ isScanning }),

  // Actions - Logs
  addLog: (log) =>
    set((state) => {
      const MAX_LOGS = 200; // Giới hạn 200 logs để tránh lag
      const newLogs = [log, ...state.logs];
      // Chỉ giữ MAX_LOGS logs mới nhất
      return {
        logs: newLogs.slice(0, MAX_LOGS),
      };
    }),

  clearLogs: () => set({ logs: [] }),

  // Actions - Data
  setLatestData: (data) => set({ latestData: data }),

  addParsedData: (key, value) =>
    set((state) => {
      const newParsedData = new Map(state.parsedData);
      newParsedData.set(key, {
        key,
        value,
        timestamp: Date.now(),
      });
      return { parsedData: newParsedData };
    }),

  clearParsedData: () => set({ parsedData: new Map() }),

  getParsedValue: (key) => {
    const parsedData = get().parsedData;
    return parsedData.get(key)?.value || null;
  },

  // Actions - RSSI
  setRssi: (rssi) => set({ rssi }),

  // Actions - Error
  setError: (error) => set({ error }),
}));

