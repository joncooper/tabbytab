import { useState, useEffect } from 'preact/hooks';
import { ProtectedPattern } from '../types';

export function ProtectedPatterns() {
  const [patterns, setPatterns] = useState<ProtectedPattern[]>([]);
  const [newPattern, setNewPattern] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadPatterns();
  }, []);

  const loadPatterns = async () => {
    try {
      const { protectedPatterns = [] } = await chrome.storage.local.get('protectedPatterns');
      setPatterns(protectedPatterns);
    } catch (error) {
      console.error('Error loading protected patterns:', error);
      setError('Failed to load protected patterns');
    }
  };

  const savePatterns = async (updatedPatterns: ProtectedPattern[]) => {
    try {
      await chrome.storage.local.set({ protectedPatterns: updatedPatterns });
      setPatterns(updatedPatterns);
      setError('');
    } catch (error) {
      console.error('Error saving protected patterns:', error);
      setError('Failed to save protected patterns');
    }
  };

  const handleAddPattern = () => {
    if (!newPattern.trim()) {
      setError('Pattern cannot be empty');
      return;
    }

    try {
      // Test if the pattern is a valid regex
      new RegExp(newPattern);
      
      const newPatternObj: ProtectedPattern = {
        id: Date.now().toString(),
        pattern: newPattern,
        enabled: true
      };
      
      const updatedPatterns = [...patterns, newPatternObj];
      savePatterns(updatedPatterns);
      setNewPattern('');
    } catch {
      setError('Invalid regular expression');
    }
  };

  const handleTogglePattern = (id: string) => {
    const updatedPatterns = patterns.map(pattern => 
      pattern.id === id 
        ? { ...pattern, enabled: !pattern.enabled }
        : pattern
    );
    savePatterns(updatedPatterns);
  };

  const handleDeletePattern = (id: string) => {
    const updatedPatterns = patterns.filter(pattern => pattern.id !== id);
    savePatterns(updatedPatterns);
  };

  return (
    <div className="protected-patterns">
      <h2>Protected URL Patterns</h2>
      <p>Add regex patterns to prevent accidental tab closure for matching URLs</p>
      
      <div className="pattern-input">
        <input
          type="text"
          value={newPattern}
          onChange={(e) => {
            setNewPattern((e.target as HTMLInputElement).value);
            setError('');
          }}
          placeholder="Enter regex pattern (e.g. .*github\\.com/.*)"
          className="pattern-input-field"
        />
        <button onClick={handleAddPattern} className="add-pattern-button">
          Add Pattern
        </button>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      <ul className="patterns-list">
        {patterns.map(pattern => (
          <li key={pattern.id} className="pattern-item">
            <label className="pattern-toggle">
              <input
                type="checkbox"
                checked={pattern.enabled}
                onChange={() => handleTogglePattern(pattern.id)}
              />
              <span className="toggle-label">{pattern.enabled ? 'Enabled' : 'Disabled'}</span>
            </label>
            <span className="pattern-text">{pattern.pattern}</span>
            <button
              onClick={() => handleDeletePattern(pattern.id)}
              className="delete-pattern-button"
              title="Delete pattern"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      
      {patterns.length === 0 && (
        <div className="empty-state">No protected patterns defined</div>
      )}
    </div>
  );
}