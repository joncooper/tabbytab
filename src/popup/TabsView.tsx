import { useState, useEffect } from 'preact/hooks';
import { TabGroup as TabGroupType, TabInfo, GroupBy } from '../types';
import { Controls } from '../components/Controls';
import { TabGroup } from '../components/TabGroup';
import { ProtectedPatterns } from '../components/ProtectedPatterns';

export function TabsView() {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [groupedTabs, setGroupedTabs] = useState<TabGroupType[]>([]);
  const [groupBy, setGroupBy] = useState<GroupBy>('window');
  const [searchQuery, setSearchQuery] = useState('');
  const [showProtectedPatterns, setShowProtectedPatterns] = useState(false);

  useEffect(() => {
    loadTabs();
    
    // Set up event listener for when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadTabs();
      }
    };
    
    // Set up event listener for window focus
    const handleFocus = () => {
      loadTabs();
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    const filteredTabs = filterTabs(tabs, searchQuery);
    const grouped = groupTabs(filteredTabs, groupBy);
    setGroupedTabs(grouped);
  }, [tabs, groupBy, searchQuery]);

  const loadTabs = async () => {
    try {
      const chromeTabs = await chrome.tabs.query({});
      
      const formattedTabs: TabInfo[] = chromeTabs.map(tab => {
        let domain = '';
        try {
          if (tab.url) {
            domain = new URL(tab.url).hostname;
          }
        } catch (error) {
          console.error('Error parsing URL:', error);
        }
        
        return {
          id: tab.id || 0,
          title: tab.title || 'Untitled',
          url: tab.url || '',
          favIconUrl: tab.favIconUrl,
          windowId: tab.windowId,
          domain,
          active: tab.active
        };
      });
      
      setTabs(formattedTabs);
    } catch (error) {
      console.error('Error loading tabs:', error);
    }
  };

  const filterTabs = (tabs: TabInfo[], query: string): TabInfo[] => {
    if (!query) return tabs;
    
    const lowerQuery = query.toLowerCase();
    return tabs.filter(tab => 
      tab.title.toLowerCase().includes(lowerQuery) || 
      tab.url.toLowerCase().includes(lowerQuery) ||
      tab.domain.toLowerCase().includes(lowerQuery)
    );
  };

  const groupTabs = (tabs: TabInfo[], groupBy: GroupBy): TabGroupType[] => {
    const groupedTabs: { [key: string]: TabInfo[] } = {};
    
    tabs.forEach(tab => {
      let groupName = '';
      
      switch (groupBy) {
        case 'window':
          groupName = `Window ${tab.windowId}`;
          break;
        case 'domain':
          groupName = tab.domain || 'No Domain';
          break;
        case 'title':
          // Group by first word in title
          groupName = tab.title.split(' ')[0] || 'Untitled';
          break;
      }
      
      if (!groupedTabs[groupName]) {
        groupedTabs[groupName] = [];
      }
      
      groupedTabs[groupName].push(tab);
    });
    
    return Object.entries(groupedTabs).map(([name, tabs]) => ({
      name,
      tabs,
      expanded: true
    }));
  };

  const handleTabClose = async (tabId: number) => {
    try {
      await chrome.runtime.sendMessage({
        action: 'closeTabs',
        tabIds: [tabId]
      });
      loadTabs();
    } catch (error) {
      console.error('Error closing tab:', error);
    }
  };

  const handleGroupClose = async (tabIds: number[]) => {
    try {
      await chrome.runtime.sendMessage({
        action: 'closeTabs',
        tabIds
      });
      loadTabs();
    } catch (error) {
      console.error('Error closing tab group:', error);
    }
  };

  const handleGroupByChange = (newGroupBy: GroupBy) => {
    setGroupBy(newGroupBy);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleToggleExpand = (groupName: string) => {
    setGroupedTabs(prevGroups => 
      prevGroups.map(group => 
        group.name === groupName 
          ? { ...group, expanded: !group.expanded }
          : group
      )
    );
  };

  const handleExpandAll = () => {
    setGroupedTabs(prevGroups => 
      prevGroups.map(group => ({ ...group, expanded: true }))
    );
  };

  const handleCollapseAll = () => {
    setGroupedTabs(prevGroups => 
      prevGroups.map(group => ({ ...group, expanded: false }))
    );
  };

  // Function to move all domain groups to their own windows
  const handleMoveAllDomainsToWindows = async () => {
    if (groupBy !== 'domain') return;
    
    try {
      // Process each domain group sequentially
      for (const group of groupedTabs) {
        // Skip groups with no tabs or window groups
        if (group.tabs.length === 0 || group.name.startsWith('Window ')) continue;
        
        // Create a new window with the first tab
        const firstTab = group.tabs[0];
        const newWindow = await chrome.windows.create({
          url: firstTab.url,
          focused: false // Don't focus each new window
        });
        
        if (!newWindow.id) continue;
        
        // Store the newly created tab ID
        const firstCreatedTabId = newWindow.tabs?.[0]?.id;
        
        // Close the original first tab to avoid duplication
        if (firstCreatedTabId && firstTab.id !== firstCreatedTabId) {
          await chrome.tabs.remove(firstTab.id);
        }
        
        // Move the remaining tabs to the new window
        const tabsToMove = group.tabs.slice(1);
        if (tabsToMove.length > 0) {
          const tabIds = tabsToMove.map(tab => tab.id);
          await chrome.tabs.move(tabIds, {
            windowId: newWindow.id,
            index: -1 // Append to the end
          });
        }
        
        // Add a small delay between window creations
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Refresh tabs after all operations complete
      setTimeout(loadTabs, 750);
    } catch (error) {
      console.error('Error moving domain groups to windows:', error);
      alert('Failed to move all domain groups to windows');
    }
  };

  return (
    <div className="tabs-view">
      <header className="app-header">
        <div className="header-left">
          <h1>TabbyTab</h1>
          <button 
            className="refresh-button"
            onClick={loadTabs}
            title="Refresh tabs"
          >
            ↻
          </button>
        </div>
        <div className="header-buttons">
          <button 
            className="header-button"
            onClick={() => window.location.href = chrome.runtime.getURL('history/index.html')}
          >
            View History
          </button>
          <button 
            className="settings-button"
            onClick={() => setShowProtectedPatterns(!showProtectedPatterns)}
          >
            {showProtectedPatterns ? 'Show Tabs' : 'Protected Patterns'}
          </button>
        </div>
      </header>

      {showProtectedPatterns ? (
        <ProtectedPatterns />
      ) : (
        <>
          <Controls 
            onGroupByChange={handleGroupByChange}
            onSearch={handleSearch}
            onExpandAll={handleExpandAll}
            onCollapseAll={handleCollapseAll}
            onMoveAllDomainsToWindows={handleMoveAllDomainsToWindows}
          />
          
          <div className="tab-groups">
            {groupedTabs.length > 0 ? (
              groupedTabs.map(group => (
                <TabGroup
                  key={group.name}
                  group={group}
                  onTabClose={handleTabClose}
                  onGroupClose={handleGroupClose}
                  onToggleExpand={handleToggleExpand}
                  groupBy={groupBy}
                  onRefreshTabs={loadTabs}
                />
              ))
            ) : (
              <div className="empty-state">
                {searchQuery ? 'No tabs match your search' : 'No tabs found'}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}