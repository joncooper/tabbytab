export interface TabInfo {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  windowId: number;
  domain: string;
  active: boolean;
}

export interface TabGroup {
  name: string;
  tabs: TabInfo[];
  expanded: boolean;
}

export interface TabHistory {
  id: string;
  tabInfo: TabInfo;
  timestamp: number;
  closed: boolean;
  windowTitle?: string;
  summary?: string;
  synced?: boolean; // Whether this tab has been synced to remote storage
  syncedAt?: number; // Timestamp when synced
}

export interface TabHistoryGroup {
  name: string;
  tabs: TabHistory[];
  expanded: boolean;
}

export type GroupBy = 'window' | 'domain' | 'title';

export interface ProtectedPattern {
  id: string;
  pattern: string;
  enabled: boolean;
}

export interface SyncConfig {
  enabled: boolean;
  supabaseUrl: string;
  supabaseKey: string;
  lastSyncTime: number;
  autoSync: boolean; // Automatically sync every 5 minutes
  syncInterval: number; // Sync interval in milliseconds (default: 5 minutes)
  localRetentionDays: number; // How many days to keep locally after sync (default: 30)
}

export interface SyncStats {
  totalSynced: number;
  lastSyncTime: number;
  pendingSync: number;
  lastError?: string;
}

export interface ExportOptions {
  format: 'jsonl' | 'json' | 'csv';
  dateFrom?: number;
  dateTo?: number;
  includeClosed?: boolean;
  includeActive?: boolean;
}
