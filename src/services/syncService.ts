import { Network } from '@capacitor/network';
import { dbManager } from '../db/indexedDB.ts';
import { SurveyRecord, SyncQueueItem } from '../types/survey.ts';
import { mockServer } from './mockServer.ts';
import { notificationService } from './notificationService.ts';

export type NetworkStatus = 'ONLINE' | 'OFFLINE';

type SyncListener = () => void;
type NetworkListener = (isOnline: boolean) => void;

class SyncService {
  private isOnlineState: boolean = navigator.onLine;
  private isSyncingState: boolean = false;
  private syncListeners: Set<SyncListener> = new Set();
  private networkListeners: Set<NetworkListener> = new Set();
  private autoSyncInterval: number | null = null;

  constructor() {
    this.initNetworkListeners();
  }

  private async initNetworkListeners(): Promise<void> {
    // 1. Web standard events
    window.addEventListener('online', () => this.handleNetworkChange(true));
    window.addEventListener('offline', () => this.handleNetworkChange(false));

    // 2. Capacitor Network plugin listener
    try {
      Network.addListener('networkStatusChange', (status) => {
        this.handleNetworkChange(status.connected);
      });
      const status = await Network.getStatus();
      this.isOnlineState = status.connected;
    } catch {
      this.isOnlineState = navigator.onLine;
    }

    // Auto-trigger sync check every 45 seconds when online
    this.autoSyncInterval = window.setInterval(() => {
      if (this.isOnlineState && !this.isSyncingState) {
        this.processQueue(true); // silent
      }
    }, 45000);
  }

  private async handleNetworkChange(isOnline: boolean): Promise<void> {
    const previous = this.isOnlineState;
    this.isOnlineState = isOnline;

    this.notifyNetworkListeners(isOnline);

    if (isOnline && !previous) {
      notificationService.show('Đã kết nối Internet! Đang tự động đồng bộ hàng đợi...', 'success', 3500);
      await this.processQueue();
    } else if (!isOnline && previous) {
      notificationService.show('Mất kết nối Internet. Chuyển sang chế độ lưu trữ Offline 100%.', 'warning', 4000);
    }
  }

  isOnline(): boolean {
    return this.isOnlineState;
  }

  isSyncing(): boolean {
    return this.isSyncingState;
  }

  onSyncChange(listener: SyncListener): () => void {
    this.syncListeners.add(listener);
    return () => this.syncListeners.delete(listener);
  }

  onNetworkChange(listener: NetworkListener): () => void {
    this.networkListeners.add(listener);
    return () => this.networkListeners.delete(listener);
  }

  private notifySyncListeners(): void {
    for (const listener of this.syncListeners) {
      try {
        listener();
      } catch (e) {
        console.error('Error in sync listener:', e);
      }
    }
  }

  private notifyNetworkListeners(isOnline: boolean): void {
    for (const listener of this.networkListeners) {
      try {
        listener(isOnline);
      } catch (e) {
        console.error('Error in network listener:', e);
      }
    }
  }

  /**
   * Submit or update a survey.
   * If online, queue and sync immediately.
   * If offline, queue in IndexedDB and notify user.
   */
  async submitSurvey(survey: SurveyRecord): Promise<void> {
    // 1. Always write locally to IndexedDB surveys store first (Offline First)
    survey.syncStatus = 'PENDING';
    await dbManager.saveSurvey(survey);

    // 2. Add mutation to IndexedDB Sync Queue
    const queueItem: SyncQueueItem = {
      id: 'sync_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      surveyId: survey.id,
      action: 'CREATE',
      payload: survey,
      queuedAt: new Date().toISOString(),
      retryCount: 0,
      status: 'PENDING',
    };
    await dbManager.addToSyncQueue(queueItem);

    // 3. Clear draft
    await dbManager.clearDraft();

    this.notifySyncListeners();

    // 4. Try dispatching if online
    if (this.isOnlineState) {
      notificationService.show('Đang đồng bộ khảo sát lên máy chủ VKU...', 'info', 2000);
      await this.processQueue();
    } else {
      notificationService.show(
        'Đã lưu phiếu khảo sát vào IndexedDB (Chế độ Ngoại tuyến). Sẽ tự động tải lên khi có mạng!',
        'warning',
        4500
      );
    }
  }

  /**
   * Process the offline sync queue FIFO
   */
  async processQueue(silent: boolean = false): Promise<{ processed: number; succeeded: number; failed: number }> {
    if (this.isSyncingState) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    const pending = await dbManager.getPendingSyncItems();
    if (pending.length === 0) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    if (!this.isOnlineState) {
      if (!silent) {
        notificationService.show('Không thể đồng bộ: Thiết bị đang ngoại tuyến.', 'warning');
      }
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    this.isSyncingState = true;
    this.notifySyncListeners();

    let succeeded = 0;
    let failed = 0;

    try {
      for (const item of pending) {
        // Double check network state
        if (!navigator.onLine) {
          item.status = 'PENDING';
          await dbManager.updateSyncQueueItem(item);
          break;
        }

        item.status = 'SYNCING';
        await dbManager.updateSyncQueueItem(item);
        await dbManager.updateSurveySyncStatus(item.surveyId, 'SYNCING');
        this.notifySyncListeners();

        try {
          // Send to mock or real VKU server endpoint
          await mockServer.processSurveySubmission(item);

          // Success: update both survey and queue item
          item.status = 'SYNCED';
          item.lastError = undefined;
          await dbManager.updateSyncQueueItem(item);
          await dbManager.updateSurveySyncStatus(item.surveyId, 'SYNCED');
          succeeded++;
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : 'Lỗi kết nối máy chủ';
          item.retryCount += 1;
          item.status = 'FAILED';
          item.lastError = errorMessage;
          await dbManager.updateSyncQueueItem(item);
          await dbManager.updateSurveySyncStatus(item.surveyId, 'FAILED', errorMessage);
          failed++;
        }
      }
    } finally {
      this.isSyncingState = false;
      this.notifySyncListeners();
    }

    if (!silent) {
      if (failed === 0 && succeeded > 0) {
        notificationService.show(`Đồng bộ thành công ${succeeded} phiếu khảo sát!`, 'success');
      } else if (failed > 0) {
        notificationService.show(
          `Đã đồng bộ ${succeeded}, lỗi ${failed} phiếu. Sẽ tự động thử lại sau.`,
          'warning'
        );
      }
    }

    return { processed: pending.length, succeeded, failed };
  }

  /**
   * Delete a survey record locally and remove from sync queue
   */
  async deleteSurvey(surveyId: string): Promise<void> {
    await dbManager.deleteSurvey(surveyId);

    // Also remove from sync queue if exists
    const allQueue = await dbManager.getAllSyncQueue();
    for (const q of allQueue) {
      if (q.surveyId === surveyId) {
        await dbManager.removeFromSyncQueue(q.id);
      }
    }

    this.notifySyncListeners();
    notificationService.show('Đã xóa phiếu khảo sát.', 'info');
  }

  /**
   * Manually trigger sync for a single item in queue
   */
  async retrySingleItem(queueItemId: string): Promise<void> {
    const queue = await dbManager.getAllSyncQueue();
    const item = queue.find((q) => q.id === queueItemId);
    if (!item) return;

    item.status = 'PENDING';
    await dbManager.updateSyncQueueItem(item);
    await this.processQueue();
  }

  cleanup(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
    }
  }
}

export const syncService = new SyncService();
