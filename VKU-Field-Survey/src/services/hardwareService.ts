import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { GeoLocationCoord } from '../types/survey.ts';
import { VKU_BUILDINGS, VKU_CENTER } from '../data/campusData.ts';

// Calculate distance in meters using Haversine formula
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export function findNearestVKUBuilding(lat: number, lng: number): { name: string; distanceM: number } {
  let nearest = VKU_BUILDINGS[0];
  let minDistance = Infinity;

  for (const b of VKU_BUILDINGS) {
    const dist = calculateDistanceMeters(lat, lng, b.lat, b.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = b;
    }
  }

  return {
    name: nearest.name,
    distanceM: minDistance,
  };
}

class HardwareService {
  isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  getPlatformName(): string {
    return Capacitor.getPlatform();
  }

  /**
   * Capture photo via Capacitor Camera (Native) or Web HTML5 File Input
   */
  async takePhoto(): Promise<string> {
    if (this.isNative()) {
      try {
        const photo = await Camera.getPhoto({
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
          quality: 75,
          allowEditing: false,
          width: 1280,
          height: 960,
        });

        if (photo.dataUrl) {
          return photo.dataUrl;
        }
      } catch (err) {
        console.warn('Capacitor Camera error, falling back to Web File Picker:', err);
      }
    }

    // Web Fallback: Create dynamic file input with camera capture
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.setAttribute('capture', 'environment'); // Prefer back camera

      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          reject(new Error('Chưa chọn ảnh nào'));
          return;
        }

        try {
          const compressed = await this.compressImageFile(file, 1280, 0.75);
          resolve(compressed);
        } catch (e) {
          reject(e);
        }
      };

      input.onerror = () => reject(new Error('Không thể mở camera/thư viện ảnh'));
      input.click();
    });
  }

  /**
   * Get current GPS coordinates via Capacitor Geolocation or Web Geolocation API
   */
  async getCurrentLocation(): Promise<GeoLocationCoord> {
    if (this.isNative()) {
      try {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 12000,
        });

        const nearest = findNearestVKUBuilding(pos.coords.latitude, pos.coords.longitude);

        return {
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy),
          timestamp: pos.timestamp,
          buildingNear: `${nearest.name} (~${nearest.distanceM}m)`,
        };
      } catch (err) {
        console.warn('Capacitor Geolocation error, falling back to web:', err);
      }
    }

    // Web Geolocation fallback
    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) {
        // Fallback default to VKU Campus Center
        const nearest = findNearestVKUBuilding(VKU_CENTER.lat, VKU_CENTER.lng);
        resolve({
          latitude: VKU_CENTER.lat,
          longitude: VKU_CENTER.lng,
          accuracy: 50,
          timestamp: Date.now(),
          buildingNear: `${nearest.name} (Tọa độ mặc định VKU)`,
        });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const nearest = findNearestVKUBuilding(pos.coords.latitude, pos.coords.longitude);
          resolve({
            latitude: Number(pos.coords.latitude.toFixed(6)),
            longitude: Number(pos.coords.longitude.toFixed(6)),
            accuracy: Math.round(pos.coords.accuracy),
            timestamp: pos.timestamp,
            buildingNear: `${nearest.name} (~${nearest.distanceM}m)`,
          });
        },
        (err) => {
          console.warn('Web Geolocation error or denied:', err.message);
          // Graceful fallback to VKU Center
          const nearest = findNearestVKUBuilding(VKU_CENTER.lat, VKU_CENTER.lng);
          resolve({
            latitude: VKU_CENTER.lat,
            longitude: VKU_CENTER.lng,
            accuracy: 30,
            timestamp: Date.now(),
            buildingNear: `${nearest.name} (Khuôn viên VKU)`,
          });
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
    });
  }

  /**
   * Compress image client-side to save IndexedDB quota and network bandwidth
   */
  private compressImageFile(file: File, maxWidth: number, quality: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Không thể xử lý định dạng ảnh'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Không thể đọc file ảnh'));
      reader.readAsDataURL(file);
    });
  }
}

export const hardwareService = new HardwareService();
