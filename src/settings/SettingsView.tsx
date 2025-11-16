import { useState, useEffect } from 'preact/hooks';
import type { SyncConfig, SyncStats, ExportOptions } from '../types';

export function SettingsView() {
  const [syncConfig, setSyncConfig] = useState<SyncConfig>({
    enabled: false,
    supabaseUrl: '',
    supabaseKey: '',
    lastSyncTime: 0,
    autoSync: true,
    syncInterval: 5 * 60 * 1000,
    localRetentionDays: 30,
  });

  const [syncStats, setSyncStats] = useState<SyncStats>({
    totalSynced: 0,
    lastSyncTime: 0,
    pendingSync: 0,
  });

  const [exportStats, setExportStats] = useState({
    totalTabs: 0,
    closedTabs: 0,
    activeTabs: 0,
    oldestTab: null as number | null,
    newestTab: null as number | null,
  });

  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadConfig();
    loadStats();
  }, []);

  const loadConfig = async () => {
    try {
      const { syncConfig: stored } =
        await chrome.storage.local.get('syncConfig');
      if (stored) {
        setSyncConfig(stored);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const loadStats = async () => {
    try {
      // Get sync stats
      const syncResponse = await chrome.runtime.sendMessage({
        action: 'getSyncStats',
      });
      if (syncResponse.success) {
        setSyncStats(syncResponse.stats);
      }

      // Get export stats
      const exportResponse = await chrome.runtime.sendMessage({
        action: 'getExportStats',
      });
      if (exportResponse.success) {
        setExportStats(exportResponse.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSaveConfig = async () => {
    setLoading(true);
    setMessage('');

    try {
      await chrome.storage.local.set({ syncConfig });
      setMessage('✓ Configuration saved successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(
        `✗ Error saving config: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setLoading(true);
    setTestResult(null);

    try {
      // Save config first
      await chrome.storage.local.set({ syncConfig });

      // Test connection using a temporary client
      const { testSupabaseConnection } = await import('../lib/supabase-client');
      const result = await testSupabaseConnection();

      setTestResult({
        success: result.success,
        message: result.success
          ? 'Connection successful!'
          : `Connection failed: ${result.error}`,
      });
    } catch (error) {
      setTestResult({
        success: false,
        message:
          error instanceof Error ? error.message : 'Test failed: Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerSync = async () => {
    setLoading(true);
    setMessage('');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'triggerSync',
      });

      if (response.success) {
        setMessage(`✓ ${response.message}`);
        loadStats(); // Refresh stats
      } else {
        setMessage(`✗ Sync failed: ${response.message}`);
      }
    } catch (error) {
      setMessage(
        `✗ Sync error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleExport = async (format: 'jsonl' | 'json' | 'csv') => {
    setLoading(true);
    setMessage('');

    try {
      const options: ExportOptions = {
        format,
        includeClosed: true,
        includeActive: true,
      };

      const response = await chrome.runtime.sendMessage({
        action: 'exportHistory',
        options,
      });

      if (response.success) {
        setMessage(`✓ Export started! Check your downloads folder.`);
      } else {
        setMessage(`✗ Export failed: ${response.error}`);
      }
    } catch (error) {
      setMessage(
        `✗ Export error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  };

  const formatTimeAgo = (timestamp: number) => {
    if (!timestamp) return 'Never';
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  return (
    <div className="settings-container">
      <h1>TabbyTab Settings</h1>

      {message && (
        <div
          className={`message ${message.startsWith('✓') ? 'success' : 'error'}`}
        >
          {message}
        </div>
      )}

      {/* Sync Configuration */}
      <section className="settings-section">
        <h2>Sync Configuration</h2>
        <p className="section-description">
          Enable cloud sync to store unlimited tab history in Supabase and sync
          across devices.
        </p>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={syncConfig.enabled}
              onChange={(e) =>
                setSyncConfig({
                  ...syncConfig,
                  enabled: (e.target as HTMLInputElement).checked,
                })
              }
            />
            <span>Enable Sync</span>
          </label>
        </div>

        <div className="form-group">
          <label htmlFor="supabase-url">Supabase URL</label>
          <input
            id="supabase-url"
            type="url"
            value={syncConfig.supabaseUrl}
            onChange={(e) =>
              setSyncConfig({
                ...syncConfig,
                supabaseUrl: (e.target as HTMLInputElement).value,
              })
            }
            placeholder="https://your-project.supabase.co"
            disabled={!syncConfig.enabled}
          />
        </div>

        <div className="form-group">
          <label htmlFor="supabase-key">Supabase Anon Key</label>
          <input
            id="supabase-key"
            type="password"
            value={syncConfig.supabaseKey}
            onChange={(e) =>
              setSyncConfig({
                ...syncConfig,
                supabaseKey: (e.target as HTMLInputElement).value,
              })
            }
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            disabled={!syncConfig.enabled}
          />
        </div>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={syncConfig.autoSync}
              onChange={(e) =>
                setSyncConfig({
                  ...syncConfig,
                  autoSync: (e.target as HTMLInputElement).checked,
                })
              }
              disabled={!syncConfig.enabled}
            />
            <span>Auto-sync every 5 minutes</span>
          </label>
        </div>

        <div className="form-group">
          <label htmlFor="retention-days">
            Local retention (days after sync)
          </label>
          <input
            id="retention-days"
            type="number"
            min="1"
            max="365"
            value={syncConfig.localRetentionDays}
            onChange={(e) =>
              setSyncConfig({
                ...syncConfig,
                localRetentionDays: parseInt(
                  (e.target as HTMLInputElement).value,
                  10
                ),
              })
            }
            disabled={!syncConfig.enabled}
          />
          <small>
            Keep synced tabs locally for this many days (default: 30)
          </small>
        </div>

        <div className="button-group">
          <button
            onClick={handleSaveConfig}
            disabled={loading}
            className="primary-button"
          >
            {loading ? 'Saving...' : 'Save Configuration'}
          </button>
          <button
            onClick={handleTestConnection}
            disabled={loading || !syncConfig.enabled}
            className="secondary-button"
          >
            {loading ? 'Testing...' : 'Test Connection'}
          </button>
        </div>

        {testResult && (
          <div
            className={`test-result ${testResult.success ? 'success' : 'error'}`}
          >
            {testResult.message}
          </div>
        )}
      </section>

      {/* Sync Stats */}
      <section className="settings-section">
        <h2>Sync Statistics</h2>

        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-label">Total Synced</div>
            <div className="stat-value">{syncStats.totalSynced}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Pending Sync</div>
            <div className="stat-value">{syncStats.pendingSync}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Last Sync</div>
            <div className="stat-value">
              {formatTimeAgo(syncStats.lastSyncTime)}
            </div>
          </div>
        </div>

        {syncStats.lastError && (
          <div className="error-message">Last error: {syncStats.lastError}</div>
        )}

        <button
          onClick={handleTriggerSync}
          disabled={loading || !syncConfig.enabled}
          className="primary-button"
        >
          {loading ? 'Syncing...' : 'Sync Now'}
        </button>
      </section>

      {/* Export Section */}
      <section className="settings-section">
        <h2>Export History for LLM Processing</h2>
        <p className="section-description">
          Export your tab history for analysis with LLMs, topic mining, and
          clustering.
        </p>

        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-label">Total Tabs</div>
            <div className="stat-value">{exportStats.totalTabs}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Closed Tabs</div>
            <div className="stat-value">{exportStats.closedTabs}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Active Tabs</div>
            <div className="stat-value">{exportStats.activeTabs}</div>
          </div>
        </div>

        {exportStats.oldestTab && (
          <div className="date-range">
            <small>
              History range: {formatDate(exportStats.oldestTab)} →{' '}
              {formatDate(exportStats.newestTab!)}
            </small>
          </div>
        )}

        <div className="export-formats">
          <h3>Export Format</h3>
          <div className="button-group">
            <button
              onClick={() => handleExport('jsonl')}
              disabled={loading}
              className="secondary-button"
              title="Best for LLM streaming and batch processing"
            >
              JSONL (Recommended)
            </button>
            <button
              onClick={() => handleExport('json')}
              disabled={loading}
              className="secondary-button"
              title="Structured JSON with metadata"
            >
              JSON
            </button>
            <button
              onClick={() => handleExport('csv')}
              disabled={loading}
              className="secondary-button"
              title="For spreadsheet analysis"
            >
              CSV
            </button>
          </div>
        </div>
      </section>

      {/* Setup Instructions */}
      <section className="settings-section">
        <h2>Setup Instructions</h2>
        <div className="instructions">
          <h3>1. Create Supabase Project</h3>
          <ol>
            <li>
              Go to{' '}
              <a href="https://supabase.com" target="_blank">
                supabase.com
              </a>{' '}
              and create a free account
            </li>
            <li>Create a new project</li>
            <li>Wait for the project to initialize (~2 minutes)</li>
          </ol>

          <h3>2. Create Database Table</h3>
          <p>Run this SQL in the Supabase SQL Editor:</p>
          <pre className="code-block">
            {`CREATE TABLE tab_history (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  tab_id INTEGER,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  favicon_url TEXT,
  window_id INTEGER,
  window_title TEXT,
  summary TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  closed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX idx_user_timestamp ON tab_history(user_id, timestamp DESC);
CREATE INDEX idx_domain ON tab_history(domain);

-- Enable Row Level Security
ALTER TABLE tab_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own tabs
CREATE POLICY "Users can access own tabs"
  ON tab_history FOR ALL
  USING (auth.uid() = user_id);`}
          </pre>

          <h3>3. Get Your Credentials</h3>
          <ol>
            <li>Go to Project Settings → API</li>
            <li>Copy the "Project URL" (paste above)</li>
            <li>Copy the "anon public" key (paste above)</li>
          </ol>

          <h3>4. Test & Enable</h3>
          <ol>
            <li>Enter your credentials above</li>
            <li>Click "Test Connection"</li>
            <li>If successful, check "Enable Sync"</li>
            <li>Click "Save Configuration"</li>
          </ol>
        </div>
      </section>
    </div>
  );
}
