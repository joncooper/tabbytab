import type { TabHistory } from '../types';

const DB_NAME = 'tabbytab';
const DB_VERSION = 1;
const STORE_NAME = 'tabHistory';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('windowId', 'tabInfo.windowId', { unique: false });
        store.createIndex('domain', 'tabInfo.domain', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('closed', 'closed', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      dbPromise = null;
      reject((event.target as IDBOpenDBRequest).error);
    };
  });

  return dbPromise;
}

/**
 * Add or update a tab history entry.
 */
export async function putTabHistory(entry: TabHistory): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get a single entry by ID.
 */
export async function getTabHistoryById(id: string): Promise<TabHistory | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result as TabHistory | undefined);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all tab history entries, sorted by timestamp descending.
 */
export async function getAllTabHistory(): Promise<TabHistory[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.index('timestamp').openCursor(null, 'prev');
    const results: TabHistory[] = [];

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        results.push(cursor.value as TabHistory);
        cursor.continue();
      } else {
        resolve(results);
      }
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Get tab history filtered by options (for export and display).
 */
export async function getFilteredTabHistory(options: {
  dateFrom?: number;
  dateTo?: number;
  includeClosed?: boolean;
  includeActive?: boolean;
  windowId?: number;
  domain?: string;
}): Promise<TabHistory[]> {
  const all = await getAllTabHistory();

  return all.filter((tab) => {
    if (options.dateFrom && tab.timestamp < options.dateFrom) return false;
    if (options.dateTo && tab.timestamp > options.dateTo) return false;
    if (options.includeClosed !== undefined && tab.closed !== options.includeClosed) return false;
    if (options.includeActive !== undefined && !tab.closed !== options.includeActive) return false;
    if (options.windowId !== undefined && tab.tabInfo.windowId !== options.windowId) return false;
    if (options.domain !== undefined && tab.tabInfo.domain !== options.domain) return false;
    return true;
  });
}

/**
 * Get unsynced tab history entries.
 */
export async function getUnsyncedTabs(): Promise<TabHistory[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const results: TabHistory[] = [];

    // Scan all entries since synced may be undefined (not just false)
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        const entry = cursor.value as TabHistory;
        if (!entry.synced) {
          results.push(entry);
        }
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

/**
 * Mark entries as synced by their IDs.
 */
export async function markTabsSynced(ids: string[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  for (const id of ids) {
    const request = store.get(id);
    request.onsuccess = () => {
      const entry = request.result as TabHistory | undefined;
      if (entry) {
        entry.synced = true;
        entry.syncedAt = Date.now();
        store.put(entry);
      }
    };
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Delete entries older than the given timestamp.
 */
export async function pruneOlderThan(cutoffTimestamp: number): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    const range = IDBKeyRange.upperBound(cutoffTimestamp);
    const request = index.openCursor(range);
    let deletedCount = 0;

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        const entry = cursor.value as TabHistory;
        // Only prune if synced (don't lose unsynced data)
        if (entry.synced) {
          cursor.delete();
          deletedCount++;
        }
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve(deletedCount);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Clear all tab history.
 */
export async function clearAllTabHistory(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get total count of entries.
 */
export async function getTabHistoryCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Migrate data from chrome.storage.local to IndexedDB.
 * Call once on upgrade. Safe to call multiple times (skips if no data).
 */
export async function migrateFromChromeStorage(): Promise<number> {
  const { tabHistory = [] } = await chrome.storage.local.get('tabHistory');

  if (tabHistory.length === 0) return 0;

  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  for (const entry of tabHistory) {
    store.put(entry);
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      // Clear the old storage after successful migration
      chrome.storage.local.remove('tabHistory');
      console.log(`Migrated ${tabHistory.length} entries from chrome.storage.local to IndexedDB`);
      resolve(tabHistory.length);
    };
    tx.onerror = () => reject(tx.error);
  });
}
