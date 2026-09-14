import { syncService } from '../services/syncService.ts';
import { dbManager } from '../db/indexedDB.ts';

export type ActiveTab = 'new' | 'list' | 'map' | 'sync';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenSyncModal: () => void;
}

export class HeaderComponent {
  private container: HTMLElement;
  private props: HeaderProps;
  private deferredPrompt: any = null;
  private unsubscribeSync?: () => void;
  private unsubscribeNetwork?: () => void;

  constructor(containerId: string, props: HeaderProps) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.props = props;

    this.initPwaPrompt();
    this.subscribeEvents();
    this.render();
  }

  private initPwaPrompt(): void {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.renderInstallButton();
    });
  }

  private subscribeEvents(): void {
    this.unsubscribeSync = syncService.onSyncChange(() => this.updateStatusBadges());
    this.unsubscribeNetwork = syncService.onNetworkChange(() => this.updateStatusBadges());
  }

  setTab(tab: ActiveTab): void {
    this.props.activeTab = tab;
    this.renderTabs();
  }

  async render(): Promise<void> {
    this.container.innerHTML = `
      <header class="vku-header">
        <div class="vku-header-top">
          <div class="vku-brand">
            <img src="./apple-touch-icon.png" alt="Logo" class="vku-header-logo-img" />
            <div class="vku-brand-title">
              <h1>Khảo sát Thực địa</h1>
              <p class="vku-brand-sub">Thanh tra Cơ sở Ngoại tuyến</p>
            </div>
          </div>

          <div class="vku-header-actions">
            <!-- Network status pill -->
            <div id="vku-network-pill" class="vku-status-pill online">
              <span class="vku-status-dot"></span>
              <span class="vku-status-text">Trực tuyến</span>
            </div>

            <!-- Sync Queue Quick Button -->
            <button id="vku-quick-sync-btn" class="vku-btn-sync" title="Hàng đợi đồng bộ dữ liệu">
              <svg class="vku-icon-sync" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
              </svg>
              <span class="vku-sync-label">Đồng bộ</span>
              <span id="vku-pending-badge" class="vku-badge-count" style="display: none;">0</span>
            </button>

            <!-- PWA Install Button -->
            <button id="vku-install-btn" class="vku-btn-install" style="display: none;" title="Cài đặt ứng dụng lên thiết bị">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
              <span>Cài đặt PWA</span>
            </button>
          </div>
        </div>
      </header>
    `;

    this.renderTabs();
    this.renderInstallButton();
    await this.updateStatusBadges();
    this.bindEvents();
  }

  private renderTabs(): void {
    const bottomNav = document.getElementById('bottom-nav-container');
    if (!bottomNav) return;

    const tabs: { id: ActiveTab; label: string; icon: string; count?: number }[] = [
      { id: 'new', label: 'Khảo sát', icon: '📝' },
      { id: 'list', label: 'Danh sách', icon: '📋' },
      { id: 'map', label: 'Bản đồ', icon: '🗺️' },
      { id: 'sync', label: 'Đồng bộ', icon: '🔄' },
    ];

    bottomNav.innerHTML = `
      <nav class="vku-bottom-nav">
        ${tabs
          .map(
            (t) => `
          <button class="vku-tab-item ${this.props.activeTab === t.id ? 'active' : ''}" data-tab="${t.id}">
            <span class="vku-tab-icon">${t.icon}</span>
            <span class="vku-tab-label">${t.label}</span>
            ${t.id === 'sync' ? `<span id="vku-tab-sync-count" class="vku-tab-count"></span>` : ''}
          </button>
        `
          )
          .join('')}
      </nav>
    `;

    bottomNav.querySelectorAll<HTMLButtonElement>('.vku-tab-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab') as ActiveTab;
        if (tab) {
          this.props.onTabChange(tab);
        }
      });
    });
  }

  private renderInstallButton(): void {
    const installBtn = this.container.querySelector<HTMLButtonElement>('#vku-install-btn');
    if (!installBtn) return;

    if (this.deferredPrompt) {
      installBtn.style.display = 'inline-flex';
      installBtn.onclick = async () => {
        if (!this.deferredPrompt) return;
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          this.deferredPrompt = null;
          installBtn.style.display = 'none';
        }
      };
    } else {
      installBtn.style.display = 'none';
    }
  }

  private async updateStatusBadges(): Promise<void> {
    const networkPill = this.container.querySelector('#vku-network-pill');
    const syncBtn = this.container.querySelector<HTMLButtonElement>('#vku-quick-sync-btn');
    const badge = this.container.querySelector<HTMLElement>('#vku-pending-badge');
    const tabCount = document.querySelector<HTMLElement>('#vku-tab-sync-count');

    const isOnline = syncService.isOnline();
    const isSyncing = syncService.isSyncing();
    const pendingItems = await dbManager.getPendingSyncItems();
    const pendingCount = pendingItems.length;

    // Update Network Pill
    if (networkPill) {
      if (isSyncing) {
        networkPill.className = 'vku-status-pill syncing';
        networkPill.innerHTML = `
          <span class="vku-status-dot pulse"></span>
          <span class="vku-status-text">Đang đồng bộ...</span>
        `;
      } else if (isOnline) {
        networkPill.className = 'vku-status-pill online';
        networkPill.innerHTML = `
          <span class="vku-status-dot"></span>
          <span class="vku-status-text">Trực tuyến</span>
        `;
      } else {
        networkPill.className = 'vku-status-pill offline';
        networkPill.innerHTML = `
          <span class="vku-status-dot"></span>
          <span class="vku-status-text">Ngoại tuyến (Offline 100%)</span>
        `;
      }
    }

    // Update Quick Sync Button
    if (syncBtn) {
      if (isSyncing) {
        syncBtn.classList.add('spinning');
      } else {
        syncBtn.classList.remove('spinning');
      }
    }

    // Update badge count
    if (badge) {
      if (pendingCount > 0) {
        badge.style.display = 'inline-block';
        badge.textContent = `${pendingCount}`;
      } else {
        badge.style.display = 'none';
      }
    }

    if (tabCount) {
      if (pendingCount > 0) {
        tabCount.style.display = 'inline-block';
        tabCount.textContent = `${pendingCount}`;
      } else {
        tabCount.style.display = 'none';
      }
    }
  }

  private bindEvents(): void {
    const syncBtn = this.container.querySelector('#vku-quick-sync-btn');
    syncBtn?.addEventListener('click', () => {
      this.props.onOpenSyncModal();
    });
  }

  destroy(): void {
    this.unsubscribeSync?.();
    this.unsubscribeNetwork?.();
  }
}
