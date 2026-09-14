import { dbManager } from '../db/indexedDB.ts';
import { hardwareService } from '../services/hardwareService.ts';
import { syncService } from '../services/syncService.ts';
import { notificationService } from '../services/notificationService.ts';
import { VKU_BUILDINGS, SURVEY_CATEGORIES, VKU_CENTER } from '../data/campusData.ts';
import { FacilityStatus, GeoLocationCoord, SurveyRecord, SurveyDraft } from '../types/survey.ts';

interface SurveyFormProps {
  onSuccess: (survey: SurveyRecord) => void;
}

export class SurveyFormComponent {
  private container: HTMLElement;
  private props: SurveyFormProps;
  private photos: string[] = [];
  private location: GeoLocationCoord = {
    latitude: VKU_CENTER.lat,
    longitude: VKU_CENTER.lng,
    accuracy: 30,
    buildingNear: 'Khu A - Tòa Nhà Hiệu Bộ (~20m)',
  };
  private autoSaveTimer: number | null = null;
  private isCapturingGps: boolean = false;
  private isCapturingPhoto: boolean = false;

  constructor(containerId: string, props: SurveyFormProps) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.props = props;

    this.render();
    this.loadDraftAndInspector();
  }

  async render(): Promise<void> {
    const platform = hardwareService.getPlatformName();

    this.container.innerHTML = `
      <div class="vku-card vku-form-container">
        <div class="vku-card-header">
          <div>
            <h2 class="vku-card-title">📝 Phiếu Kiểm Tra Cơ Sở Vật Chất VKU</h2>
            <p class="vku-card-sub">
              Hệ thống lưu ngoại tuyến 100% • Tự động lưu bản nháp IndexedDB
            </p>
          </div>
          <div class="vku-draft-badge" id="vku-draft-status">
            <span class="vku-draft-indicator"></span>
            <span class="vku-draft-label">Bản nháp đã lưu</span>
          </div>
        </div>

        <form id="vku-survey-form" class="vku-form" novalidate>
          <!-- 1. Vị trí & Tòa nhà VKU -->
          <div class="vku-form-section">
            <h3 class="vku-section-title">
              <span class="vku-section-num">1</span> Vị trí & Khu vực kiểm tra
            </h3>
            
            <div class="vku-grid-2">
              <div class="vku-form-group">
                <label for="f-building" class="vku-label">Tòa nhà / Phân khu VKU <span class="req">*</span></label>
                <select id="f-building" class="vku-select" required>
                  <option value="">-- Chọn tòa nhà / cơ sở --</option>
                  ${VKU_BUILDINGS.map(
                    (b) => `<option value="${b.id}">${b.name} (${b.floors} tầng)</option>`
                  ).join('')}
                </select>
              </div>

              <div class="vku-grid-2-inner">
                <div class="vku-form-group">
                  <label for="f-floor" class="vku-label">Tầng <span class="req">*</span></label>
                  <input type="text" id="f-floor" class="vku-input" placeholder="Ví dụ: Tầng 3" required />
                </div>
                <div class="vku-form-group">
                  <label for="f-room" class="vku-label">Phòng / Khu vực <span class="req">*</span></label>
                  <input type="text" id="f-room" class="vku-input" placeholder="VD: B.302, Cầu thang" required />
                </div>
              </div>
            </div>

            <!-- GPS Location Card -->
            <div class="vku-gps-card">
              <div class="vku-gps-header">
                <div class="vku-gps-info">
                  <span class="vku-gps-pin">📍</span>
                  <div>
                    <span class="vku-gps-title">Tọa độ GPS Khảo sát</span>
                    <p class="vku-gps-coord" id="vku-gps-display">
                      ${this.location.latitude.toFixed(5)}, ${this.location.longitude.toFixed(5)} (±${this.location.accuracy || 20}m)
                    </p>
                    <span class="vku-gps-near" id="vku-gps-near">${this.location.buildingNear || 'Khuôn viên VKU'}</span>
                  </div>
                </div>
                <button type="button" id="vku-btn-gps" class="vku-btn-sub">
                  <span id="vku-gps-spinner" class="vku-spin-hidden">↻</span>
                  <span>Lấy GPS</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 2. Hạng mục kiểm tra & Mức độ -->
          <div class="vku-form-section">
            <h3 class="vku-section-title">
              <span class="vku-section-num">2</span> Hạng mục & Tình trạng thiết bị
            </h3>

            <div class="vku-grid-2">
              <div class="vku-form-group">
                <label for="f-category" class="vku-label">Nhóm hạng mục cơ sở <span class="req">*</span></label>
                <select id="f-category" class="vku-select" required>
                  <option value="">-- Chọn nhóm hạng mục --</option>
                  ${SURVEY_CATEGORIES.map(
                    (c) => `<option value="${c.name}">${c.icon} ${c.name}</option>`
                  ).join('')}
                </select>
              </div>

              <div class="vku-form-group">
                <label for="f-item" class="vku-label">Tên trang thiết bị cụ thể <span class="req">*</span></label>
                <input type="text" id="f-item" class="vku-input" placeholder="VD: Máy chiếu Panasonic, Quạt trần..." required />
              </div>
            </div>

            <!-- Status Rating (Severity) -->
            <div class="vku-form-group">
              <label class="vku-label">Mức độ hoạt động / Hỏng hóc <span class="req">*</span></label>
              <div class="vku-severity-group" id="f-severity-group">
                <label class="vku-severity-option opt-normal">
                  <input type="radio" name="severity" value="NORMAL" checked />
                  <span class="vku-severity-box">
                    <span class="vku-sev-icon">🟢</span>
                    <span class="vku-sev-title">Bình thường</span>
                    <span class="vku-sev-desc">Hoạt động tốt, ổn định</span>
                  </span>
                </label>

                <label class="vku-severity-option opt-minor">
                  <input type="radio" name="severity" value="MINOR" />
                  <span class="vku-severity-box">
                    <span class="vku-sev-icon">🟡</span>
                    <span class="vku-sev-title">Bảo trì nhẹ</span>
                    <span class="vku-sev-desc">Xuống cấp, chập chờn</span>
                  </span>
                </label>

                <label class="vku-severity-option opt-critical">
                  <input type="radio" name="severity" value="CRITICAL" />
                  <span class="vku-severity-box">
                    <span class="vku-sev-icon">🔴</span>
                    <span class="vku-sev-title">Hỏng nặng / Khẩn cấp</span>
                    <span class="vku-sev-desc">Nguy hiểm, ngưng hoạt động</span>
                  </span>
                </label>
              </div>
            </div>

            <!-- Notes -->
            <div class="vku-form-group">
              <label for="f-notes" class="vku-label">Mô tả chi tiết tình trạng</label>
              <textarea id="f-notes" class="vku-textarea" rows="3" placeholder="Ghi chú thêm về hiện trạng hỏng hóc, nguy cơ hoặc đề xuất sửa chữa..."></textarea>
            </div>
          </div>

          <!-- 3. Chụp ảnh hiện trường (Capacitor Camera Bridge) -->
          <div class="vku-form-section">
            <div class="vku-photo-header">
              <div>
                <h3 class="vku-section-title">
                  <span class="vku-section-num">3</span> Hình ảnh minh chứng hiện trường
                </h3>
                <p class="vku-section-sub">
                  ${platform === 'web' ? 'Chế độ Web Camera / Tải ảnh lên' : `Đang kết nối Capacitor ${platform.toUpperCase()} Camera`}
                </p>
              </div>
              <button type="button" id="vku-btn-camera" class="vku-btn-camera">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <span>Chụp ảnh mới</span>
              </button>
            </div>

            <div id="vku-photo-gallery" class="vku-photo-gallery">
              <div class="vku-photo-empty" id="vku-photo-empty">
                Chưa có hình ảnh. Bấm "Chụp ảnh mới" để thêm minh chứng hiện trường.
              </div>
            </div>
          </div>

          <!-- 4. Thông tin Cán bộ / Người kiểm tra -->
          <div class="vku-form-section">
            <h3 class="vku-section-title">
              <span class="vku-section-num">4</span> Thông tin người khảo sát
            </h3>

            <div class="vku-grid-2">
              <div class="vku-form-group">
                <label for="f-inspector-name" class="vku-label">Họ và tên cán bộ / Sinh viên <span class="req">*</span></label>
                <input type="text" id="f-inspector-name" class="vku-input" placeholder="VD: Hoàng Văn Quyến" required />
              </div>

              <div class="vku-form-group">
                <label for="f-inspector-email" class="vku-label">Email công vụ VKU (@vku.udn.vn) <span class="req">*</span></label>
                <input type="email" id="f-inspector-email" class="vku-input" placeholder="VD: quyenhv@vku.udn.vn" required />
              </div>
            </div>
          </div>

          <!-- Submit Bar -->
          <div class="vku-form-actions">
            <button type="button" id="vku-btn-clear-draft" class="vku-btn-secondary">
              Xóa bản nháp
            </button>

            <button type="submit" id="vku-btn-submit" class="vku-btn-primary">
              <span class="vku-btn-submit-icon">✓</span>
              <span>Lưu & Gửi Báo Cáo Khảo Sát</span>
            </button>
          </div>
        </form>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    const form = this.container.querySelector<HTMLFormElement>('#vku-survey-form');
    const cameraBtn = this.container.querySelector<HTMLButtonElement>('#vku-btn-camera');
    const gpsBtn = this.container.querySelector<HTMLButtonElement>('#vku-btn-gps');
    const clearDraftBtn = this.container.querySelector<HTMLButtonElement>('#vku-btn-clear-draft');

    // Auto-save on any input change
    form?.addEventListener('input', () => this.scheduleAutoSave());
    form?.addEventListener('change', () => this.scheduleAutoSave());

    // GPS Trigger
    gpsBtn?.addEventListener('click', async () => {
      await this.captureGps();
    });

    // Camera Trigger
    cameraBtn?.addEventListener('click', async () => {
      await this.capturePhoto();
    });

    // Clear Draft
    clearDraftBtn?.addEventListener('click', async () => {
      if (confirm('Bạn có chắc chắn muốn xóa bản nháp hiện tại không?')) {
        await dbManager.clearDraft();
        this.resetForm();
        notificationService.show('Đã xóa bản nháp!', 'info');
      }
    });

    // Form Submit
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit();
    });
  }

  private async captureGps(): Promise<void> {
    if (this.isCapturingGps) return;
    this.isCapturingGps = true;

    const gpsBtn = this.container.querySelector<HTMLButtonElement>('#vku-btn-gps');
    if (gpsBtn) gpsBtn.disabled = true;
    const spinner = this.container.querySelector('#vku-gps-spinner');
    if (spinner) spinner.className = 'vku-spin-active';

    try {
      notificationService.show('Đang lấy vị trí GPS...', 'info', 1500);
      const loc = await hardwareService.getCurrentLocation();
      this.location = loc;

      const display = this.container.querySelector('#vku-gps-display');
      const near = this.container.querySelector('#vku-gps-near');
      if (display) {
        display.textContent = `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)} (±${loc.accuracy || 10}m)`;
      }
      if (near && loc.buildingNear) {
        near.textContent = `📍 Gần: ${loc.buildingNear}`;
      }

      this.scheduleAutoSave();
      notificationService.show('Đã cập nhật tọa độ GPS!', 'success', 2000);
    } catch {
      notificationService.show('Không thể lấy tọa độ GPS', 'error');
    } finally {
      this.isCapturingGps = false;
      if (spinner) spinner.className = 'vku-spin-hidden';
      if (gpsBtn) gpsBtn.disabled = false;
    }
  }

  private async capturePhoto(): Promise<void> {
    if (this.isCapturingPhoto) return;
    this.isCapturingPhoto = true;

    try {
      const dataUrl = await hardwareService.takePhoto();
      if (dataUrl) {
        this.photos.push(dataUrl);
        this.renderPhotos();
        this.scheduleAutoSave();
        notificationService.show('Đã chụp ảnh thành công!', 'success', 2000);
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message !== 'Chưa chọn ảnh nào') {
        notificationService.show(`Lỗi chụp ảnh: ${e.message}`, 'error');
      }
    } finally {
      this.isCapturingPhoto = false;
    }
  }

  private renderPhotos(): void {
    const gallery = this.container.querySelector('#vku-photo-gallery');
    if (!gallery) return;

    if (this.photos.length === 0) {
      gallery.innerHTML = `
        <div class="vku-photo-empty" id="vku-photo-empty">
          Chưa có hình ảnh. Bấm "Chụp ảnh mới" để thêm minh chứng hiện trường.
        </div>
      `;
      return;
    }

    gallery.innerHTML = this.photos
      .map(
        (photo, idx) => `
        <div class="vku-photo-item">
          <img src="${photo}" alt="Hiện trường ${idx + 1}" class="vku-photo-thumb" />
          <button type="button" class="vku-photo-del" data-idx="${idx}" title="Xóa ảnh này">✕</button>
        </div>
      `
      )
      .join('');

    gallery.querySelectorAll<HTMLButtonElement>('.vku-photo-del').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx') || '-1', 10);
        if (idx >= 0) {
          this.photos.splice(idx, 1);
          this.renderPhotos();
          this.scheduleAutoSave();
        }
      });
    });
  }

  private scheduleAutoSave(): void {
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);

    const statusBadge = this.container.querySelector('#vku-draft-status');
    if (statusBadge) {
      statusBadge.classList.add('saving');
      const label = statusBadge.querySelector('.vku-draft-label');
      if (label) label.textContent = 'Đang lưu nháp...';
    }

    this.autoSaveTimer = window.setTimeout(async () => {
      await this.saveDraftToDb();
      if (statusBadge) {
        statusBadge.classList.remove('saving');
        const label = statusBadge.querySelector('.vku-draft-label');
        if (label) label.textContent = 'Bản nháp đã lưu';
      }
    }, 600);
  }

  private async saveDraftToDb(): Promise<void> {
    const buildingSelect = this.container.querySelector<HTMLSelectElement>('#f-building');
    const floorInput = this.container.querySelector<HTMLInputElement>('#f-floor');
    const roomInput = this.container.querySelector<HTMLInputElement>('#f-room');
    const categorySelect = this.container.querySelector<HTMLSelectElement>('#f-category');
    const itemInput = this.container.querySelector<HTMLInputElement>('#f-item');
    const severityRadio = this.container.querySelector<HTMLInputElement>('input[name="severity"]:checked');
    const notesInput = this.container.querySelector<HTMLTextAreaElement>('#f-notes');
    const inspectorName = this.container.querySelector<HTMLInputElement>('#f-inspector-name');
    const inspectorEmail = this.container.querySelector<HTMLInputElement>('#f-inspector-email');

    const buildingId = buildingSelect?.value || '';
    const buildingName = buildingSelect?.selectedOptions[0]?.text || '';

    const draft: SurveyDraft = {
      id: 'current_active_draft',
      buildingId,
      buildingName,
      floor: floorInput?.value || '',
      roomOrArea: roomInput?.value || '',
      category: categorySelect?.value || '',
      itemDescription: itemInput?.value || '',
      status: (severityRadio?.value as FacilityStatus) || 'NORMAL',
      notes: notesInput?.value || '',
      photos: this.photos,
      location: this.location,
      inspectorName: inspectorName?.value || '',
      inspectorEmail: inspectorEmail?.value || '',
      updatedAt: new Date().toISOString(),
    };

    await dbManager.saveDraft(draft);

    // Also persist inspector preference
    if (inspectorName?.value) {
      await dbManager.setSetting('last_inspector_name', inspectorName.value);
    }
    if (inspectorEmail?.value) {
      await dbManager.setSetting('last_inspector_email', inspectorEmail.value);
    }
  }

  private async loadDraftAndInspector(): Promise<void> {
    // 1. Load saved inspector profile
    const savedName = await dbManager.getSetting('last_inspector_name', '');
    const savedEmail = await dbManager.getSetting('last_inspector_email', '');

    const nameInput = this.container.querySelector<HTMLInputElement>('#f-inspector-name');
    const emailInput = this.container.querySelector<HTMLInputElement>('#f-inspector-email');
    if (nameInput && savedName) nameInput.value = savedName;
    if (emailInput && savedEmail) emailInput.value = savedEmail;

    // 2. Load draft if exists
    const draft = await dbManager.getDraft('current_active_draft');
    if (!draft) return;

    const buildingSelect = this.container.querySelector<HTMLSelectElement>('#f-building');
    const floorInput = this.container.querySelector<HTMLInputElement>('#f-floor');
    const roomInput = this.container.querySelector<HTMLInputElement>('#f-room');
    const categorySelect = this.container.querySelector<HTMLSelectElement>('#f-category');
    const itemInput = this.container.querySelector<HTMLInputElement>('#f-item');
    const notesInput = this.container.querySelector<HTMLTextAreaElement>('#f-notes');

    if (buildingSelect && draft.buildingId) buildingSelect.value = draft.buildingId;
    if (floorInput && draft.floor) floorInput.value = draft.floor;
    if (roomInput && draft.roomOrArea) roomInput.value = draft.roomOrArea;
    if (categorySelect && draft.category) categorySelect.value = draft.category;
    if (itemInput && draft.itemDescription) itemInput.value = draft.itemDescription;
    if (notesInput && draft.notes) notesInput.value = draft.notes;
    if (nameInput && draft.inspectorName) nameInput.value = draft.inspectorName;
    if (emailInput && draft.inspectorEmail) emailInput.value = draft.inspectorEmail;

    if (draft.status) {
      const radio = this.container.querySelector<HTMLInputElement>(`input[name="severity"][value="${draft.status}"]`);
      if (radio) radio.checked = true;
    }

    if (draft.location) {
      this.location = draft.location;
      const display = this.container.querySelector('#vku-gps-display');
      const near = this.container.querySelector('#vku-gps-near');
      if (display) {
        display.textContent = `${this.location.latitude.toFixed(5)}, ${this.location.longitude.toFixed(5)} (±${this.location.accuracy || 10}m)`;
      }
      if (near && this.location.buildingNear) {
        near.textContent = `📍 Gần: ${this.location.buildingNear}`;
      }
    }

    if (draft.photos && draft.photos.length > 0) {
      this.photos = [...draft.photos];
      this.renderPhotos();
    }
  }

  private async handleSubmit(): Promise<void> {
    const buildingSelect = this.container.querySelector<HTMLSelectElement>('#f-building');
    const floorInput = this.container.querySelector<HTMLInputElement>('#f-floor');
    const roomInput = this.container.querySelector<HTMLInputElement>('#f-room');
    const categorySelect = this.container.querySelector<HTMLSelectElement>('#f-category');
    const itemInput = this.container.querySelector<HTMLInputElement>('#f-item');
    const severityRadio = this.container.querySelector<HTMLInputElement>('input[name="severity"]:checked');
    const notesInput = this.container.querySelector<HTMLTextAreaElement>('#f-notes');
    const inspectorName = this.container.querySelector<HTMLInputElement>('#f-inspector-name');
    const inspectorEmail = this.container.querySelector<HTMLInputElement>('#f-inspector-email');

    // Validation
    if (!buildingSelect?.value) {
      notificationService.show('Vui lòng chọn tòa nhà VKU!', 'error');
      buildingSelect?.focus();
      return;
    }
    if (!floorInput?.value.trim() || !roomInput?.value.trim()) {
      notificationService.show('Vui lòng nhập số tầng và phòng/khu vực!', 'error');
      floorInput?.focus();
      return;
    }
    if (!categorySelect?.value) {
      notificationService.show('Vui lòng chọn nhóm hạng mục kiểm tra!', 'error');
      categorySelect?.focus();
      return;
    }
    if (!itemInput?.value.trim()) {
      notificationService.show('Vui lòng nhập tên trang thiết bị!', 'error');
      itemInput?.focus();
      return;
    }
    if (!inspectorName?.value.trim() || !inspectorEmail?.value.trim()) {
      notificationService.show('Vui lòng nhập đầy đủ thông tin người khảo sát!', 'error');
      inspectorName?.focus();
      return;
    }

    const buildingName = buildingSelect.selectedOptions[0]?.text || '';
    const now = new Date().toISOString();

    const newRecord: SurveyRecord = {
      id: 'vku_srv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      buildingId: buildingSelect.value,
      buildingName,
      floor: floorInput.value.trim(),
      roomOrArea: roomInput.value.trim(),
      category: categorySelect.value,
      itemDescription: itemInput.value.trim(),
      status: (severityRadio?.value as FacilityStatus) || 'NORMAL',
      notes: notesInput?.value.trim() || '',
      photos: [...this.photos],
      location: { ...this.location },
      inspectorName: inspectorName.value.trim(),
      inspectorEmail: inspectorEmail.value.trim(),
      createdAt: now,
      updatedAt: now,
      syncStatus: 'PENDING',
      syncRetryCount: 0,
    };

    // Submit via Sync Service (Saves to IndexedDB and syncs if online)
    await syncService.submitSurvey(newRecord);

    this.resetForm();
    this.props.onSuccess(newRecord);
  }

  private resetForm(): void {
    const form = this.container.querySelector<HTMLFormElement>('#vku-survey-form');
    if (!form) return;

    // Preserve inspector details
    const name = (this.container.querySelector('#f-inspector-name') as HTMLInputElement)?.value;
    const email = (this.container.querySelector('#f-inspector-email') as HTMLInputElement)?.value;

    form.reset();

    if (name) (this.container.querySelector('#f-inspector-name') as HTMLInputElement).value = name;
    if (email) (this.container.querySelector('#f-inspector-email') as HTMLInputElement).value = email;

    this.photos = [];
    this.renderPhotos();

    // Default severity back to NORMAL
    const radio = this.container.querySelector<HTMLInputElement>('input[name="severity"][value="NORMAL"]');
    if (radio) radio.checked = true;
  }
}
