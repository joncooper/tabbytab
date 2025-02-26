import { TabHistory, ProtectedPattern } from '../types';

// Handle browser action click to open in a new tab instead of popup
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ 
    url: chrome.runtime.getURL('popup/index.html') 
  });
});

// Generate a short summary of the page content
const generatePageSummary = async (tab: chrome.tabs.Tab): Promise<string> => {
  try {
    // Only attempt to summarize http/https pages
    if (!tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) {
      return '';
    }

    // Simple summary generation based on title and URL when we can't access page content
    const url = new URL(tab.url);
    let domain = url.hostname;
    
    // Remove www. prefix
    domain = domain.replace(/^www\./, '');
    
    // Create a simple algorithm to generate a summary based on title and domain
    let summary = '';
    
    // Use the page title if available
    if (tab.title) {
      // If title contains the domain name, it's probably a homepage
      if (tab.title.toLowerCase().includes(domain.toLowerCase())) {
        summary = `Homepage of ${domain}`;
      } 
      // If it's a long title, it's likely an article
      else if (tab.title.length > 30) {
        summary = `Article: "${tab.title}"`;
      }
      // For shorter titles, include domain context
      else {
        summary = `"${tab.title}" on ${domain}`;
      }
    } else {
      summary = `Page on ${domain}`;
    }
    
    // Add URL path info for additional context
    const pathParts = url.pathname.split('/').filter(p => p);
    if (pathParts.length > 0) {
      const lastPathComponent = pathParts[pathParts.length - 1]
        .replace(/-/g, ' ')
        .replace(/\.(html|php|aspx?)$/, '')
        .substring(0, 30);
        
      if (lastPathComponent && !summary.includes(lastPathComponent)) {
        summary += ` - ${lastPathComponent}`;
      }
    }
    
    // For specific sites, add more context
    if (domain.includes('github.com')) {
      const parts = url.pathname.split('/').filter(p => p);
      if (parts.length >= 2) {
        summary = `GitHub: ${parts[0]}/${parts[1]}${parts.length > 2 ? '/' + parts.slice(2).join('/') : ''}`;
      }
    } else if (domain.includes('youtube.com') && url.searchParams.get('v')) {
      summary = `YouTube video: "${tab.title}"`;
    } else if (domain.includes('twitter.com') || domain.includes('x.com')) {
      summary = `Twitter: @${url.pathname.split('/')[1]}`;
    }
    
    return summary;
  } catch (error) {
    console.error('Error generating page summary:', error);
    return '';
  }
};

// Get window title
const getWindowTitle = async (windowId: number): Promise<string> => {
  try {
    const window = await chrome.windows.get(windowId);
    // Try to create a meaningful name
    let title = `Window ${windowId}`;
    
    if (window && !window.incognito) {
      const tabs = await chrome.tabs.query({ windowId });
      if (tabs.length > 0) {
        const activeTabs = tabs.filter(t => t.active);
        if (activeTabs.length > 0) {
          title = `Window: ${activeTabs[0].title || 'Untitled'}`;
        } else {
          title = `Window: ${tabs[0].title || 'Untitled'}`;
        }
      }
    }
    
    return title;
  } catch (error) {
    console.error('Error getting window title:', error);
    return `Window ${windowId}`;
  }
};

// Store tab history
const storeTabHistory = async (tab: chrome.tabs.Tab, closed: boolean = false): Promise<void> => {
  try {
    const url = tab.url || '';
    if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
      return;
    }

    const domain = new URL(url).hostname;
    
    // Get window title
    const windowTitle = await getWindowTitle(tab.windowId);
    
    // Generate page summary
    let summary = '';
    try {
      summary = await generatePageSummary(tab);
      console.log('Generated summary for tab', tab.id, summary);
    } catch (error) {
      console.error('Error generating summary:', error);
    }
    
    const tabHistory: TabHistory = {
      id: `${tab.id}-${Date.now()}`,
      tabInfo: {
        id: tab.id || 0,
        title: tab.title || 'Untitled',
        url,
        favIconUrl: tab.favIconUrl,
        windowId: tab.windowId,
        domain,
        active: tab.active
      },
      timestamp: Date.now(),
      closed,
      windowTitle,
      summary
    };

    const { tabHistory: existingHistory = [] } = await chrome.storage.local.get('tabHistory');
    existingHistory.push(tabHistory);
    
    await chrome.storage.local.set({ tabHistory: existingHistory });
  } catch (error) {
    console.error('Error storing tab history:', error);
  }
};

