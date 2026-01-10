import { getSupabaseClient, getSyncConfig } from '../lib/supabase-client';
import type { TabHistory, SyncStats } from '../types';

const BATCH_SIZE = 100; // Sync 100 tabs at a time
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

/**
 * Sync unsynced tabs to Supabase
 */
export async function syncTabsToSupabase(): Promise<{
  success: boolean;
  syncedCount: number;
  error?: string;
}> {
  try {
    const config = await getSyncConfig();
    if (!config.enabled) {
      return { success: false, syncedCount: 0, error: 'Sync not enabled' };
    }

    const client = await getSupabaseClient();
    if (!client) {
      return {
        success: false,
        syncedCount: 0,
        error: 'Supabase client not initialized',
      };
    }

    // Get unsynced tabs from local storage
    const unsyncedTabs = await getUnsyncedTabs();
    if (unsyncedTabs.length === 0) {
      return { success: true, syncedCount: 0 };
    }

    let totalSynced = 0;

    // Process in batches
    for (let i = 0; i < unsyncedTabs.length; i += BATCH_SIZE) {
      const batch = unsyncedTabs.slice(i, i + BATCH_SIZE);

      // Transform for Supabase (flatten structure)
      const records = batch.map((tab) => ({
        id: tab.id,
        tab_id: tab.tabInfo.id,
        title: tab.tabInfo.title,
        url: tab.tabInfo.url,
        domain: tab.tabInfo.domain,
        favicon_url: tab.tabInfo.favIconUrl,
        window_id: tab.tabInfo.windowId,
        window_title: tab.windowTitle,
        summary: tab.summary,
        timestamp: new Date(tab.timestamp).toISOString(),
        closed: tab.closed,
      }));

      // Insert to Supabase with retry logic
      let retries = 0;
      let success = false;

      while (retries < MAX_RETRIES && !success) {
        try {
          const { error } = await client.from('tab_history').upsert(records, {
            onConflict: 'id',
            ignoreDuplicates: false,
          });

          if (error) {
            throw error;
          }

          success = true;
          totalSynced += batch.length;

          // Mark as synced in local storage
          await markTabsAsSynced(batch.map((t) => t.id));
        } catch (error) {
          retries++;
          if (retries < MAX_RETRIES) {
            await new Promise((resolve) =>
              setTimeout(resolve, RETRY_DELAY_MS * retries)
            );
          } else {
            throw error;
          }
        }
      }
    }

    // Update sync stats
    await updateSyncStats({
      totalSynced,
      lastSyncTime: Date.now(),
      pendingSync: 0,
    });

    // Prune old local history if needed
    await pruneLocalHistory();

    return { success: true, syncedCount: totalSynced };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('Sync error:', errorMessage);

    await updateSyncStats({
      lastError: errorMessage,
    });

    return {
      success: false,
      syncedCount: 0,
      error: errorMessage,
    };
  }
}

/**
 * Get tabs that haven't been synced yet
 */
async function getUnsyncedTabs(): Promise<TabHistory[]> {
  try {
    const { tabHistory = [] } = await chrome.storage.local.get('tabHistory');
    return tabHistory.filter((tab: TabHistory) => !tab.synced);
  } catch (error) {
    console.error('Error getting unsynced tabs:', error);
    return [];
  }
}

/**
 * Mark tabs as synced in local storage
 */
async function markTabsAsSynced(tabIds: string[]): Promise<void> {
  try {
    const { tabHistory = [] } = await chrome.storage.local.get('tabHistory');
    const now = Date.now();

    const updated = tabHistory.map((tab: TabHistory) =>
      tabIds.includes(tab.id) ? { ...tab, synced: true, syncedAt: now } : tab
    );

    await chrome.storage.local.set({ tabHistory: updated });
  } catch (error) {
    console.error('Error marking tabs as synced:', error);
  }
}

/**
 * Prune old synced tabs from local storage based on retention policy
 */
async function pruneLocalHistory(): Promise<void> {
  try {
    const config = await getSyncConfig();
    if (!config.enabled || config.localRetentionDays <= 0) {
      return;
    }

    const cutoffTime =
      Date.now() - config.localRetentionDays * 24 * 60 * 60 * 1000;
    const { tabHistory = [] } = await chrome.storage.local.get('tabHistory');

    // Keep unsynced tabs or tabs within retention period
    const filtered = tabHistory.filter(
      (tab: TabHistory) => !tab.synced || tab.timestamp > cutoffTime
    );

    if (filtered.length < tabHistory.length) {
      await chrome.storage.local.set({ tabHistory: filtered });
      console.log(
        `Pruned ${tabHistory.length - filtered.length} old synced tabs from local storage`
      );
    }
  } catch (error) {
    console.error('Error pruning local history:', error);
  }
}

/**
 * Update sync statistics
 */
async function updateSyncStats(updates: Partial<SyncStats>): Promise<void> {
  try {
    const { syncStats = {} } = await chrome.storage.local.get('syncStats');
    const updated: SyncStats = {
      totalSynced: syncStats.totalSynced || 0,
      lastSyncTime: syncStats.lastSyncTime || 0,
      pendingSync: syncStats.pendingSync || 0,
      ...updates,
    };
    await chrome.storage.local.set({ syncStats: updated });
  } catch (error) {
    console.error('Error updating sync stats:', error);
  }
}

/**
 * Get current sync statistics
 */
export async function getSyncStats(): Promise<SyncStats> {
  try {
    const { syncStats = {} } = await chrome.storage.local.get('syncStats');
    const { tabHistory = [] } = await chrome.storage.local.get('tabHistory');

    const pendingSync = tabHistory.filter(
      (tab: TabHistory) => !tab.synced
    ).length;

    return {
      totalSynced: syncStats.totalSynced || 0,
      lastSyncTime: syncStats.lastSyncTime || 0,
      pendingSync,
      lastError: syncStats.lastError,
    };
  } catch (error) {
    console.error('Error getting sync stats:', error);
    return {
      totalSynced: 0,
      lastSyncTime: 0,
      pendingSync: 0,
    };
  }
}

/**
 * Manual sync trigger
 */
export async function triggerManualSync(): Promise<{
  success: boolean;
  message: string;
}> {
  const result = await syncTabsToSupabase();

  if (result.success) {
    return {
      success: true,
      message: `Successfully synced ${result.syncedCount} tabs`,
    };
  } else {
    return {
      success: false,
      message: result.error || 'Sync failed',
    };
  }
}
