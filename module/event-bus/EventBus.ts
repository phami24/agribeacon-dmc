// modules/event-bus/EventBus.ts

import EventEmitter from 'eventemitter3';
import { BLEEventType, BLEEventData } from '../ble/types';

/**
 * EventBus - Trung tâm quản lý sự kiện toàn ứng dụng
 * 
 * Pattern: Singleton - Đảm bảo chỉ có 1 instance duy nhất
 * 
 * Cho phép các component giao tiếp với nhau mà không cần biết về nhau
 * (Loose Coupling - Giảm sự phụ thuộc giữa các module)
 * 
 * @example
 * // Phát sự kiện
 * eventBus.emit(BLEEventType.DATA_RECEIVED, { value: '25.5', ... });
 * 
 * // Lắng nghe sự kiện
 * const unsubscribe = eventBus.on(BLEEventType.DATA_RECEIVED, (data) => {
 *   console.log('Received:', data.value);
 * });
 * 
 * // Cleanup
 * unsubscribe();
 */
class EventBus {
  private emitter: EventEmitter;
  private static instance: EventBus;

  /**
   * Private constructor - Chỉ tạo instance từ bên trong class
   */
  private constructor() {
    this.emitter = new EventEmitter();
  }

  /**
   * Lấy instance duy nhất của EventBus (Singleton Pattern)
   * Nếu chưa tồn tại → Tạo mới
   * Nếu đã tồn tại → Trả về instance cũ
   */
  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Phát ra một sự kiện (emit/publish)
   * 
   * @param event - Loại sự kiện (từ BLEEventType enum)
   * @param data - Dữ liệu đi kèm (type-safe theo mapping)
   * 
   * @example
   * eventBus.emit(BLEEventType.DATA_RECEIVED, { 
   *   value: '25.5', 
   *   deviceId: 'abc123',
   *   timestamp: Date.now()
   * });
   */
  public emit<T extends BLEEventType>(
    event: T,
    data: BLEEventData[T]
  ): void {
    console.log(`[EventBus] Emit: ${event}`, data);
    this.emitter.emit(event, data);
  }

  /**
   * Lắng nghe một sự kiện (on/subscribe)
   * 
   * @param event - Loại sự kiện cần lắng nghe
   * @param handler - Hàm xử lý khi sự kiện được phát ra
   * @returns Function để hủy đăng ký (cleanup)
   * 
   * @example
   * const unsubscribe = eventBus.on(BLEEventType.DATA_RECEIVED, (data) => {
   *   console.log('New data:', data.value);
   * });
   * 
   * // Cleanup khi component unmount
   * return () => unsubscribe();
   */
  public on<T extends BLEEventType>(
    event: T,
    handler: (data: BLEEventData[T]) => void
  ): () => void {
    this.emitter.on(event, handler);
    
    // Trả về function để hủy đăng ký (cleanup)
    return () => {
      this.off(event, handler);
    };
  }

  /**
   * Lắng nghe sự kiện CHỈ MỘT LẦN (once)
   * Sau khi sự kiện được phát ra lần đầu, listener sẽ tự động bị xóa
   * 
   * @example
   * eventBus.once(BLEEventType.DEVICE_CONNECTED, (data) => {
   *   console.log('Connected once:', data.deviceId);
   * });
   */
  public once<T extends BLEEventType>(
    event: T,
    handler: (data: BLEEventData[T]) => void
  ): void {
    this.emitter.once(event, handler);
  }

  /**
   * Hủy đăng ký lắng nghe sự kiện (off/unsubscribe)
   * 
   * @param event - Loại sự kiện
   * @param handler - Hàm xử lý cần xóa (phải là cùng reference)
   */
  public off<T extends BLEEventType>(
    event: T,
    handler: (data: BLEEventData[T]) => void
  ): void {
    this.emitter.off(event, handler);
  }

  /**
   * Xóa TẤT CẢ listeners của một sự kiện
   * Hoặc xóa TẤT CẢ listeners của mọi sự kiện nếu không truyền tham số
   * 
   * @param event - (Optional) Loại sự kiện cần xóa listeners
   */
  public removeAllListeners(event?: BLEEventType): void {
    this.emitter.removeAllListeners(event);
  }

  /**
   * Đếm số lượng listeners đang lắng nghe một sự kiện
   * Hữu ích để debug memory leaks
   * 
   * @param event - Loại sự kiện
   * @returns Số lượng listeners
   */
  public listenerCount(event: BLEEventType): number {
    return this.emitter.listenerCount(event);
  }

  /**
   * Lắng nghe custom event key (dạng KEY:"value")
   * Cho phép subscribe vào một key cụ thể từ parsed data
   * 
   * @param key - Key cần lắng nghe (ví dụ: "TEMPERATURE", "HUMIDITY")
   * @param handler - Hàm xử lý khi có data với key này
   * @returns Function để hủy đăng ký
   * 
   * @example
   * // Lắng nghe khi có data với key "TEMPERATURE"
   * const unsubscribe = eventBus.onKey("TEMPERATURE", (data) => {
   *   console.log('Temperature:', data.value);
   * });
   */
  public onKey(
    key: string,
    handler: (data: { key: string; value: string; timestamp: number; deviceId: string }) => void
  ): () => void {
    // Subscribe vào DATA_PARSED event và filter theo key
    const wrappedHandler = (data: { key: string; value: string; timestamp: number; deviceId: string }) => {
      if (data.key === key) {
        handler(data);
      }
    };
    
    this.emitter.on(BLEEventType.DATA_PARSED, wrappedHandler);
    
    return () => {
      this.emitter.off(BLEEventType.DATA_PARSED, wrappedHandler);
    };
  }
}

// Export instance duy nhất (Singleton)
export const eventBus = EventBus.getInstance();