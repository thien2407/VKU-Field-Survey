import { SurveyRecord, SurveyDraft, SyncQueueItem } from '../types/survey.ts';

const DB_NAME = 'VKU_FIELD_SURVEY_DB';
const DB_VERSION = 1;

export const STORES = {
  DRAFTS: 'drafts',
  SURVEYS: 'surveys',
  SYNC_QUEUE: 'syncQueue',
  SETTINGS: 'settings',
} as const;

class IndexedDBManager {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. Drafts store
        if (!db.objectStoreNames.contains(STORES.DRAFTS)) {
          db.createObjectStore(STORES.DRAFTS, { keyPath: 'id' });
        }

        // 2. Surveys store
        if (!db.objectStoreNames.contains(STORES.SURVEYS)) {
          const surveyStore = db.createObjectStore(STORES.SURVEYS, { keyPath: 'id' });
          surveyStore.createIndex('syncStatus', 'syncStatus', { unique: false });
          surveyStore.createIndex('buildingId', 'buildingId', { unique: false });
          surveyStore.createIndex('createdAt', 'createdAt', { unique: false });
          surveyStore.createIndex('status', 'status', { unique: false });
        }

        // 3. Sync Queue store
        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          const queueStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
          queueStore.createIndex('status', 'status', { unique: false });
          queueStore.createIndex('queuedAt', 'queuedAt', { unique: false });
          queueStore.createIndex('surveyId', 'surveyId', { unique: false });
        }

        // 4. Settings store
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.initPromise;
  }

  // ==================== DRAFTS ====================
  async saveDraft(draft: SurveyDraft): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.DRAFTS, 'readwrite');
      const store = tx.objectStore(STORES.DRAFTS);
      const req = store.put(draft);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getDraft(id: string = 'current_active_draft'): Promise<SurveyDraft | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.DRAFTS, 'readonly');
      const store = tx.objectStore(STORES.DRAFTS);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async clearDraft(id: string = 'current_active_draft'): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.DRAFTS, 'readwrite');
      const store = tx.objectStore(STORES.DRAFTS);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ==================== SURVEYS ====================
  async saveSurvey(survey: SurveyRecord): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SURVEYS, 'readwrite');
      const store = tx.objectStore(STORES.SURVEYS);
      const req = store.put(survey);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getAllSurveys(): Promise<SurveyRecord[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SURVEYS, 'readonly');
      const store = tx.objectStore(STORES.SURVEYS);
      const req = store.getAll();
      req.onsuccess = () => {
        const list: SurveyRecord[] = req.result || [];
        // Sort newest first
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getSurveyById(id: string): Promise<SurveyRecord | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SURVEYS, 'readonly');
      const store = tx.objectStore(STORES.SURVEYS);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async updateSurveySyncStatus(id: string, syncStatus: SurveyRecord['syncStatus'], errorMsg?: string): Promise<void> {
    const survey = await this.getSurveyById(id);
    if (!survey) return;
    survey.syncStatus = syncStatus;
    survey.lastSyncAttempt = new Date().toISOString();
    if (errorMsg !== undefined) {
      survey.syncErrorMessage = errorMsg;
    }
    if (syncStatus === 'SYNCED') {
      survey.syncErrorMessage = undefined;
    }
    await this.saveSurvey(survey);
  }

  async deleteSurvey(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SURVEYS, 'readwrite');
      const store = tx.objectStore(STORES.SURVEYS);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ==================== SYNC QUEUE ====================
  async addToSyncQueue(item: SyncQueueItem): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
      const store = tx.objectStore(STORES.SYNC_QUEUE);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getPendingSyncItems(): Promise<SyncQueueItem[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SYNC_QUEUE, 'readonly');
      const store = tx.objectStore(STORES.SYNC_QUEUE);
      const req = store.getAll();
      req.onsuccess = () => {
        const list: SyncQueueItem[] = (req.result || []).filter(
          (i: SyncQueueItem) => i.status === 'PENDING' || i.status === 'FAILED'
        );
        // Sort oldest first for FIFO dispatch
        list.sort((a, b) => new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime());
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getAllSyncQueue(): Promise<SyncQueueItem[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SYNC_QUEUE, 'readonly');
      const store = tx.objectStore(STORES.SYNC_QUEUE);
      const req = store.getAll();
      req.onsuccess = () => {
        const list: SyncQueueItem[] = req.result || [];
        list.sort((a, b) => new Date(b.queuedAt).getTime() - new Date(a.queuedAt).getTime());
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async updateSyncQueueItem(item: SyncQueueItem): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
      const store = tx.objectStore(STORES.SYNC_QUEUE);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async removeFromSyncQueue(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
      const store = tx.objectStore(STORES.SYNC_QUEUE);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async clearCompletedSyncQueue(): Promise<void> {
    const all = await this.getAllSyncQueue();
    const db = await this.getDB();
    const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = tx.objectStore(STORES.SYNC_QUEUE);
    for (const item of all) {
      if (item.status === 'SYNCED') {
        store.delete(item.id);
      }
    }
  }

  // ==================== SETTINGS / PREFERENCES ====================
  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.SETTINGS, 'readonly');
      const store = tx.objectStore(STORES.SETTINGS);
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result && req.result.value !== undefined) {
          resolve(req.result.value);
        } else {
          resolve(defaultValue);
        }
      };
      req.onerror = () => resolve(defaultValue);
    });
  }

  async setSetting(key: string, value: unknown): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SETTINGS, 'readwrite');
      const store = tx.objectStore(STORES.SETTINGS);
      const req = store.put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

export const dbManager = new IndexedDBManager();
