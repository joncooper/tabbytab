import { getSupabaseClient, getSyncConfig } from '../lib/supabase-client';
import type { TabHistory, ExportOptions } from '../types';
import { getFilteredTabHistory, getAllTabHistory } from '../lib/tab-history-db';

/**
 * Export tab history in various formats for LLM processing
 */
export async function exportTabHistory(
  options: ExportOptions
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    const tabs = await getTabHistoryForExport(options);

    if (tabs.length === 0) {
      return {
        success: false,
        error: 'No tabs found matching the export criteria',
      };
    }

    let data: string;

    switch (options.format) {
      case 'jsonl':
        data = exportAsJSONL(tabs);
        break;
      case 'json':
        data = exportAsJSON(tabs);
        break;
      case 'csv':
        data = exportAsCSV(tabs);
        break;
      default:
        return { success: false, error: 'Invalid export format' };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Export error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get tab history from Supabase or local storage based on configuration
 */
async function getTabHistoryForExport(
  options: ExportOptions
): Promise<TabHistory[]> {
  const config = await getSyncConfig();

  // If sync is enabled, fetch from Supabase (unlimited history)
  if (config.enabled) {
    return await getTabHistoryFromSupabase(options);
  }

  // Otherwise, use local storage (limited history)
  return await getTabHistoryFromLocal(options);
}

/**
 * Fetch tab history from Supabase
 */
async function getTabHistoryFromSupabase(
  options: ExportOptions
): Promise<TabHistory[]> {
  const client = await getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client not initialized');
  }

  let query = client.from('tab_history').select('*');

  // Apply filters
  if (options.dateFrom) {
    query = query.gte('timestamp', new Date(options.dateFrom).toISOString());
  }

  if (options.dateTo) {
    query = query.lte('timestamp', new Date(options.dateTo).toISOString());
  }

  if (options.includeClosed !== undefined && !options.includeClosed) {
    query = query.eq('closed', false);
  }

  if (options.includeActive !== undefined && !options.includeActive) {
    query = query.eq('closed', true);
  }

  // Order by timestamp descending
  query = query.order('timestamp', { ascending: false });

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  // Transform Supabase data back to TabHistory format
  return (data || []).map((record) => ({
    id: record.id,
    tabInfo: {
      id: record.tab_id,
      title: record.title,
      url: record.url,
      domain: record.domain,
      favIconUrl: record.favicon_url,
      windowId: record.window_id,
      active: false, // Not stored in remote
    },
    timestamp: new Date(record.timestamp).getTime(),
    closed: record.closed,
    windowTitle: record.window_title,
    summary: record.summary,
    synced: true,
    syncedAt: new Date(record.timestamp).getTime(),
  }));
}

/**
 * Get tab history from IndexedDB
 */
async function getTabHistoryFromLocal(
  options: ExportOptions
): Promise<TabHistory[]> {
  return getFilteredTabHistory({
    dateFrom: options.dateFrom,
    dateTo: options.dateTo,
    includeClosed: options.includeClosed,
    includeActive: options.includeActive,
  });
}

/**
 * Export as JSONL (JSON Lines) - Best for LLM streaming/batch processing
 */
function exportAsJSONL(tabs: TabHistory[]): string {
  return tabs
    .map((tab) => {
      const record: Record<string, unknown> = {
        id: tab.id,
        url: tab.tabInfo.url,
        domain: tab.tabInfo.domain,
        title: tab.tabInfo.title,
        summary: tab.summary || '',
        timestamp: new Date(tab.timestamp).toISOString(),
        closed: tab.closed,
        windowTitle: tab.windowTitle || '',
      };
      if (tab.pageContent) {
        record.pageContent = tab.pageContent;
      }
      return JSON.stringify(record);
    })
    .join('\n');
}

/**
 * Export as JSON - Structured format
 */
function exportAsJSON(tabs: TabHistory[]): string {
  const records = tabs.map((tab) => ({
    id: tab.id,
    url: tab.tabInfo.url,
    domain: tab.tabInfo.domain,
    title: tab.tabInfo.title,
    summary: tab.summary || '',
    timestamp: new Date(tab.timestamp).toISOString(),
    closed: tab.closed,
    windowTitle: tab.windowTitle || '',
    favIconUrl: tab.tabInfo.favIconUrl,
  }));

  return JSON.stringify(
    {
      exportDate: new Date().toISOString(),
      totalRecords: records.length,
      records,
    },
    null,
    2
  );
}

/**
 * Export as CSV - For spreadsheet analysis
 */
function exportAsCSV(tabs: TabHistory[]): string {
  const headers = [
    'id',
    'timestamp',
    'url',
    'domain',
    'title',
    'summary',
    'closed',
    'windowTitle',
  ];

  const rows = tabs.map((tab) => [
    tab.id,
    new Date(tab.timestamp).toISOString(),
    `"${escapeCsvField(tab.tabInfo.url)}"`,
    `"${escapeCsvField(tab.tabInfo.domain)}"`,
    `"${escapeCsvField(tab.tabInfo.title)}"`,
    `"${escapeCsvField(tab.summary || '')}"`,
    tab.closed,
    `"${escapeCsvField(tab.windowTitle || '')}"`,
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

/**
 * Escape CSV field by replacing quotes
 */
function escapeCsvField(field: string): string {
  return field.replace(/"/g, '""');
}

/**
 * Download export data as file
 */
export function downloadExportFile(
  data: string,
  format: 'jsonl' | 'json' | 'csv'
): void {
  const blob = new Blob([data], {
    type: format === 'csv' ? 'text/csv' : 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `tabbytab-export-${timestamp}.${format}`;

  chrome.downloads.download({
    url,
    filename,
    saveAs: true,
  });
}

/**
 * Get export statistics
 */
export async function getExportStats(): Promise<{
  totalTabs: number;
  closedTabs: number;
  activeTabs: number;
  oldestTab: number | null;
  newestTab: number | null;
}> {
  const config = await getSyncConfig();
  let tabs: TabHistory[];

  if (config.enabled) {
    tabs = await getTabHistoryFromSupabase({
      format: 'json',
      includeClosed: true,
      includeActive: true,
    });
  } else {
    tabs = await getAllTabHistory();
  }

  const closedTabs = tabs.filter((t) => t.closed).length;
  const activeTabs = tabs.filter((t) => !t.closed).length;

  const timestamps = tabs.map((t) => t.timestamp).filter((t) => t);
  const oldestTab = timestamps.length > 0 ? Math.min(...timestamps) : null;
  const newestTab = timestamps.length > 0 ? Math.max(...timestamps) : null;

  return {
    totalTabs: tabs.length,
    closedTabs,
    activeTabs,
    oldestTab,
    newestTab,
  };
}
