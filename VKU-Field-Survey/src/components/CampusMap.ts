import { VKU_BUILDINGS } from '../data/campusData.ts';
import { dbManager } from '../db/indexedDB.ts';
import { SurveyRecord, CampusBuilding } from '../types/survey.ts';

interface CampusMapProps {
  onSelectBuildingForSurvey: (buildingId: string) => void;
}

export class CampusMapComponent {
  private container: HTMLElement;
  private props: CampusMapProps;
  private surveys: SurveyRecord[] = [];
  private selectedBuilding: CampusBuilding | null = null;

  constructor(containerId: string, props: CampusMapProps) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.props = props;

    this.loadDataAndRender();
  }

  async loadDataAndRender(): Promise<void> {
    this.surveys = await dbManager.getAllSurveys();
    this.render();
  }

  private getBuildingStats(buildingId: string) {
    const bSurveys = this.surveys.filter((s) => s.buildingId === buildingId);
    return {
      total: bSurveys.length,
      normal: bSurveys.filter((s) => s.status === 'NORMAL').length,
      minor: bSurveys.filter((s) => s.status === 'MINOR').length,
      critical: bSurveys.filter((s) => s.status === 'CRITICAL').length,
    };
  }

  render(): void {
    const selected = this.selectedBuilding || VKU_BUILDINGS[0];
    const stats = this.getBuildingStats(selected.id);

    this.container.innerHTML = `
      <div class="vku-map-layout">
        <!-- Main Interactive Campus Map Frame -->
        <div class="vku-card vku-map-container">
          <div class="vku-card-header">
            <div>
              <h2 class="vku-card-title">🗺️ Sơ đồ Tọa độ Khuôn viên Đại học VKU</h2>
              <p class="vku-card-sub">Bản đồ thực địa ngoại tuyến • Tọa độ GPS & Điểm khảo sát thực tế</p>
            </div>
            <div class="vku-map-legend">
              <span class="vku-legend-item"><span class="legend-dot normal"></span> Bình thường</span>
              <span class="vku-legend-item"><span class="legend-dot minor"></span> Cần bảo trì</span>
              <span class="vku-legend-item"><span class="legend-dot critical"></span> Khẩn cấp</span>
            </div>
          </div>

          <!-- Interactive Vector Map of VKU Campus -->
          <div class="vku-map-canvas-wrap">
            <svg class="vku-campus-svg" viewBox="0 0 900 560" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="vkuGreenArea" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#0F2D1F"/>
                  <stop offset="100%" stop-color="#0A1F16"/>
                </linearGradient>
                <linearGradient id="vkuBuildingGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#1E3A8A"/>
                  <stop offset="100%" stop-color="#0F172A"/>
                </linearGradient>
                <linearGradient id="vkuSelectedBld" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#F97316"/>
                  <stop offset="100%" stop-color="#EA580C"/>
                </linearGradient>
                <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.04)" stroke-width="1"/>
                </pattern>
              </defs>

              <!-- Campus Ground background -->
              <rect width="900" height="560" fill="url(#vkuGreenArea)"/>
              <rect width="900" height="560" fill="url(#gridPattern)"/>

              <!-- Campus Roads & Pathways -->
              <!-- Main Entrance Road: Nam Ky Khoi Nghia -->
              <rect x="20" y="490" width="860" height="45" rx="6" fill="#1E293B" stroke="#334155" stroke-width="2"/>
              <text x="450" y="518" font-family="sans-serif" font-weight="bold" font-size="14" fill="#94A3B8" text-anchor="middle" letter-spacing="4">
                TRỤC ĐƯỜNG NAM KỲ KHỞI NGHĨA • CỔNG CHÍNH ĐẠI HỌC VKU
              </text>

              <!-- Central Internal Spine Boulevard -->
              <rect x="420" y="50" width="60" height="440" rx="4" fill="#1E293B" stroke="#334155" stroke-width="1.5"/>
              <!-- Cross Roads -->
              <rect x="80" y="240" width="740" height="36" rx="4" fill="#1E293B" stroke="#334155" stroke-width="1.5"/>

              <!-- Central Green Plaza & VKU Emblem fountain -->
              <circle cx="450" cy="258" r="48" fill="#065F46" stroke="#10B981" stroke-width="2"/>
              <circle cx="450" cy="258" r="28" fill="#047857"/>
              <text x="450" y="263" font-family="sans-serif" font-weight="900" font-size="14" fill="#FFFFFF" text-anchor="middle">VKU PLAZA</text>

              <!-- Buildings Map layout (Interactive SVG Groups) -->
              <!-- 1. Khu A (Hiệu bộ) - Front Center-Left -->
              <g class="vku-svg-building" data-bld="bld-a" transform="translate(180, 310)">
                <rect width="190" height="130" rx="12" fill="${selected.id === 'bld-a' ? 'url(#vkuSelectedBld)' : 'url(#vkuBuildingGrad)'}" stroke="${selected.id === 'bld-a' ? '#F97316' : '#38BDF8'}" stroke-width="2.5"/>
                <text x="95" y="45" font-family="sans-serif" font-weight="bold" font-size="18" fill="#FFFFFF" text-anchor="middle">KHU A</text>
                <text x="95" y="70" font-family="sans-serif" font-size="12" fill="#BAE6FD" text-anchor="middle">Tòa Nhà Hiệu Bộ</text>
                <text x="95" y="92" font-family="sans-serif" font-size="11" fill="#94A3B8" text-anchor="middle">6 Tầng • Ban Giám Hiệu</text>
                ${this.renderBuildingBadgeSvg('bld-a', 155, 30)}
              </g>

              <!-- 2. Khu B (CNTT) - Back Left -->
              <g class="vku-svg-building" data-bld="bld-b" transform="translate(140, 80)">
                <rect width="230" height="120" rx="12" fill="${selected.id === 'bld-b' ? 'url(#vkuSelectedBld)' : 'url(#vkuBuildingGrad)'}" stroke="${selected.id === 'bld-b' ? '#F97316' : '#38BDF8'}" stroke-width="2.5"/>
                <text x="115" y="45" font-family="sans-serif" font-weight="bold" font-size="18" fill="#FFFFFF" text-anchor="middle">KHU B - KHOA CNTT</text>
                <text x="115" y="70" font-family="sans-serif" font-size="12" fill="#BAE6FD" text-anchor="middle">Giảng Đường & Phòng Lab AI</text>
                <text x="115" y="92" font-family="sans-serif" font-size="11" fill="#94A3B8" text-anchor="middle">5 Tầng • Giảng dạy chính</text>
                ${this.renderBuildingBadgeSvg('bld-b', 195, 30)}
              </g>

              <!-- 3. Khu C (Kỹ thuật Máy tính / IoT) - Back Right -->
              <g class="vku-svg-building" data-bld="bld-c" transform="translate(530, 80)">
                <rect width="210" height="120" rx="12" fill="${selected.id === 'bld-c' ? 'url(#vkuSelectedBld)' : 'url(#vkuBuildingGrad)'}" stroke="${selected.id === 'bld-c' ? '#F97316' : '#38BDF8'}" stroke-width="2.5"/>
                <text x="105" y="45" font-family="sans-serif" font-weight="bold" font-size="18" fill="#FFFFFF" text-anchor="middle">KHU C</text>
                <text x="105" y="70" font-family="sans-serif" font-size="12" fill="#BAE6FD" text-anchor="middle">KTMT & Viễn Thông</text>
                <text x="105" y="92" font-family="sans-serif" font-size="11" fill="#94A3B8" text-anchor="middle">5 Tầng • Xưởng thực hành</text>
                ${this.renderBuildingBadgeSvg('bld-c', 175, 30)}
              </g>

              <!-- 4. Thư viện số VKU - Front Right -->
              <g class="vku-svg-building" data-bld="bld-lib" transform="translate(530, 310)">
                <rect width="180" height="130" rx="12" fill="${selected.id === 'bld-lib' ? 'url(#vkuSelectedBld)' : 'url(#vkuBuildingGrad)'}" stroke="${selected.id === 'bld-lib' ? '#F97316' : '#38BDF8'}" stroke-width="2.5"/>
                <text x="90" y="45" font-family="sans-serif" font-weight="bold" font-size="18" fill="#FFFFFF" text-anchor="middle">THƯ VIỆN SỐ</text>
                <text x="90" y="70" font-family="sans-serif" font-size="12" fill="#BAE6FD" text-anchor="middle">Digital Library & Co-work</text>
                <text x="90" y="92" font-family="sans-serif" font-size="11" fill="#94A3B8" text-anchor="middle">4 Tầng • Tự học & Nghiên cứu</text>
                ${this.renderBuildingBadgeSvg('bld-lib', 145, 30)}
              </g>

              <!-- 5. Ký Túc Xá Sinh Viên - Far Right -->
              <g class="vku-svg-building" data-bld="bld-ktx" transform="translate(740, 290)">
                <rect width="130" height="150" rx="12" fill="${selected.id === 'bld-ktx' ? 'url(#vkuSelectedBld)' : 'url(#vkuBuildingGrad)'}" stroke="${selected.id === 'bld-ktx' ? '#F97316' : '#38BDF8'}" stroke-width="2.5"/>
                <text x="65" y="55" font-family="sans-serif" font-weight="bold" font-size="16" fill="#FFFFFF" text-anchor="middle">KTX VKU</text>
                <text x="65" y="80" font-family="sans-serif" font-size="11" fill="#BAE6FD" text-anchor="middle">Ký Túc Xá</text>
                <text x="65" y="102" font-family="sans-serif" font-size="10" fill="#94A3B8" text-anchor="middle">6 Tầng</text>
                ${this.renderBuildingBadgeSvg('bld-ktx', 95, 30)}
              </g>

              <!-- 6. Nhà thể thao đa năng - Far Top Right -->
              <g class="vku-svg-building" data-bld="bld-sports" transform="translate(760, 70)">
                <rect width="120" height="130" rx="12" fill="${selected.id === 'bld-sports' ? 'url(#vkuSelectedBld)' : 'url(#vkuBuildingGrad)'}" stroke="${selected.id === 'bld-sports' ? '#F97316' : '#38BDF8'}" stroke-width="2"/>
                <text x="60" y="50" font-family="sans-serif" font-weight="bold" font-size="14" fill="#FFFFFF" text-anchor="middle">THỂ THAO</text>
                <text x="60" y="75" font-family="sans-serif" font-size="11" fill="#BAE6FD" text-anchor="middle">Nhà đa năng</text>
                ${this.renderBuildingBadgeSvg('bld-sports', 85, 25)}
              </g>

              <!-- Survey GPS Pins overlay -->
              ${this.renderSurveyPinsSvg()}
            </svg>
          </div>
        </div>

        <!-- Building Details Sidebar -->
        <div class="vku-card vku-building-sidebar">
          <div class="vku-sidebar-header">
            <span class="vku-badge status-normal">${selected.code}</span>
            <h3 class="vku-sidebar-title">${selected.name}</h3>
            <p class="vku-sidebar-desc">${selected.description}</p>
          </div>

          <div class="vku-sidebar-stats">
            <div class="vku-side-stat">
              <span class="side-stat-label">Tổng khảo sát</span>
              <span class="side-stat-val">${stats.total}</span>
            </div>
            <div class="vku-side-stat">
              <span class="side-stat-label">🟢 Ổn định</span>
              <span class="side-stat-val text-green">${stats.normal}</span>
            </div>
            <div class="vku-side-stat">
              <span class="side-stat-label">🟡 Cần sửa</span>
              <span class="side-stat-val text-yellow">${stats.minor}</span>
            </div>
            <div class="vku-side-stat">
              <span class="side-stat-label">🔴 Cấp bách</span>
              <span class="side-stat-val text-red">${stats.critical}</span>
            </div>
          </div>

          <div class="vku-sidebar-actions">
            <button type="button" id="vku-btn-survey-this-bld" class="vku-btn-primary" style="width: 100%;">
              + Tạo khảo sát cho tòa nhà này
            </button>
          </div>

          <!-- List of recent surveys in this building -->
          <div class="vku-bld-surveys">
            <h4 class="vku-bld-surveys-title">Các điểm kiểm tra gần đây:</h4>
            ${this.renderBuildingRecentSurveys(selected.id)}
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private renderBuildingBadgeSvg(bldId: string, x: number, y: number): string {
    const stats = this.getBuildingStats(bldId);
    if (stats.total === 0) return '';

    const color = stats.critical > 0 ? '#EF4444' : stats.minor > 0 ? '#F59E0B' : '#10B981';
    return `
      <circle cx="${x}" cy="${y}" r="12" fill="${color}" stroke="#FFFFFF" stroke-width="2"/>
      <text x="${x}" y="${y + 4}" font-family="sans-serif" font-weight="bold" font-size="11" fill="#FFFFFF" text-anchor="middle">
        ${stats.total}
      </text>
    `;
  }

  private renderSurveyPinsSvg(): string {
    // Map buildings coordinates to SVG coordinates
    const bldCoords: Record<string, { x: number; y: number }> = {
      'bld-a': { x: 275, y: 375 },
      'bld-b': { x: 255, y: 140 },
      'bld-c': { x: 635, y: 140 },
      'bld-lib': { x: 620, y: 375 },
      'bld-ktx': { x: 805, y: 365 },
      'bld-sports': { x: 820, y: 135 },
      'bld-v': { x: 450, y: 130 },
      'bld-canteen': { x: 450, y: 380 },
    };

    return this.surveys
      .slice(0, 30) // Render up to 30 pins
      .map((s, idx) => {
        const base = bldCoords[s.buildingId] || { x: 450, y: 250 };
        // Small scatter jitter so multiple pins in same building don't overlap completely
        const offsetX = ((idx * 23) % 40) - 20;
        const offsetY = ((idx * 17) % 30) - 15;
        const x = base.x + offsetX;
        const y = base.y + offsetY;

        const pinColor = s.status === 'CRITICAL' ? '#EF4444' : s.status === 'MINOR' ? '#F59E0B' : '#10B981';

        return `
          <g class="vku-map-pin" transform="translate(${x}, ${y})">
            <circle cx="0" cy="0" r="8" fill="${pinColor}" stroke="#FFFFFF" stroke-width="1.8"/>
            <circle cx="0" cy="0" r="3" fill="#FFFFFF"/>
          </g>
        `;
      })
      .join('');
  }

  private renderBuildingRecentSurveys(buildingId: string): string {
    const bSurveys = this.surveys.filter((s) => s.buildingId === buildingId).slice(0, 5);
    if (bSurveys.length === 0) {
      return `<p class="vku-empty-text">Chưa có khảo sát nào tại tòa nhà này.</p>`;
    }

    return `
      <ul class="vku-bld-survey-list">
        ${bSurveys
          .map(
            (s) => `
          <li class="vku-bld-survey-item">
            <div class="bld-item-top">
              <span class="bld-item-name">${s.itemDescription}</span>
              <span class="bld-item-badge ${s.status === 'CRITICAL' ? 'crit' : s.status === 'MINOR' ? 'min' : 'norm'}">
                ${s.status === 'CRITICAL' ? 'Cấp bách' : s.status === 'MINOR' ? 'Bảo trì' : 'Ổn định'}
              </span>
            </div>
            <div class="bld-item-sub">
              ${s.floor} (${s.roomOrArea}) • ${s.syncStatus === 'SYNCED' ? '✓ Đã đồng bộ' : '⏳ Chờ đồng bộ'}
            </div>
          </li>
        `
          )
          .join('')}
      </ul>
    `;
  }

  private bindEvents(): void {
    // Click building SVG
    this.container.querySelectorAll<SVGGElement>('.vku-svg-building').forEach((el) => {
      el.addEventListener('click', () => {
        const bldId = el.getAttribute('data-bld');
        const bld = VKU_BUILDINGS.find((b) => b.id === bldId);
        if (bld) {
          this.selectedBuilding = bld;
          this.render();
        }
      });
    });

    // Create survey for selected building button
    this.container.querySelector('#vku-btn-survey-this-bld')?.addEventListener('click', () => {
      const selected = this.selectedBuilding || VKU_BUILDINGS[0];
      this.props.onSelectBuildingForSurvey(selected.id);
    });
  }
}
