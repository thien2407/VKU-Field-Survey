import { Capacitor } from '@capacitor/core';
import { Toast } from '@capacitor/toast';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

class NotificationService {
  private container: HTMLDivElement | null = null;

  private getContainer(): HTMLDivElement {
    if (!this.container || !document.body.contains(this.container)) {
      this.container = document.createElement('div');
      this.container.className = 'vku-toast-container';
      document.body.appendChild(this.container);
    }
    return this.container;
  }

  async show(message: string, type: ToastType = 'info', durationMs: number = 3200): Promise<void> {
    // If native Capacitor, also invoke native toast
    if (Capacitor.isNativePlatform()) {
      try {
        await Toast.show({
          text: message,
          duration: durationMs > 2500 ? 'long' : 'short',
          position: 'bottom',
        });
      } catch (e) {
        console.warn('Native toast failed, using web toast:', e);
      }
    }

    // Web toast representation
    const container = this.getContainer();
    const toast = document.createElement('div');
    toast.className = `vku-toast vku-toast-${type}`;

    const icons: Record<ToastType, string> = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ',
    };

    toast.innerHTML = `
      <span class="vku-toast-icon">${icons[type]}</span>
      <span class="vku-toast-msg">${message}</span>
    `;

    container.appendChild(toast);

    // Audio cue for feedback (Web Audio API synthetic chime)
    this.playTone(type);

    setTimeout(() => {
      toast.classList.add('vku-toast-hide');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, durationMs);
  }

  private playTone(type: ToastType): void {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.04, now);

      if (type === 'success') {
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.08); // A5
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'error') {
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.setValueAtTime(200, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else {
        osc.frequency.setValueAtTime(520, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      }
    } catch {
      // Audio not supported or blocked by autoplay policy
    }
  }
}

export const notificationService = new NotificationService();
