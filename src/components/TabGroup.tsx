import { TabGroup as TabGroupType, TabInfo } from '../types';

interface TabGroupProps {
  group: TabGroupType;
  onTabClose: (tabId: number) => void;
  onGroupClose: (tabIds: number[]) => void;
  onToggleExpand: (groupName: string) => void;
  groupBy: string;
  onRefreshTabs?: () => void;
}

export function TabGroup({ group, onTabClose, onGroupClose, onToggleExpand, groupBy, onRefreshTabs }: TabGroupProps) {
  const handleGroupClose = () => {
    const tabIds = group.tabs.map(tab => tab.id);
    onGroupClose(tabIds);
  };

  const handleToggleExpand = () => {
    onToggleExpand(group.name);
  };

  const handleActivateWindow = () => {
    // If this is a window group, focus that window
    if (group.name.startsWith('Window ')) {
      const windowId = parseInt(group.name.replace('Window ', ''), 10);
      if (!isNaN(windowId)) {
        chrome.windows.update(windowId, { focused: true });
      }
    }
  };
  
  const handleMoveToNewWindow = async () => {
    if (group.tabs.length === 0) return;
    
    try {
      // Create a new window with the first tab
      const firstTab = group.tabs[0];
      const newWindow = await chrome.windows.create({
        url: firstTab.url,
        focused: true
      });
      
      if (!newWindow.id) return;
      
      // Store the newly created tab ID from the first window
      const firstCreatedTabId = newWindow.tabs?.[0]?.id;
      
      // Close the original first tab since it's been duplicated in the new window
      if (firstCreatedTabId && firstTab.id !== firstCreatedTabId) {
        await chrome.tabs.remove(firstTab.id);
      }
      
      // Move the rest of the tabs to the new window
      const tabsToMove = group.tabs.slice(1);
      if (tabsToMove.length > 0) {
        const tabIds = tabsToMove.map(tab => tab.id);
        await chrome.tabs.move(tabIds, {
          windowId: newWindow.id,
          index: -1 // Append to the end
        });
      }
      
      // Refresh tabs to update the UI
      if (onRefreshTabs) {
        setTimeout(onRefreshTabs, 750); // Increased delay to ensure Chrome has fully updated the tab state
      }
      
    } catch (error) {
      console.error('Error moving tabs to new window:', error);
      alert('Failed to move tabs to a new window');
    }
  };

  return (
    <div className="tab-group">
      <div className="group-header">
        <button 
          className={`expand-button ${group.expanded ? 'expanded' : ''}`}
          onClick={handleToggleExpand}
        >
          {group.expanded ? '▼' : '►'}
        </button>
        <h3 
          className="group-title" 
          onClick={handleActivateWindow}
          style={group.name.startsWith('Window ') ? { cursor: 'pointer' } : {}}
          title={group.name.startsWith('Window ') ? 'Click to activate this window' : ''}
        >
          {group.name} ({group.tabs.length})
        </h3>
        <div className="group-actions">
          {groupBy === 'domain' && !group.name.startsWith('Window ') && (
            <button
              className="move-to-window-button"
              onClick={handleMoveToNewWindow}
              title="Move all tabs to a new window"
            >
              <span className="button-icon">⊞</span> Move to Window
            </button>
          )}
          <button 
            className="close-group-button"
            onClick={handleGroupClose}
            title="Close all tabs in this group"
          >
            ✕
          </button>
        </div>
      </div>
      
      {group.expanded && (
        <ul className="tab-list">
          {group.tabs.map((tab) => (
            <TabItem 
              key={tab.id} 
              tab={tab} 
              onClose={() => onTabClose(tab.id)} 
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface TabItemProps {
  tab: TabInfo;
  onClose: () => void;
}

function TabItem({ tab, onClose }: TabItemProps) {
  return (
    <li className={`tab-item ${tab.active ? 'active' : ''}`}>
      <div className="tab-favicon">
        {tab.favIconUrl ? (
          <img src={tab.favIconUrl} alt="" />
        ) : (
          <div className="default-favicon"></div>
        )}
      </div>
      <a 
        href={tab.url}
        className="tab-link"
        title={tab.title}
        onClick={(e) => {
          e.preventDefault();
          chrome.tabs.update(tab.id, { active: true });
          chrome.windows.update(tab.windowId, { focused: true });
        }}
      >
        {tab.title}
      </a>
      <div className="tab-url">{tab.url}</div>
      <button 
        className="close-tab-button"
        onClick={onClose}
        title="Close tab"
      >
        ✕
      </button>
    </li>
  );
}