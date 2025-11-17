// store/polygonStore.ts
import { create } from "zustand";

interface Point {
  id: string;
  latitude: number;
  longitude: number;
}

interface PolygonStore {
  points: Point[];
  setPoints: (points: Point[]) => void;
  clearPoints: () => void;
}

export const usePolygonStore = create<PolygonStore>((set) => ({
  points: [],
  setPoints: (points) => set({ points }),
  clearPoints: () => set({ points: [] }),
}));

