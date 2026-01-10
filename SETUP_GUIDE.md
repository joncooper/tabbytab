# TabbyTab Cloud Sync & Export Setup Guide

This guide will walk you through setting up unlimited tab history storage with Supabase and preparing your data for LLM analysis.

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Step 1: Create Supabase Project](#step-1-create-supabase-project)
- [Step 2: Configure Database](#step-2-configure-database)
- [Step 3: Configure TabbyTab Extension](#step-3-configure-tabbytab-extension)
- [Step 4: Verify Sync is Working](#step-4-verify-sync-is-working)
- [Step 5: Export Data for Analysis](#step-5-export-data-for-analysis)
- [Troubleshooting](#troubleshooting)
- [Advanced Configuration](#advanced-configuration)

---

## Overview

TabbyTab's cloud sync feature provides:

- **Unlimited History**: Store all your tab history forever in Supabase (PostgreSQL)
- **Cross-Device Sync**: Access your history from any device with the extension
- **Local Cache**: Keep the last 30 days locally for fast access and offline support
- **Export for LLM Analysis**: Export your data in formats optimized for AI/ML processing
- **Free Tier**: Supabase's free tier supports hundreds of thousands of tabs

**Architecture:**
```
TabbyTab Extension → Background Sync (every 5 min) → Supabase PostgreSQL
                  ↓
            Local Cache (30 days)
                  ↓
        Export → JSONL/JSON/CSV Files → LLM Analysis
```

---

## Prerequisites

- Chrome browser with TabbyTab extension installed
- A GitHub, Google, or email account (for Supabase signup)
- 10 minutes to complete setup

---

## Step 1: Create Supabase Project

### 1.1 Sign Up for Supabase

1. Go to **[https://supabase.com](https://supabase.com)**
2. Click **"Start your project"**
3. Sign in with GitHub, Google, or create an account with email
4. Verify your email if prompted

### 1.2 Create a New Project

1. From the Supabase dashboard, click **"New Project"**
2. Fill in the project details:
   - **Name**: `tabbytab-history` (or any name you prefer)
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose the closest to your location for best performance
   - **Pricing Plan**: Select **Free** (includes 500 MB database, plenty for tab history)

3. Click **"Create new project"**
4. Wait ~2 minutes for the project to initialize (coffee break ☕)

### 1.3 Get Your Project Credentials

Once the project is ready:

1. Go to **Settings** (gear icon in sidebar) → **API**
2. You'll need two values:
   - **Project URL**: `https://xxxxxxxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (long string)

**Keep these handy** - you'll need them in Step 3.

---

## Step 2: Configure Database

### 2.1 Open SQL Editor

1. In your Supabase project, click **"SQL Editor"** in the sidebar
2. Click **"New query"**

### 2.2 Create the Tab History Table

Copy and paste this SQL query into the editor:

```sql
-- Create tab_history table
CREATE TABLE tab_history (
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

-- Create indexes for efficient queries
CREATE INDEX idx_user_timestamp ON tab_history(user_id, timestamp DESC);
CREATE INDEX idx_domain ON tab_history(domain);
CREATE INDEX idx_url ON tab_history(url);
CREATE INDEX idx_closed ON tab_history(closed);

-- Enable Row Level Security (RLS)
ALTER TABLE tab_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own tabs
CREATE POLICY "Users can access own tabs"
  ON tab_history FOR ALL
  USING (auth.uid() = user_id);

-- Policy: Allow service role to bypass RLS (for admin tasks)
CREATE POLICY "Service role bypass"
  ON tab_history FOR ALL
  TO service_role
  USING (true);
```

### 2.3 Run the Query

1. Click **"Run"** (or press Cmd/Ctrl + Enter)
2. You should see: **"Success. No rows returned"**
3. Verify the table was created:
   - Go to **"Table Editor"** in the sidebar
   - You should see `tab_history` table listed

### 2.4 Optional: Set Up Authentication

If you want to use TabbyTab across multiple devices with different users:

1. Go to **Authentication** → **Providers**
2. Enable **Email** provider
3. Configure email templates (optional)

For single-user setup, you can skip this - the extension will work with anonymous access using the anon key.

---

## Step 3: Configure TabbyTab Extension

### 3.1 Open Settings

1. Click the TabbyTab extension icon in Chrome
2. Click **⚙ Settings** button in the top-right

### 3.2 Enter Supabase Credentials

In the **Sync Configuration** section:

1. **Check** "Enable Sync"
2. **Supabase URL**: Paste your Project URL from Step 1.3
   - Example: `https://abcdefghijk.supabase.co`
3. **Supabase Anon Key**: Paste your anon public key from Step 1.3
   - Example: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdX...`

### 3.3 Test the Connection

1. Click **"Test Connection"**
2. Wait 2-3 seconds
3. You should see: ✅ **"Connection successful!"**

If you see an error, see [Troubleshooting](#troubleshooting).

### 3.4 Configure Sync Settings

Optional settings (defaults work well):

- **☑ Auto-sync every 5 minutes**: Keep checked for automatic sync
- **Local retention (days after sync)**: `30` (default)
  - Tabs older than 30 days are removed from local storage after syncing
  - They remain in Supabase forever

### 3.5 Save Configuration

1. Click **"Save Configuration"**
2. You should see: ✅ **"Configuration saved successfully"**

---

## Step 4: Verify Sync is Working

### 4.1 Trigger Initial Sync

1. In Settings, go to **Sync Statistics** section
2. Click **"Sync Now"**
3. Wait for the message: ✅ **"Successfully synced X tabs"**

### 4.2 Check Supabase Database

1. Go to your Supabase project
2. Click **"Table Editor"** → **tab_history**
3. You should see your tabs appear in the table!

Each row contains:
- `url`, `title`, `domain` - Tab information
- `timestamp` - When the tab was created/visited
- `closed` - Whether the tab is still open
- `summary` - AI-generated summary of the page
- `window_title` - Which browser window it was in

### 4.3 Monitor Ongoing Sync

The **Sync Statistics** panel shows:
- **Total Synced**: Total number of tabs synced to Supabase
- **Pending Sync**: Number of tabs waiting to be synced
- **Last Sync**: Time of the last successful sync

Auto-sync runs every 5 minutes, so new tabs will appear automatically.

---

## Step 5: Export Data for Analysis

### 5.1 Choose Export Format

TabbyTab supports three formats:

| Format | Best For | Use Case |
|--------|----------|----------|
| **JSONL** | LLM streaming, embeddings | OpenAI API, topic modeling, clustering |
| **JSON** | Structured analysis | Jupyter notebooks, data exploration |
| **CSV** | Spreadsheet analysis | Excel, Google Sheets, Tableau |

### 5.2 Export Your Data

1. In Settings, go to **Export History for LLM Processing** section
2. Review your **Export Statistics**:
   - Total Tabs, Closed Tabs, Active Tabs
   - Date range of your history
3. Click your desired format (e.g., **JSONL (Recommended)**)
4. The file downloads automatically to your Downloads folder

**File naming:** `tabbytab-export-2025-11-16.jsonl`

### 5.3 JSONL Format Example

Each line is a JSON object representing one tab:

```jsonl
{"id":"123-1699999999","url":"https://github.com/user/repo","domain":"github.com","title":"user/repo: Project description","summary":"GitHub: user/repo","timestamp":"2025-11-16T10:30:00.000Z","closed":true,"windowTitle":"Window 1"}
{"id":"124-1699999998","url":"https://docs.anthropic.com","domain":"docs.anthropic.com","title":"Claude API Documentation","summary":"Article: \"Claude API Documentation\"","timestamp":"2025-11-16T10:32:00.000Z","closed":false,"windowTitle":"Window 2"}
```

Perfect for streaming to LLMs!

---

## Troubleshooting

### Connection Test Fails

**Error:** "Connection failed: Failed to fetch"

**Solutions:**
1. Check your internet connection
2. Verify the Supabase URL is correct (should start with `https://`)
3. Make sure you copied the full anon key (it's very long)
4. Try disabling browser extensions that might block requests
5. Check Supabase project status at [status.supabase.com](https://status.supabase.com)

---

**Error:** "Connection failed: relation 'tab_history' does not exist"

**Solution:** You haven't created the database table yet. Go back to [Step 2.2](#22-create-the-tab-history-table).

---

**Error:** "Connection failed: permission denied for table tab_history"

**Solution:** Row Level Security (RLS) is blocking access. Check that you ran the RLS policies in [Step 2.2](#22-create-the-tab-history-table).

---

### Sync Not Working

**Symptom:** "Pending Sync" count keeps growing, but tabs aren't syncing

**Solutions:**
1. Click **"Sync Now"** to trigger manual sync
2. Check browser console for errors:
   - Right-click extension icon → Inspect popup → Console tab
3. Verify Supabase project is active (not paused due to inactivity)
4. Check if you're hitting free tier limits:
   - Go to Supabase **Settings** → **Usage**
   - Free tier: 500 MB database, 2 GB bandwidth/month

---

### Export Returns No Data

**Symptom:** "No tabs found matching the export criteria"

**Solutions:**
1. Verify sync has completed: Check **Sync Statistics**
2. If sync is disabled, export will only get local tabs (last 30 days)
3. Try clicking **"Sync Now"** then export again

---

### Tabs Not Appearing in Supabase

**Symptom:** Table is empty after sync

**Solutions:**
1. Check the **Sync Statistics** → **Last Error** field
2. Verify you're looking at the right project in Supabase
3. Check filters in Table Editor - remove any filters
4. Verify RLS policies are correct:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'tab_history';
   ```

---

## Advanced Configuration

### Adjusting Sync Interval

The default sync interval is 5 minutes. To change it:

1. Open `src/types.ts`
2. Modify the default `syncInterval` value:
   ```typescript
   syncInterval: 5 * 60 * 1000, // 5 minutes in milliseconds
   ```
3. Rebuild the extension: `npm run build`

**Recommendations:**
- Frequent sync (1-2 min): Better for real-time analysis, uses more bandwidth
- Infrequent sync (15-30 min): Reduces API calls, may lose data if browser crashes

---

### Increasing Local Retention

Default: 30 days of synced tabs are kept locally.

To increase:
1. Go to Settings → **Local retention (days after sync)**
2. Change to desired value (e.g., `90` for 3 months)
3. Click **"Save Configuration"**

**Trade-offs:**
- More retention = more disk usage, slower searches
- Less retention = smaller local database, must query Supabase for old tabs

---

### Querying Supabase Directly

You can query your tab history directly in Supabase:

```sql
-- Most visited domains
SELECT domain, COUNT(*) as visits
FROM tab_history
GROUP BY domain
ORDER BY visits DESC
LIMIT 10;

-- Tabs from last week
SELECT title, url, timestamp
FROM tab_history
WHERE timestamp > NOW() - INTERVAL '7 days'
ORDER BY timestamp DESC;

-- Closed tabs vs active tabs
SELECT closed, COUNT(*) as count
FROM tab_history
GROUP BY closed;

-- Search for specific topics
SELECT title, url, summary, timestamp
FROM tab_history
WHERE
  title ILIKE '%machine learning%'
  OR summary ILIKE '%machine learning%'
ORDER BY timestamp DESC;
```

---

### Setting Up Multi-Device Sync

To sync across multiple devices:

1. **Same setup on each device:**
   - Install TabbyTab extension
   - Use the same Supabase URL and anon key

2. **Enable Authentication** (recommended):
   - In Supabase, go to **Authentication** → **Providers**
   - Enable **Email** or **Google** provider
   - Modify the extension to use `supabase.auth.signIn()`

3. **Alternative:** Use the same browser profile
   - Chrome Sync will share extension settings including Supabase credentials

---

### Migrating to a Different Supabase Project

To move your data:

1. **Export from old project:**
   ```sql
   -- In old Supabase project SQL Editor
   COPY (SELECT * FROM tab_history) TO STDOUT WITH CSV HEADER;
   ```

2. **Import to new project:**
   - Create table in new project (Step 2.2)
   - Upload CSV via Table Editor

3. **Update TabbyTab settings:**
   - Enter new Supabase URL and anon key
   - Test connection
   - Save configuration

---

### Monitoring Storage Usage

Free tier limits:
- **Database:** 500 MB
- **Bandwidth:** 2 GB/month

To check usage:
1. Go to Supabase **Settings** → **Usage**
2. Monitor **Database size** and **Bandwidth**

**Estimate:** 1 million tabs ≈ 200-300 MB

If you hit limits:
- Upgrade to Supabase Pro ($25/month for 8 GB)
- Delete old tabs:
  ```sql
  DELETE FROM tab_history
  WHERE timestamp < NOW() - INTERVAL '2 years';
  ```

---

## Security Best Practices

1. **Never share your anon key publicly**
   - It's in your extension settings, so keep your Chrome profile secure

2. **Use Row Level Security (RLS)**
   - Already configured in Step 2.2
   - Ensures users can only access their own data

3. **Rotate keys periodically**
   - In Supabase **Settings** → **API** → **Reset JWT Secret**
   - Update TabbyTab settings with new key

4. **Enable 2FA for Supabase account**
   - Go to Supabase account settings
   - Enable two-factor authentication

5. **Backup your data**
   - Regular exports via TabbyTab
   - Or Supabase automatic backups (Pro plan)

---

## Next Steps

- **Analyze your browsing patterns**: See [LLM_ANALYSIS_EXAMPLES.md](./LLM_ANALYSIS_EXAMPLES.md)
- **Create custom queries**: Use Supabase SQL Editor
- **Build a dashboard**: Connect to Tableau, Metabase, or Grafana
- **Automate insights**: Set up scheduled exports and analysis pipelines

---

## Support

- **Issues with TabbyTab**: Open an issue on GitHub
- **Supabase questions**: [Supabase Discord](https://discord.supabase.com/)
- **Feature requests**: Submit to the TabbyTab repository

---

**Happy browsing and analyzing! 📊🔍**
