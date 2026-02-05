/**
 * Extracts main text content from the current page.
 *
 * This runs as an injected function via chrome.scripting.executeScript(),
 * so it cannot import any modules. It uses only built-in DOM APIs.
 *
 * Strategy: find the most likely "main content" element, fall back to body.
 * Strips nav, footer, sidebar, and ad-like elements before extracting text.
 */
export function extractPageContent(): string {
  const MAX_LENGTH = 4000;

  try {
    // Remove noise elements before extracting text
    const clone = document.cloneNode(true) as Document;
    const noiseSelectors = [
      'nav', 'footer', 'header', 'aside',
      '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
      '.sidebar', '.nav', '.footer', '.header', '.menu',
      '.ad', '.ads', '.advertisement', '.social-share',
      'script', 'style', 'noscript', 'svg', 'iframe',
    ];

    for (const sel of noiseSelectors) {
      clone.querySelectorAll(sel).forEach(el => el.remove());
    }

    // Try to find the main content area
    const candidates = [
      clone.querySelector('article'),
      clone.querySelector('main'),
      clone.querySelector('[role="main"]'),
      clone.querySelector('.post-content'),
      clone.querySelector('.article-content'),
      clone.querySelector('.entry-content'),
      clone.querySelector('#content'),
      clone.querySelector('.content'),
    ];

    for (const el of candidates) {
      if (el) {
        const text = el.textContent || '';
        const cleaned = text.replace(/\s+/g, ' ').trim();
        if (cleaned.length > 100) {
          return cleaned.slice(0, MAX_LENGTH);
        }
      }
    }

    // Fallback: use the cleaned body
    const bodyText = clone.body?.textContent || '';
    return bodyText.replace(/\s+/g, ' ').trim().slice(0, MAX_LENGTH);
  } catch {
    return '';
  }
}
