import { useState } from 'preact/hooks';
import { GroupBy } from '../types';

interface ControlsProps {
  groupBy: GroupBy;
  onGroupByChange: (groupBy: GroupBy) => void;
  onSearch: (query: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onMoveAllDomainsToWindows?: () => void;
  onMoveDomainsByRange?: () => void;
  minTabCount?: number;
  onMinTabCountChange?: (value: number) => void;
}

export function Controls({
  groupBy,
  onGroupByChange,
  onSearch,
  onExpandAll,
  onCollapseAll,
  onMoveAllDomainsToWindows,
  onMoveDomainsByRange,
  minTabCount = 2,
  onMinTabCountChange,
}: ControlsProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleGroupByChange = (e: Event) => {
    const target = e.target as HTMLSelectElement;
    const value = target.value as GroupBy;
    onGroupByChange(value);
  };

  const handleSearchChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    setSearchQuery(target.value);
    onSearch(target.value);
  };

  const handleMinTabCountChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const value = parseInt(target.value);
    if (onMinTabCountChange && !isNaN(value) && value >= 1) {
      onMinTabCountChange(value);
    }
  };

  return (
    <div className="controls">
      <div className="search-container">
        <input
          type="text"
          placeholder="Search tabs..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="search-input"
        />
      </div>
      <div className="group-controls">
        <label htmlFor="group-by">Group by:</label>
        <select
          id="group-by"
          value={groupBy}
          onChange={handleGroupByChange}
          className="group-select"
        >
          <option value="window">Window</option>
          <option value="domain">Domain</option>
          <option value="title">Title</option>
        </select>
        <button onClick={onExpandAll} className="control-button">
          Expand All
        </button>
        <button onClick={onCollapseAll} className="control-button">
          Collapse All
        </button>
        <button
          onClick={onMoveAllDomainsToWindows}
          className="control-button domain-window-button"
          style={{ display: groupBy === 'domain' ? 'flex' : 'none' }}
          title="Move each domain group to its own window"
        >
          One Window Per Domain
        </button>

        {groupBy === 'domain' && onMoveDomainsByRange && (
          <div className="range-window-control">
            <div className="range-inputs">
              <div className="range-input-group">
                <label htmlFor="min-tab-count">Min Tabs:</label>
                <input
                  id="min-tab-count"
                  type="number"
                  min="1"
                  value={minTabCount}
                  onChange={handleMinTabCountChange}
                  className="tab-count-input"
                />
              </div>
            </div>
            <button
              onClick={onMoveDomainsByRange}
              className="control-button range-window-button"
              title="Move domains with ≥ min tabs to separate windows, others to a single window"
            >
              <span>Move by Count</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
