import './index.css';
import { HeaderComponent, ActiveTab } from './components/Header.ts';
import { SurveyFormComponent } from './components/SurveyForm.ts';
import { SurveyListComponent } from './components/SurveyList.ts';
import { CampusMapComponent } from './components/CampusMap.ts';
import { SyncModalComponent } from './components/SyncModal.ts';
import { syncService } from './services/syncService.ts';
import { dbManager } from './db/indexedDB.ts';
import { notificationService } from './services/notificationService.ts';
import { SurveyRecord } from './types/survey.ts';

class App {
  private activeTab: ActiveTab = 'new';
  private header!: HeaderComponent;
  private currentComponent: any = null;

  async init(): Promise<void> {
    this.registerServiceWorker();
    await this.seedInitialDemoDataIfEmpty();

    // Determine initial tab from hash or default to 'new'
    const hash = window.location.hash.replace('#', '') as ActiveTab;
    if (['new', 'list', 'map', 'sync'].includes(hash)) {
      this.activeTab = hash;
    }

    // Initialize Header
    this.header = new HeaderComponent('header-container', {
      activeTab: this.activeTab,
      onTabChange: (tab) => this.switchTab(tab),
      onOpenSyncModal: () => this.switchTab('sync'),
    });

    // Render active tab view
    this.renderCurrentView();

    // Listen to browser hash changes
    window.addEventListener('hashchange', () => {
      const h = window.location.hash.replace('#', '') as ActiveTab;
      if (['new', 'list', 'map', 'sync'].includes(h) && h !== this.activeTab) {
        this.switchTab(h);
      }
    });
  }

  private switchTab(tab: ActiveTab): void {
    this.activeTab = tab;
    window.location.hash = tab;
    this.header.setTab(tab);
    this.renderCurrentView();
  }

  private renderCurrentView(): void {
    const main = document.getElementById('main-content');
    if (!main) return;

    if (this.currentComponent?.destroy) {
      this.currentComponent.destroy();
    }

    main.innerHTML = `<div id="view-mount-point"></div>`;

    if (this.activeTab === 'new') {
      this.currentComponent = new SurveyFormComponent('view-mount-point', {
        onSuccess: (survey) => {
          notificationService.show(`Đã lưu phiếu kiểm tra cho ${survey.buildingName}!`, 'success');
          // Navigate to list after 1.2s
          setTimeout(() => {
            this.switchTab('list');
          }, 1200);
        },
      });
    } else if (this.activeTab === 'list') {
      this.currentComponent = new SurveyListComponent('view-mount-point', {
        onNavigateNew: () => this.switchTab('new'),
      });
    } else if (this.activeTab === 'map') {
      this.currentComponent = new CampusMapComponent('view-mount-point', {
        onSelectBuildingForSurvey: async (buildingId) => {
          // Pre-select building in draft
          const draft = (await dbManager.getDraft()) || {
            id: 'current_active_draft',
            buildingId,
            buildingName: '',
            floor: '',
            roomOrArea: '',
            category: '',
            itemDescription: '',
            status: 'NORMAL',
            notes: '',
            photos: [],
            inspectorName: '',
            inspectorEmail: '',
            updatedAt: new Date().toISOString(),
          };
          draft.buildingId = buildingId;
          await dbManager.saveDraft(draft);

          this.switchTab('new');
        },
      });
    } else if (this.activeTab === 'sync') {
      this.currentComponent = new SyncModalComponent('view-mount-point');
    }
  }

  private registerServiceWorker(): void {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', async () => {
        try {
          const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
          console.log('[App] Service Worker đã đăng ký thành công:', reg.scope);

          // Register Background Sync if supported
          if ('sync' in reg) {
            try {
              await (reg as any).sync.register('vku-sync-queue');
              console.log('[App] Đã đăng ký Background Sync API tag: vku-sync-queue');
            } catch (e) {
              console.log('[App] Background Sync register skipped:', e);
            }
          }
        } catch (err) {
          console.warn('[App] Không thể đăng ký Service Worker:', err);
        }
      });

      // Listen for messages from SW
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'BACKGROUND_SYNC_TRIGGER') {
          console.log('[App] Nhận trigger Background Sync từ Service Worker, đang đồng bộ...');
          syncService.processQueue(true);
        }
      });
    }
  }

  /**
   * Pre-seed a few realistic campus survey records if this is first launch
   */
  private async seedInitialDemoDataIfEmpty(): Promise<void> {
    const existing = await dbManager.getAllSurveys();
    if (existing.length > 0) return;

    const sampleRecords: SurveyRecord[] = [
      {
        id: 'srv_seed_01',
        buildingId: 'bld-b',
        buildingName: 'Khu B - Giảng Đường & Khoa CNTT',
        floor: 'Tầng 3',
        roomOrArea: 'Phòng B.302 (Lab AI)',
        category: 'Thiết bị IT & Giảng dạy',
        itemDescription: 'Máy chiếu Epson EB-X06',
        status: 'MINOR',
        notes: 'Bóng đèn máy chiếu chập chờn sau 30 phút sử dụng, cần kỹ thuật kiểm tra quạt tản nhiệt.',
        photos: [],
        location: {
          latitude: 15.9752,
          longitude: 108.2524,
          accuracy: 8,
          buildingNear: 'Khu B (~15m)',
        },
        inspectorName: 'Hoàng Văn Quyến',
        inspectorEmail: 'quyenhv@vku.udn.vn',
        createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
        syncStatus: 'SYNCED',
        syncRetryCount: 0,
      },
      {
        id: 'srv_seed_02',
        buildingId: 'bld-c',
        buildingName: 'Khu C - Giảng Đường & Phòng Lab',
        floor: 'Tầng 2',
        roomOrArea: 'Hành lang C.204',
        category: 'PCCC & An toàn trường học',
        itemDescription: 'Hộp vòi cứu hỏa & Đèn Exit',
        status: 'CRITICAL',
        notes: 'Đèn thoát hiểm Exit không sáng khi thử ngắt điện giả lập. Cần thay ắc quy dự phòng ngay!',
        photos: [],
        location: {
          latitude: 15.9748,
          longitude: 108.253,
          accuracy: 6,
          buildingNear: 'Khu C (~10m)',
        },
        inspectorName: 'Hoàng Văn Quyến',
        inspectorEmail: 'quyenhv@vku.udn.vn',
        createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 1).toISOString(),
        syncStatus: 'PENDING',
        syncRetryCount: 0,
      },
    ];

    for (const record of sampleRecords) {
      await dbManager.saveSurvey(record);
      if (record.syncStatus === 'PENDING') {
        await dbManager.addToSyncQueue({
          id: 'sync_seed_02',
          surveyId: record.id,
          action: 'CREATE',
          payload: record,
          queuedAt: record.createdAt,
          retryCount: 0,
          status: 'PENDING',
        });
      }
    }
  }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
