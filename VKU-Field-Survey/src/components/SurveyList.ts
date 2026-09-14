import { dbManager } from '../db/indexedDB.ts';
import { syncService } from '../services/syncService.ts';
import { notificationService } from '../services/notificationService.ts';
import { SurveyRecord, FacilityStatus, SyncStatus } from '../types/survey.ts';

interface SurveyListProps {
  onSelectSurvey?: (survey: SurveyRecord) => void;
  onNavigateNew: () => void;
}

export class SurveyListComponent {
  private container: HTMLElement;
  private props: SurveyListProps;
  private currentFilter: 'ALL' | 'PENDING' | 'SYNCED' | 'CRITICAL' = 'ALL';
  private searchQuery: string = '';
  private surveys: SurveyRecord[] = [];
  private unsubscribeSync?: () => void;

  constructor(containerId: string, props: SurveyListProps) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.props = props;

    this.subscribeEvents();
    this.loadAndRender();
  }

  private subscribeEvents(): void {
    this.unsubscribeSync = syncService.onSyncChange(() => {
      this.loadAndRender();
    });
  }

  async loadAndRender(): Promise<void> {
    this.surveys = await dbManager.getAllSurveys();
    this.render();
  }

  private getFilteredSurveys(): SurveyRecord[] {
    return this.surveys.filter((s) => {
      // 1. Status Filter
      if (this.currentFilter === 'PENDING' && (s.syncStatus === 'SYNCED')) return false;
      if (this.currentFilter === 'SYNCED' && s.syncStatus !== 'SYNCED') return false;
      if (this.currentFilter === 'CRITICAL' && s.status !== 'CRITICAL') return false;

      // 2. Search Query
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        const matchBuilding = s.buildingName.toLowerCase().includes(q);
        const matchRoom = s.roomOrArea.toLowerCase().includes(q);
        const matchItem = s.itemDescription.toLowerCase().includes(q);
        const matchCategory = s.category.toLowerCase().includes(q);
        const matchInspector = s.inspectorName.toLowerCase().includes(q);
        return matchBuilding || matchRoom || matchItem || matchCategory || matchInspector;
      }

      return true;
    });
  }

  render(): void {
    const filtered = this.getFilteredSurveys();

    // Stats calculations
    const totalCount = this.surveys.length;
    const syncedCount = this.surveys.filter((s) => s.syncStatus === 'SYNCED').length;
    const pendingCount = this.surveys.filter((s) => s.syncStatus !== 'SYNCED').length;
    const criticalCount = this.surveys.filter((s) => s.status === 'CRITICAL').length;

    this.container.innerHTML = `
      <div class="vku-list-view">
        <!-- Stats summary row -->
        <div class="vku-stats-grid">
          <div class="vku-stat-card">
            <span class="vku-stat-label">Tổng số phiếu</span>
            <span class="vku-stat-value">${totalCount}</span>
          </div>
          <div class="vku-stat-card success">
            <span class="vku-stat-label">Đã đồng bộ máy chủ</span>
            <span class="vku-stat-value">${syncedCount}</span>
          </div>
          <div class="vku-stat-card warning">
            <span class="vku-stat-label">Chờ đồng bộ (IndexedDB)</span>
            <span class="vku-stat-value">${pendingCount}</span>
          </div>
          <div class="vku-stat-card danger">
            <span class="vku-stat-label">Hỏng hóc cấp bách</span>
            <span class="vku-stat-value">${criticalCount}</span>
          </div>
        </div>

        <!-- Toolbar & Filter -->
        <div class="vku-card vku-toolbar-card">
          <div class="vku-toolbar-top">
            <div class="vku-search-wrap">
              <span class="vku-search-icon">🔍</span>
              <input 
                type="text" 
                id="vku-search-input" 
                class="vku-input vku-search-input" 
                placeholder="Tìm kiếm theo phòng, thiết bị, tòa nhà, người kiểm tra..." 
                value="${this.searchQuery}"
              />
            </div>

            <div class="vku-actions-row">
              <button type="button" id="vku-btn-export-json" class="vku-btn-sub" title="Xuất dữ liệu JSON offline">
                <span>Xuất JSON</span>
              </button>
              <button type="button" id="vku-btn-new-survey" class="vku-btn-primary">
                <span>+ Khảo sát mới</span>
              </button>
            </div>
          </div>

          <div class="vku-filter-pills">
            <button class="vku-filter-pill ${this.currentFilter === 'ALL' ? 'active' : ''}" data-filter="ALL">
              Tất cả (${totalCount})
            </button>
            <button class="vku-filter-pill ${this.currentFilter === 'PENDING' ? 'active' : ''}" data-filter="PENDING">
              Chờ đồng bộ (${pendingCount})
            </button>
            <button class="vku-filter-pill ${this.currentFilter === 'SYNCED' ? 'active' : ''}" data-filter="SYNCED">
              Đã đồng bộ (${syncedCount})
            </button>
            <button class="vku-filter-pill ${this.currentFilter === 'CRITICAL' ? 'active' : ''}" data-filter="CRITICAL">
              Cấp bách (${criticalCount})
            </button>
          </div>
        </div>

        <!-- Survey Cards Grid -->
        <div class="vku-surveys-grid" id="vku-surveys-grid">
          ${
            filtered.length === 0
              ? `
            <div class="vku-empty-state">
              <div class="vku-empty-icon">📭</div>
              <h3>Không tìm thấy phiếu khảo sát nào</h3>
              <p>Chưa có dữ liệu phù hợp với bộ lọc hiện tại. Bấm nút dưới để tạo phiếu mới.</p>
              <button type="button" id="vku-empty-new-btn" class="vku-btn-primary" style="margin-top: 14px;">
                Tạo phiếu khảo sát ngay
              </button>
            </div>
          `
              : filtered.map((s) => this.renderSurveyCard(s)).join('')
          }
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private renderSurveyCard(survey: SurveyRecord): string {
    const statusBadges: Record<FacilityStatus, { text: string; class: string; icon: string }> = {
      NORMAL: { text: 'Bình thường', class: 'status-normal', icon: '🟢' },
      MINOR: { text: 'Cần bảo trì', class: 'status-minor', icon: '🟡' },
      CRITICAL: { text: 'Cấp bách', class: 'status-critical', icon: '🔴' },
    };

    const syncBadges: Record<SyncStatus, { text: string; class: string }> = {
      SYNCED: { text: '✓ Đã đồng bộ', class: 'sync-synced' },
      PENDING: { text: '⏳ Chờ đồng bộ', class: 'sync-pending' },
      SYNCING: { text: '↻ Đang gửi...', class: 'sync-syncing' },
      FAILED: { text: '⚠ Lỗi đồng bộ', class: 'sync-failed' },
    };

    const stat = statusBadges[survey.status] || statusBadges.NORMAL;
    const sync = syncBadges[survey.syncStatus] || syncBadges.PENDING;
    const formattedDate = new Date(survey.createdAt).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const firstPhoto = survey.photos?.[0];

    return `
      <div class="vku-survey-card ${survey.status === 'CRITICAL' ? 'border-critical' : ''}" data-id="${survey.id}">
        ${
          firstPhoto
            ? `<div class="vku-card-thumb-wrap">
                 <img src="${firstPhoto}" alt="Minh chứng" class="vku-card-thumb" />
                 ${survey.photos.length > 1 ? `<span class="vku-photo-count">+${survey.photos.length - 1} ảnh</span>` : ''}
               </div>`
            : ''
        }
        <div class="vku-survey-card-body">
          <div class="vku-card-top-row">
            <span class="vku-badge ${stat.class}">${stat.icon} ${stat.text}</span>
            <span class="vku-badge ${sync.class}">${sync.text}</span>
          </div>

          <h3 class="vku-survey-item-name">${survey.itemDescription}</h3>
          
          <div class="vku-survey-meta-list">
            <div class="vku-meta-item">
              <span class="vku-meta-icon">🏢</span>
              <span><strong>${survey.buildingName}</strong> • ${survey.floor} (${survey.roomOrArea})</span>
            </div>
            <div class="vku-meta-item">
              <span class="vku-meta-icon">🏷️</span>
              <span>${survey.category}</span>
            </div>
            <div class="vku-meta-item">
              <span class="vku-meta-icon">📍</span>
              <span class="vku-meta-gps">
                ${survey.location.latitude.toFixed(4)}, ${survey.location.longitude.toFixed(4)} 
                ${survey.location.buildingNear ? `(${survey.location.buildingNear})` : ''}
              </span>
            </div>
            <div class="vku-meta-item">
              <span class="vku-meta-icon">👤</span>
              <span>${survey.inspectorName} • <small>${formattedDate}</small></span>
            </div>
          </div>

          ${
            survey.notes
              ? `<div class="vku-survey-notes">
                   <strong>Ghi chú:</strong> ${survey.notes}
                 </div>`
              : ''
          }

          <div class="vku-card-bottom-actions">
            ${
              survey.syncStatus !== 'SYNCED'
                ? `<button class="vku-btn-card-sync" data-action="sync" data-id="${survey.id}">
                     ↻ Thử gửi lại
                   </button>`
                : `<span class="vku-synced-indicator">Lưu trên máy chủ VKU</span>`
            }
            <button class="vku-btn-card-del" data-action="delete" data-id="${survey.id}" title="Xóa phiếu này">
              Xóa
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    // Search input
    const searchInput = this.container.querySelector<HTMLInputElement>('#vku-search-input');
    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      this.renderFilteredCardsOnly();
    });

    // Filter pills
    this.container.querySelectorAll<HTMLButtonElement>('.vku-filter-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        const filter = btn.getAttribute('data-filter') as any;
        if (filter) {
          this.currentFilter = filter;
          this.render();
        }
      });
    });

    // Buttons
    this.container.querySelector('#vku-btn-new-survey')?.addEventListener('click', () => {
      this.props.onNavigateNew();
    });

    this.container.querySelector('#vku-empty-new-btn')?.addEventListener('click', () => {
      this.props.onNavigateNew();
    });

    this.container.querySelector('#vku-btn-export-json')?.addEventListener('click', () => {
      this.exportToJson();
    });

    // Card Actions (Delete, Sync)
    this.container.querySelectorAll<HTMLButtonElement>('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (id && confirm('Bạn có chắc muốn xóa phiếu khảo sát này khỏi IndexedDB?')) {
          await syncService.deleteSurvey(id);
          await this.loadAndRender();
        }
      });
    });

    this.container.querySelectorAll<HTMLButtonElement>('[data-action="sync"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (id) {
          btn.textContent = 'Đang đồng bộ...';
          btn.disabled = true;
          await syncService.processQueue();
          await this.loadAndRender();
        }
      });
    });
  }

  private renderFilteredCardsOnly(): void {
    const grid = this.container.querySelector('#vku-surveys-grid');
    if (!grid) return;
    const filtered = this.getFilteredSurveys();

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="vku-empty-state">
          <div class="vku-empty-icon">🔍</div>
          <h3>Không tìm thấy kết quả phù hợp</h3>
          <p>Thử tìm kiếm với từ khóa khác.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map((s) => this.renderSurveyCard(s)).join('');
    this.bindEvents();
  }

  private exportToJson(): void {
    if (this.surveys.length === 0) {
      notificationService.show('Không có dữ liệu khảo sát để xuất', 'warning');
      return;
    }

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.surveys, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `vku_field_surveys_${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchorElem.click();
    notificationService.show('Đã xuất file JSON thành công!', 'success');
  }

  destroy(): void {
    this.unsubscribeSync?.();
  }
}
