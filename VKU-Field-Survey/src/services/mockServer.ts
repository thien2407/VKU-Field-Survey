import { SurveyRecord, SyncQueueItem } from '../types/survey.ts';

export interface ServerSyncResponse {
  success: boolean;
  syncedSurveyId: string;
  serverTimestamp: string;
  message: string;
}

const SERVER_STORAGE_KEY = 'VKU_SERVER_DATABASE_MOCK';

export class MockVKUServer {
  private getServerDatabase(): SurveyRecord[] {
    try {
      const raw = localStorage.getItem(SERVER_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveServerDatabase(records: SurveyRecord[]): void {
    try {
      localStorage.setItem(SERVER_STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      console.error('Failed to save to mock server storage:', e);
    }
  }

  /**
   * Process a single survey sync request with simulated network delay
   */
  async processSurveySubmission(item: SyncQueueItem): Promise<ServerSyncResponse> {
    // Simulate network latency (350ms - 650ms)
    await new Promise((resolve) => setTimeout(resolve, 350 + Math.random() * 300));

    // Verify online status
    if (!navigator.onLine) {
      throw new Error('Mạng bị gián đoạn: Không thể kết nối tới máy chủ VKU');
    }

    const currentRecords = this.getServerDatabase();
    const existingIndex = currentRecords.findIndex((r) => r.id === item.surveyId);

    const syncedRecord: SurveyRecord = {
      ...item.payload,
      syncStatus: 'SYNCED',
      lastSyncAttempt: new Date().toISOString(),
      syncErrorMessage: undefined,
    };

    if (item.action === 'DELETE') {
      if (existingIndex >= 0) {
        currentRecords.splice(existingIndex, 1);
      }
    } else if (existingIndex >= 0) {
      // Update existing record
      currentRecords[existingIndex] = syncedRecord;
    } else {
      // Insert new record
      currentRecords.unshift(syncedRecord);
    }

    this.saveServerDatabase(currentRecords);

    return {
      success: true,
      syncedSurveyId: item.surveyId,
      serverTimestamp: new Date().toISOString(),
      message: `Đã tiếp nhận khảo sát #${item.surveyId.slice(0, 8)} tại ${item.payload.buildingName}`,
    };
  }

  /**
   * Get all records stored on the mock server
   */
  getServerRecords(): SurveyRecord[] {
    return this.getServerDatabase();
  }

  /**
   * Clear all records on mock server
   */
  clearServerData(): void {
    localStorage.removeItem(SERVER_STORAGE_KEY);
  }
}

export const mockServer = new MockVKUServer();