// Check if URL matches any protected pattern
const isUrlProtected = async (url: string): Promise<boolean> => {
  try {
    const { protectedPatterns = [] } = await chrome.storage.local.get('protectedPatterns');
    return protectedPatterns.some((pattern: ProtectedPattern) => {
      if (!pattern.enabled) return false;
      try {
        const regex = new RegExp(pattern.pattern);
        return regex.test(url);
      } catch {
        return false;
      }
    });
  } catch (error) {
    console.error('Error checking protected URL:', error);
    return false;
  }
};

// Listen for tab creation
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.url) {
    storeTabHistory(tab);
  }
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((_, changeInfo, tab) => {
  if (changeInfo.url) {
    storeTabHistory(tab);
  }
});

// Keep a cache of tabs to reference when they're closed
let tabCache = new Map();

// Update tab cache when tabs are created or updated
const updateTabCache = async () => {
  try {
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      if (tab.id) {
        tabCache.set(tab.id, tab);
      }
    });
    console.log('Tab cache updated, size:', tabCache.size);
  } catch (error) {
    console.error('Error updating tab cache:', error);
  }
};

// Initialize tab cache
updateTabCache();

// Update cache when tabs change
chrome.tabs.onCreated.addListener(tab => {
  if (tab.id) {
    tabCache.set(tab.id, tab);
  }
});

chrome.tabs.onUpdated.addListener((_, __, tab) => {
  if (tab.id) {
    tabCache.set(tab.id, tab);
  }
});

// Listen for tab removal
chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    console.log('Tab removed:', tabId);
    // Get the tab from our cache since it's already been removed
    const closedTab = tabCache.get(tabId);
    
    if (closedTab) {
      console.log('Found closed tab in cache:', closedTab.title);
      await storeTabHistory(closedTab, true);
      // Remove from cache after storing
      tabCache.delete(tabId);
    } else {
      console.error('Tab not found in cache:', tabId);
    }
  } catch (error) {
    console.error('Error handling tab removal:', error);
  }
});

// Listen for window removal
chrome.windows.onRemoved.addListener(async (windowId) => {
  try {
    console.log('Window removed:', windowId);
    // Find all tabs that were in this window from our cache
    const windowTabs = Array.from(tabCache.values()).filter(tab => tab.windowId === windowId);
    
    console.log(`Found ${windowTabs.length} tabs from closed window`);
    
    // Record all tabs from this window as closed
    for (const tab of windowTabs) {
      if (tab.id) {
        await storeTabHistory(tab, true);
        tabCache.delete(tab.id);
      }
    }
  } catch (error) {
    console.error('Error handling window removal:', error);
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (message.action === 'closeTabs') {
    Promise.all(message.tabIds.map(async (tabId: number) => {
      try {
        const tab = await chrome.tabs.get(tabId);
        
        if (tab.url && !await isUrlProtected(tab.url)) {
          await chrome.tabs.remove(tabId);
          return { success: true, tabId };
        } else {
          return { success: false, tabId, protected: true };
        }
      } catch (error) {
        console.error(`Error closing tab ${tabId}:`, error);
        return { success: false, tabId, error: (error as Error).message };
      }
    })).then(results => {
      sendResponse({ results });
    }).catch(error => {
      sendResponse({ error: (error as Error).message });
    });
    
    return true; // Keep the message channel open for the async response
  }
  return false;
});