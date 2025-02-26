import { useState, useEffect } from 'preact/hooks';
import { TabHistory, TabHistoryGroup, GroupBy } from '../types';
import { Controls } from '../components/Controls';

export function HistoryView() {
  const [history, setHistory] = useState<TabHistory[]>([]);
  const [groupedHistory, setGroupedHistory] = useState<TabHistoryGroup[]>([]);
  const [groupBy, setGroupBy] = useState<GroupBy>('window');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSummaries, setShowSummaries] = useState(true);

  useEffect(() => {
    loadHistory();
    
    // Set up event listener for when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadHistory();
      }
    };
    
    // Set up event listener for window focus
    const handleFocus = () => {
      loadHistory();
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    const filteredHistory = filterHistory(history, searchQuery);
    const grouped = groupHistory(filteredHistory, groupBy);
    setGroupedHistory(grouped);
  }, [history, groupBy, searchQuery]);

  const loadHistory = async () => {
    try {
      const { tabHistory = [] } = await chrome.storage.local.get('tabHistory');
      console.log('Loaded history items:', tabHistory);
      
      // Check if there are summaries
      const itemsWithSummaries = tabHistory.filter((item: TabHistory) => item.summary);
      console.log('Items with summaries:', itemsWithSummaries.length);
      if (itemsWithSummaries.length > 0) {
        console.log('Sample summary:', itemsWithSummaries[0].summary);
      }
      
      setHistory(tabHistory);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const filterHistory = (history: TabHistory[], query: string): TabHistory[] => {
    if (!query) return history;
    
    const lowerQuery = query.toLowerCase();
    return history.filter(item => 
      item.tabInfo.title.toLowerCase().includes(lowerQuery) || 
      item.tabInfo.url.toLowerCase().includes(lowerQuery) ||
      item.tabInfo.domain.toLowerCase().includes(lowerQuery)
    );
  };

  const groupHistory = (history: TabHistory[], groupBy: GroupBy): TabHistoryGroup[] => {
    const groupedHistory: { [key: string]: TabHistory[] } = {};
    
    history.forEach(item => {
      let groupName = '';
      
      switch (groupBy) {
        case 'window':
          groupName = `Window ${item.tabInfo.windowId}`;
          break;
        case 'domain':
          groupName = item.tabInfo.domain || 'No Domain';
          break;
        case 'title':
          // Group by first word in title
          groupName = item.tabInfo.title.split(' ')[0] || 'Untitled';
          break;
      }
      
      if (!groupedHistory[groupName]) {
        groupedHistory[groupName] = [];
      }
      
      groupedHistory[groupName].push(item);
    });
    
    return Object.entries(groupedHistory).map(([name, items]) => ({
      name,
      tabs: items,
      expanded: true
    }));
  };

  const handleGroupByChange = (newGroupBy: GroupBy) => {
    setGroupBy(newGroupBy);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleToggleExpand = (groupName: string) => {
    setGroupedHistory(prevGroups => 
      prevGroups.map(group => 
        group.name === groupName 
          ? { ...group, expanded: !group.expanded }
          : group
      )
    );
  };

  const handleExpandAll = () => {
    setGroupedHistory(prevGroups => 
      prevGroups.map(group => ({ ...group, expanded: true }))
    );
  };

  const handleCollapseAll = () => {
    setGroupedHistory(prevGroups => 
      prevGroups.map(group => ({ ...group, expanded: false }))
    );
  };
  
  // Pass showSummaries to the HistoryGroup components
  const renderHistoryGroups = () => {
    return groupedHistory.map(group => (
      <HistoryGroup
        key={group.name}
        group={group}
        onToggleExpand={handleToggleExpand}
        showSummaries={showSummaries}
      />
    ));
  };

  const handleClearHistory = async () => {
    if (confirm('Are you sure you want to clear all tab history?')) {
      try {
        await chrome.storage.local.set({ tabHistory: [] });
        setHistory([]);
      } catch (error) {
        console.error('Error clearing history:', error);
      }
    }
  };

  return (
    <div className="history-view">
      <header className="app-header">
        <div className="header-left">
          <h1>TabbyTab History</h1>
          <button 
            className="refresh-button"
            onClick={loadHistory}
            title="Refresh history"
          >
            ↻
          </button>
        </div>
        <div className="header-buttons">
          <button 
            className="header-button"
            onClick={() => window.location.href = chrome.runtime.getURL('popup/index.html')}
          >
            View Tabs
          </button>
          <button 
            className={`toggle-summaries-button ${showSummaries ? 'summaries-shown' : 'summaries-hidden'}`}
            onClick={() => {
              console.log('Toggle summaries clicked, current state:', showSummaries);
              setShowSummaries(!showSummaries);
            }}
          >
            {showSummaries ? '✓ Summaries Shown' : '⊕ Show Summaries'}
          </button>
          <button 
            className="clear-history-button"
            onClick={handleClearHistory}
          >
            Clear History
          </button>
        </div>
      </header>

      <Controls 
        onGroupByChange={handleGroupByChange}
        onSearch={handleSearch}
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
      />
      
      <div className="history-groups">
        {groupedHistory.length > 0 ? (
          renderHistoryGroups()
        ) : (
          <div className="empty-state">
            {searchQuery ? 'No history items match your search' : 'No tab history found'}
          </div>
        )}
      </div>
    </div>
  );
}

interface HistoryGroupProps {
  group: TabHistoryGroup;
  onToggleExpand: (groupName: string) => void;
  showSummaries: boolean;
}

function HistoryGroup({ group, onToggleExpand, showSummaries }: HistoryGroupProps) {
  const handleToggleExpand = () => {
    onToggleExpand(group.name);
  };
  
  const handleReopenWindow = async () => {
    if (group.tabs.length === 0) return;
    
    try {
      // Create a new window with the first tab
      const firstTab = group.tabs[0];
      const newWindow = await chrome.windows.create({
        url: firstTab.tabInfo.url,
        focused: true
      });
      
      // Open the remaining tabs in the same window
      if (newWindow.id && group.tabs.length > 1) {
        for (let i = 1; i < group.tabs.length; i++) {
          await chrome.tabs.create({
            windowId: newWindow.id,
            url: group.tabs[i].tabInfo.url,
            active: false
          });
        }
      }
      
      console.log(`Reopened ${group.tabs.length} tabs in a new window`);
    } catch (error) {
      console.error('Error reopening window:', error);
    }
  };

  return (
    <div className="history-group">
      <div className="group-header">
        <button 
          className={`expand-button ${group.expanded ? 'expanded' : ''}`}
          onClick={handleToggleExpand}
        >
          {group.expanded ? '▼' : '►'}
        </button>
        <h3 className="group-title">{group.name} ({group.tabs.length})</h3>
        
        <button 
          className="reopen-window-button"
          onClick={handleReopenWindow}
          title="Reopen all tabs in a new window"
        >
          Reopen Group
        </button>
      </div>
      
      {group.expanded && (
        <ul className="history-list">
          {group.tabs.map((historyItem) => (
            <HistoryItem 
              key={historyItem.id} 
              historyItem={historyItem}
              showSummaries={showSummaries}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface HistoryItemProps {
  historyItem: TabHistory;
  showSummaries: boolean;
}

function HistoryItem({ historyItem, showSummaries }: HistoryItemProps) {
  const { tabInfo, timestamp, closed, windowTitle, summary } = historyItem;
  const formattedDate = new Date(timestamp).toLocaleString();
  
  const handleReopenTab = (e: MouseEvent) => {
    e.preventDefault();
    chrome.tabs.create({ url: tabInfo.url });
  };

  return (
    <li className="history-item">
      <div className="history-favicon">
        {tabInfo.favIconUrl ? (
          <img src={tabInfo.favIconUrl} alt="" />
        ) : (
          <div className="default-favicon"></div>
        )}
      </div>
      <div className="history-content">
        <div className="history-item-header">
          <a 
            href={tabInfo.url}
            className="history-link"
            title={tabInfo.title}
            onClick={handleReopenTab}
          >
            {tabInfo.title}
          </a>
          <button 
            className="reopen-button" 
            onClick={handleReopenTab}
            title="Reopen this tab"
          >
            Reopen
          </button>
        </div>
        <div className="history-url">{tabInfo.url}</div>
        {windowTitle && (
          <div className="history-window-title">
            <span className="window-label">Window:</span> {windowTitle}
          </div>
        )}
        {showSummaries ? (
          summary ? (
            <div className="history-summary">
              <p>{summary}</p>
            </div>
          ) : (
            <div className="history-summary-unavailable">
              <span>No summary available</span>
            </div>
          )
        ) : (
          summary && (
            <div className="history-summary-hidden">
              <span>Summary hidden</span>
            </div>
          )
        )}
        <div className="history-meta">
          <span className="history-time">{formattedDate}</span>
          <span className={`history-status ${closed ? 'closed' : 'opened'}`}>
            {closed ? 'Closed' : 'Opened'}
          </span>
        </div>
      </div>
    </li>
  );
}