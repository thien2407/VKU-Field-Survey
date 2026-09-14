export type FacilityStatus = 'NORMAL' | 'MINOR' | 'CRITICAL';

export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';

export interface GeoLocationCoord {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
  buildingNear?: string;
}

export interface SurveyRecord {
  id: string; // Unique survey UUID (generated client-side)
  buildingId: string;
  buildingName: string;
  floor: string;
  roomOrArea: string;
  category: string;
  itemDescription: string;
  status: FacilityStatus;
  notes: string;
  photos: string[]; // Base64 data URLs or Blob URLs
  location: GeoLocationCoord;
  inspectorName: string;
  inspectorEmail: string;
  createdAt: string; // ISO string
  updatedAt: string;
  syncStatus: SyncStatus;
  syncRetryCount: number;
  lastSyncAttempt?: string;
  syncErrorMessage?: string;
}

export interface SurveyDraft {
  id: string;
  buildingId: string;
  buildingName: string;
  floor: string;
  roomOrArea: string;
  category: string;
  itemDescription: string;
  status: FacilityStatus;
  notes: string;
  photos: string[];
  location?: GeoLocationCoord;
  inspectorName: string;
  inspectorEmail: string;
  updatedAt: string;
}

export interface SyncQueueItem {
  id: string; // ID of the sync queue task
  surveyId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: SurveyRecord;
  queuedAt: string;
  retryCount: number;
  status: SyncStatus;
  lastError?: string;
}

export interface CampusBuilding {
  id: string;
  name: string;
  code: string;
  floors: number;
  type: 'ACADEMIC' | 'ADMIN' | 'DORM' | 'SPORTS' | 'SERVICES';
  lat: number;
  lng: number;
  description: string;
}

export interface CategoryOption {
  id: string;
  name: string;
  icon: string;
  subItems: string[];
}
