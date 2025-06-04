import { useEffect, useState } from 'preact/hooks';

export function ExportView() {
  const [htmlContent, setHtmlContent] = useState('');
  const [title, setTitle] = useState('Tab Export');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get('key');
    if (!key) return;

    chrome.storage.local.get(key, (result) => {
      if (result && result[key]) {
        const { title: storedTitle, body } = result[key] as { title: string; body: string };
        setTitle(storedTitle);
        setHtmlContent(body);
      }
    });
  }, []);

  const handleDownload = () => {
    const fullHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${title}</title></head><body>${htmlContent}</body></html>`;
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="export-view">
      <h1>{title}</h1>
      <button className="download-button" onClick={handleDownload}>Download HTML</button>
      <div id="export-content" dangerouslySetInnerHTML={{ __html: htmlContent }}></div>
    </div>
  );
}
