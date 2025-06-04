export interface TabInfo {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  windowId: number;
  domain: string;
  active: boolean;
}

export interface TabGroup {
  name: string;
  tabs: TabInfo[];
  expanded: boolean;
}

export interface TabHistory {
  id: string;
  tabInfo: TabInfo;
  timestamp: number;
  closed: boolean;
  windowTitle?: string;
  summary?: string;
}

export interface TabHistoryGroup {
  name: string;
  tabs: TabHistory[];
  expanded: boolean;
}

export type GroupBy = 'window' | 'domain' | 'title';

export interface ProtectedPattern {
  id: string;
  pattern: string;
  enabled: boolean;
}

export interface ExportDocument {
  id: string;
  html: string;
  timestamp: number;
}