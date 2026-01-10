import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { SyncConfig } from '../types';

let supabaseClient: SupabaseClient | null = null;
let currentSupabaseUrl: string | null = null;

/**
 * Get or create a Supabase client instance
 */
export async function getSupabaseClient(): Promise<SupabaseClient | null> {
  const config = await getSyncConfig();

  if (!config.enabled || !config.supabaseUrl || !config.supabaseKey) {
    return null;
  }

  // Recreate client if config has changed
  if (!supabaseClient || currentSupabaseUrl !== config.supabaseUrl) {
    supabaseClient = createClient(config.supabaseUrl, config.supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    currentSupabaseUrl = config.supabaseUrl;
  }

  return supabaseClient;
}

/**
 * Get sync configuration from storage
 */
export async function getSyncConfig(): Promise<SyncConfig> {
  const defaultConfig: SyncConfig = {
    enabled: false,
    supabaseUrl: '',
    supabaseKey: '',
    lastSyncTime: 0,
    autoSync: true,
    syncInterval: 5 * 60 * 1000, // 5 minutes
    localRetentionDays: 30,
  };

  try {
    const { syncConfig } = await chrome.storage.local.get('syncConfig');
    return { ...defaultConfig, ...syncConfig };
  } catch (error) {
    console.error('Error loading sync config:', error);
    return defaultConfig;
  }
}

/**
 * Save sync configuration to storage
 */
export async function saveSyncConfig(config: Partial<SyncConfig>) {
  try {
    const currentConfig = await getSyncConfig();
    const updatedConfig = { ...currentConfig, ...config };
    await chrome.storage.local.set({ syncConfig: updatedConfig });

    // Reset client if URL or key changed
    if (config.supabaseUrl || config.supabaseKey) {
      supabaseClient = null;
    }

    return updatedConfig;
  } catch (error) {
    console.error('Error saving sync config:', error);
    throw error;
  }
}

/**
 * Test Supabase connection
 */
export async function testSupabaseConnection(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const client = await getSupabaseClient();
    if (!client) {
      return {
        success: false,
        error: 'Supabase not configured',
      };
    }

    // Try to query the tab_history table
    const { error } = await client.from('tab_history').select('count').limit(1);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
