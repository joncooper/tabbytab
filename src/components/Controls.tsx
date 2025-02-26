import { useState } from 'preact/hooks';
import { GroupBy } from '../types';

interface ControlsProps {
  onGroupByChange: (groupBy: GroupBy) => void;
  onSearch: (query: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

export function Controls({ onGroupByChange, onSearch, onExpandAll, onCollapseAll }: ControlsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('window');

  const handleGroupByChange = (e: Event) => {
    const target = e.target as HTMLSelectElement;
    const value = target.value as GroupBy;
    setGroupBy(value);
    onGroupByChange(value);
  };

  const handleSearchChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    setSearchQuery(target.value);
    onSearch(target.value);
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
      </div>
    </div>
  );
}