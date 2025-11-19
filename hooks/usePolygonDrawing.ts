// hooks/usePolygonDrawing.ts
import { useState, useCallback, useRef } from "react";
import { Alert } from "react-native";
import { usePolygonStore } from "../store/polygonStore";
import { Point, HistoryAction, orderSimplePolygon, arePointsInSameOrder } from "../utils/polygonUtils";

export const usePolygonDrawing = () => {
  const polygonPoints = usePolygonStore((state) => state.points);
  const setPolygonPoints = usePolygonStore((state) => state.setPoints);
  const [history, setHistory] = useState<HistoryAction[]>([]);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const [hasSavedDragState, setHasSavedDragState] = useState(false);

  const pushHistory = useCallback((entry: HistoryAction) => {
    setHistory((prev) => {
      const next = [...prev, entry];
      if (next.length > 50) {
        return next.slice(next.length - 50);
      }
      return next;
    });
  }, []);

  const saveStateToHistory = useCallback(() => {
    if (!polygonPoints.length) return;
    const snapshot = polygonPoints.map((p) => ({ ...p }));
    pushHistory({ type: "state", points: snapshot });
  }, [polygonPoints, pushHistory]);

  const handleUndo = useCallback(() => {
    if (draggingPointId) {
      setDraggingPointId(null);
      setHasSavedDragState(false);
    }

    if (!history.length) return;

    const lastAction = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));

    let updatedPoints: Point[] = [];
    if (lastAction.type === "add") {
      updatedPoints = polygonPoints.filter((p) => p.id !== lastAction.point.id);
    } else if (lastAction.type === "delete") {
      updatedPoints = [...polygonPoints, lastAction.point];
    } else if (lastAction.type === "move") {
      updatedPoints = polygonPoints.map((p) =>
        p.id === lastAction.pointId
          ? {
              ...p,
              longitude: lastAction.oldCoords.longitude,
              latitude: lastAction.oldCoords.latitude,
            }
          : p
      );
    } else if (lastAction.type === "state") {
      updatedPoints = lastAction.points;
    }

    if (updatedPoints.length >= 3 && lastAction.type !== "state") {
      updatedPoints = orderSimplePolygon(updatedPoints);
    }

    setPolygonPoints(updatedPoints);
  }, [
    draggingPointId,
    history,
    polygonPoints,
    setPolygonPoints,
  ]);

  const handleToggleDeleteMode = useCallback(() => {
    setIsDeleteMode((prev) => !prev);
  }, []);

  const handleClearAll = useCallback(() => {
    if (!polygonPoints.length) return;
    Alert.alert(
      "Xóa tất cả",
      "Bạn có chắc chắn muốn xóa tất cả các điểm?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: () => {
            saveStateToHistory();
            setPolygonPoints([]);
          },
        },
      ]
    );
  }, [polygonPoints, saveStateToHistory, setPolygonPoints]);

  const handlePointDragStart = useCallback(
    (pointId: string) => {
      if (!hasSavedDragState) {
        saveStateToHistory();
        setHasSavedDragState(true);
      }
      const point = polygonPoints.find((p) => p.id === pointId);
      if (point) {
        setDraggingPointId(pointId);
      }
    },
    [hasSavedDragState, polygonPoints, saveStateToHistory]
  );

  const handlePointDrag = useCallback(
    (pointId: string, newCoordinates: [number, number]) => {
      if (draggingPointId !== pointId) {
        handlePointDragStart(pointId);
      }

      const currentPoints = usePolygonStore.getState().points;
      const updated = currentPoints.map((p) =>
        p.id === pointId
          ? { ...p, longitude: newCoordinates[0], latitude: newCoordinates[1] }
          : p
      );
      setPolygonPoints(updated);
    },
    [draggingPointId, handlePointDragStart, setPolygonPoints]
  );

  const handlePointDragEnd = useCallback(() => {
    setHasSavedDragState(false);
    setDraggingPointId(null);

    const latest = usePolygonStore.getState().points;
    if (latest.length >= 3) {
      const ordered = orderSimplePolygon(latest);
      if (!arePointsInSameOrder(latest, ordered)) {
        setPolygonPoints(ordered);
      }
    }
  }, [setPolygonPoints]);

  const addPointAtCoords = useCallback(
    (longitude: number, latitude: number) => {
      const newPoint: Point = {
        id: Date.now().toString(),
        longitude,
        latitude,
      };
      pushHistory({ type: "add", point: newPoint });

      const updated = [...polygonPoints, newPoint];
      const nextPoints =
        updated.length >= 3 ? orderSimplePolygon(updated) : updated;
      setPolygonPoints(nextPoints);
    },
    [orderSimplePolygon, polygonPoints, pushHistory, setPolygonPoints]
  );

  const handlePointDelete = useCallback(
    (pointId: string) => {
      const point = polygonPoints.find((p) => p.id === pointId);
      if (!point) return;
      pushHistory({ type: "delete", point });

      const updated = polygonPoints.filter((p) => p.id !== pointId);
      const next =
        updated.length >= 3 ? orderSimplePolygon(updated) : updated;
      setPolygonPoints(next);
    },
    [orderSimplePolygon, polygonPoints, pushHistory, setPolygonPoints]
  );

  return {
    polygonPoints,
    history,
    isDeleteMode,
    draggingPointId,
    handleUndo,
    handleToggleDeleteMode,
    handleClearAll,
    handlePointDragStart,
    handlePointDrag,
    handlePointDragEnd,
    addPointAtCoords,
    handlePointDelete,
  };
};

