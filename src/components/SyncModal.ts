import { dbManager } from '../db/indexedDB.ts';
import { syncService } from '../services/syncService.ts';
import { mockServer } from '../services/mockServer.ts';
import { notificationService } from '../services/notificationService.ts';
import { SyncQueueItem } from '../types/survey.ts';

export class SyncModalComponent {
  private container: HTMLElement;
  private queueItems: SyncQueueItem[] = [];
  private unsubscribeSync?: () => void;
  private unsubscribeNetwork?: () => void;

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;

    this.subscribeEvents();
    this.loadAndRender();
  }

  private subscribeEvents(): void {
    this.unsubscribeSync = syncService.onSyncChange(() => this.loadAndRender());
    this.unsubscribeNetwork = syncService.onNetworkChange(() => this.loadAndRender());
  }

  async loadAndRender(): Promise<void> {
    this.queueItems = await dbManager.getAllSyncQueue();
    this.render();
  }

  render(): void {
    const isOnline = syncService.isOnline();
    const isSyncing = syncService.isSyncing();
    const pendingCount = this.queueItems.filter((i) => i.status !== 'SYNCED').length;
    const serverRecords = mockServer.getServerRecords();

    this.container.innerHTML = `
      <div class="vku-sync-view">
        <!-- Header & Action card -->
        <div class="vku-card vku-sync-ctrl-card">
          <div class="vku-sync-ctrl-header">
            <div>
              <h2 class="vku-card-title">🔄 Hàng Đợi Đồng Bộ Ngoại Tuyến (Offline Sync Queue)</h2>
              <p class="vku-card-sub">
                Dữ liệu được lưu trữ an toàn trong IndexedDB của thiết bị và điều phối tự động khi có mạng.
              </p>
            </div>

            <div class="vku-sync-main-actions">
              <button 
                type="button" 
                id="vku-sync-now-btn" 
                class="vku-btn-primary ${isSyncing ? 'spinning' : ''}" 
                ${!isOnline || isSyncing ? 'disabled' : ''}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                </svg>
                <span>${isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay bây giờ'}</span>
              </button>

              <button type="button" id="vku-clear-completed-btn" class="vku-btn-sub">
                Dọn mục đã đồng bộ
              </button>
            </div>
          </div>

          <!-- Network Connection Status banner -->
          <div class="vku-sync-net-bar ${isOnline ? 'net-online' : 'net-offline'}">
            <span class="net-indicator-circle"></span>
            <span>
              <strong>${isOnline ? 'Đang kết nối Internet' : 'Thiết bị đang Ngoại tuyến (Offline)'}:</strong> 
              ${isOnline ? 'Hệ thống tự động đồng bộ ngầm khi phát hiện dữ liệu mới.' : 'Các phiếu kiểm tra sẽ được xếp hàng trong IndexedDB và gửi khi có mạng.'}
            </span>
          </div>
        </div>

        <!-- Sync Queue List -->
        <div class="vku-card vku-queue-card">
          <div class="vku-queue-header">
            <h3 class="vku-section-title">Danh sách tác vụ trong hàng đợi (${this.queueItems.length})</h3>
            <span class="vku-badge ${pendingCount > 0 ? 'status-minor' : 'status-normal'}">
              ${pendingCount > 0 ? `${pendingCount} mục chờ xử lý` : 'Đã hoàn tất đồng bộ'}
            </span>
          </div>

          ${
            this.queueItems.length === 0
              ? `
            <div class="vku-empty-state">
              <div class="vku-empty-icon">✨</div>
              <h3>Hàng đợi trống</h3>
              <p>Mọi dữ liệu khảo sát đã được cập nhật hoặc chưa có phiếu mới được tạo.</p>
            </div>
          `
              : `
            <div class="vku-queue-table-wrap">
              <table class="vku-queue-table">
                <thead>
                  <tr>
                    <th>Trạng thái</th>
                    <th>Hành động</th>
                    <th>Cơ sở vật chất / Hạng mục</th>
                    <th>Tòa nhà & Khu vực</th>
                    <th>Thời điểm xếp hàng</th>
                    <th>Thử lại</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.queueItems.map((item) => this.renderQueueRow(item)).join('')}
                </tbody>
              </table>
            </div>
          `
          }
        </div>

        <!-- Server Database Inspection Panel -->
        <div class="vku-card vku-server-inspect-card">
          <div class="vku-server-header">
            <div>
              <h3 class="vku-section-title">☁️ Trạng thái Cơ sở dữ liệu Máy chủ VKU (Server Endpoint)</h3>
              <p class="vku-card-sub">Tổng số bản ghi máy chủ đã tiếp nhận: <strong>${serverRecords.length}</strong> phiếu</p>
            </div>
            <button type="button" id="vku-clear-server-btn" class="vku-btn-danger-sub">
              Reset dữ liệu Mock Server
            </button>
          </div>

          ${
            serverRecords.length === 0
              ? `<p class="vku-empty-text">Máy chủ chưa có bản ghi nào. Hãy tạo phiếu và bấm đồng bộ!</p>`
              : `
            <div class="vku-server-records-pills">
              ${serverRecords
                .slice(0, 8)
                .map(
                  (r) => `
                <div class="vku-server-pill">
                  <span class="vku-dot-green"></span>
                  <strong>${r.itemDescription}</strong> (${r.buildingName} - ${r.roomOrArea})
                </div>
              `
                )
                .join('')}
              ${serverRecords.length > 8 ? `<span class="vku-server-more">+ ${serverRecords.length - 8} bản ghi khác...</span>` : ''}
            </div>
          `
          }
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private renderQueueRow(item: SyncQueueItem): string {
    const statusBadges: Record<string, { label: string; class: string; icon: string }> = {
      PENDING: { label: 'Chờ đồng bộ', class: 'sync-pending', icon: '⏳' },
      SYNCING: { label: 'Đang gửi...', class: 'sync-syncing', icon: '↻' },
      SYNCED: { label: 'Thành công', class: 'sync-synced', icon: '✓' },
      FAILED: { label: 'Thất bại', class: 'sync-failed', icon: '✕' },
    };

    const s = statusBadges[item.status] || statusBadges.PENDING;
    const time = new Date(item.queuedAt).toLocaleTimeString('vi-VN');

    return `
      <tr class="queue-row-${item.status.toLowerCase()}">
        <td>
          <span class="vku-badge ${s.class}">${s.icon} ${s.label}</span>
          ${item.lastError ? `<div class="queue-error-msg">${item.lastError}</div>` : ''}
        </td>
        <td><strong class="queue-action">${item.action}</strong></td>
        <td>
          <strong>${item.payload.itemDescription}</strong>
          <div class="queue-sub">${item.payload.category}</div>
        </td>
        <td>${item.payload.buildingName} (${item.payload.roomOrArea})</td>
        <td>${time}</td>
        <td><span class="queue-retry-badge">${item.retryCount} lần</span></td>
        <td>
          <div class="queue-row-btns">
            ${
              item.status !== 'SYNCED'
                ? `<button class="vku-btn-sub-xs" data-retry="${item.id}" title="Thử đồng bộ lại">↻ Gửi</button>`
                : ''
            }
            <button class="vku-btn-del-xs" data-del="${item.id}" title="Xóa khỏi hàng đợi">✕</button>
          </div>
        </td>
      </tr>
    `;
  }

  private bindEvents(): void {
    // Sync now button
    this.container.querySelector('#vku-sync-now-btn')?.addEventListener('click', async () => {
      await syncService.processQueue();
      await this.loadAndRender();
    });

    // Clear completed items
    this.container.querySelector('#vku-clear-completed-btn')?.addEventListener('click', async () => {
      await dbManager.clearCompletedSyncQueue();
      await this.loadAndRender();
      notificationService.show('Đã dọn dẹp các tác vụ đã hoàn tất!', 'info');
    });

    // Clear mock server
    this.container.querySelector('#vku-clear-server-btn')?.addEventListener('click', () => {
      if (confirm('Xác nhận xóa sạch cơ sở dữ liệu trên Mock Server?')) {
        mockServer.clearServerData();
        this.render();
        notificationService.show('Đã reset Mock Server Database', 'info');
      }
    });

    // Row retry
    this.container.querySelectorAll<HTMLButtonElement>('[data-retry]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-retry');
        if (id) {
          btn.disabled = true;
          btn.textContent = '...';
          await syncService.retrySingleItem(id);
          await this.loadAndRender();
        }
      });
    });

    // Row delete
    this.container.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-del');
        if (id) {
          await dbManager.removeFromSyncQueue(id);
          await this.loadAndRender();
          notificationService.show('Đã hủy tác vụ đồng bộ', 'info');
        }
      });
    });
  }

  destroy(): void {
    this.unsubscribeSync?.();
    this.unsubscribeNetwork?.();
  }
}
