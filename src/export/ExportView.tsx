import { useEffect, useState } from 'preact/hooks';
import { ExportDocument } from '../types';

export function ExportView() {
  const [html, setHtml] = useState('');
  const [docId, setDocId] = useState('');

  useEffect(() => {
    const load = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const id = urlParams.get('docId');
      if (id) {
        setDocId(id);
        const { exportDocs = [] } = await chrome.storage.local.get('exportDocs');
        const doc: ExportDocument | undefined = exportDocs.find((d: ExportDocument) => d.id === id);
        if (doc) {
          setHtml(doc.html);
        }
      } else {
        const { currentExportDoc = '' } = await chrome.storage.local.get('currentExportDoc');
        setHtml(currentExportDoc);
      }
    };
    load();
  }, []);

  const handleLinkClick = async (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.tagName !== 'A') return;
    e.preventDefault();
    const tabIdStr = target.getAttribute('data-tabid');
    const href = (target as HTMLAnchorElement).href;
    if (tabIdStr) {
      const tabId = parseInt(tabIdStr, 10);
      try {
        await chrome.tabs.get(tabId);
        await chrome.tabs.update(tabId, { active: true });
      } catch {
        await chrome.tabs.create({ url: href });
      }
    } else {
      await chrome.tabs.create({ url: href });
    }
  };

  const handleSave = async () => {
    if (!html) return;
    const id = Date.now().toString();
    const doc: ExportDocument = { id, html, timestamp: Date.now() };
    const { exportDocs = [] } = await chrome.storage.local.get('exportDocs');
    await chrome.storage.local.set({ exportDocs: [...exportDocs, doc] });
    await chrome.storage.local.set({ currentExportDoc: '' });
    const exportUrl = chrome.runtime.getURL(`export/index.html?docId=${id}`);
    // Add to tab history
    const historyEntry = {
      id: id,
      tabInfo: {
        id: 0,
        title: 'Tab Export',
        url: exportUrl,
        windowId: 0,
        domain: 'tabbytab-export',
        active: false,
      },
      timestamp: Date.now(),
      closed: false,
    };
    const { tabHistory = [] } = await chrome.storage.local.get('tabHistory');
    await chrome.storage.local.set({ tabHistory: [historyEntry, ...tabHistory] });
    setDocId(id);
    window.location.search = `?docId=${id}`;
  };

  return (
    <div className="export-view">
      <div className="export-actions">
        {docId === '' && (
          <button onClick={handleSave} className="control-button">Save Document</button>
        )}
      </div>
      <div
        className="export-content"
        onClick={handleLinkClick}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
