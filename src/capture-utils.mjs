export function normalizeWebsiteURL(input) {
  const value = String(input || '').trim();
  if (!value) throw new Error('Enter a website URL or upload a screenshot.');
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  let parsed;
  try { parsed = new URL(candidate); } catch { throw new Error('Enter a valid website URL.'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only http or https website URLs are supported.');
  if (!parsed.hostname || parsed.username || parsed.password) throw new Error('Enter a public website URL without embedded credentials.');
  return parsed.toString();
}

export function computeScrollPositions(scrollHeight, viewportHeight, maxSteps = 6) {
  const height = Math.max(0, Number(scrollHeight) || 0);
  const viewport = Math.max(1, Number(viewportHeight) || 1);
  const maxScroll = Math.max(0, height - viewport);
  if (!maxScroll) return [0];
  const step = Math.max(1, Math.ceil(maxScroll / Math.max(1, maxSteps)));
  const positions = [];
  for (let position = 0; position < maxScroll; position += step) positions.push(position);
  if (positions.at(-1) !== maxScroll) positions.push(maxScroll);
  return [...new Set(positions)];
}

export function classifyAccessibilityBasis(issue = {}) {
  if (issue.programmatic) return 'programmatic';
  if (issue.visuallyLikely) return 'visual';
  return 'manual';
}

export function isBlockedPageData(pageData = {}) {
  const text = [pageData.title, pageData.visibleText, pageData.url, ...(pageData.headings || []).map((item) => item.text)].filter(Boolean).join(' ').toLowerCase();
  if (/captcha|cloudflare|verify you are human|checking your browser|access denied|challenge-platform/.test(text)) return 'BLOCKED';
  if (/sign in|log in|login|authentication required|enter your password/.test(text)) return 'AUTH_REQUIRED';
  return null;
}

export function buildDOMInspectionScript() {
  return `(${function inspectPage() {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
    };
    const text = (element) => (element.innerText || element.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 240);
    const items = (selector, map) => [...document.querySelectorAll(selector)].filter(visible).map(map).filter(Boolean).slice(0, 80);
    const color = (value) => value && value !== 'rgba(0, 0, 0, 0)' ? value : null;
    const rgb = (value) => { const parts = String(value || '').match(/[\\d.]+/g); return parts?.length >= 3 ? parts.slice(0, 3).map(Number) : null; };
    const luminance = (value) => { const channels = rgb(value); if (!channels) return null; const linear = channels.map((channel) => { const c = channel / 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }); return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2]; };
    const contrast = (foreground, background) => { const foregroundL = luminance(foreground); const backgroundL = luminance(background); return foregroundL === null || backgroundL === null ? null : Number(((Math.max(foregroundL, backgroundL) + .05) / (Math.min(foregroundL, backgroundL) + .05)).toFixed(2)); };
    const backgroundFor = (element) => { let current = element; while (current) { const candidate = color(getComputedStyle(current).backgroundColor); if (candidate) return candidate; current = current.parentElement; } return 'rgb(255, 255, 255)'; };
    const headings = items('h1,h2,h3,h4,h5,h6', (el) => ({ tag: el.tagName.toLowerCase(), text: text(el), fontSize: getComputedStyle(el).fontSize }));
    const links = items('a[href]', (el) => ({ text: text(el), href: el.href, fontSize: getComputedStyle(el).fontSize }));
    const buttons = items('button,[role="button"],input[type="submit"],input[type="button"]', (el) => ({ text: text(el) || el.value || el.getAttribute('aria-label') || '', fontSize: getComputedStyle(el).fontSize }));
    const navLabels = items('nav a,nav button,[role="navigation"] a,[role="navigation"] button', (el) => text(el));
    const formLabels = items('label', (el) => text(el));
    const images = items('img', (el) => ({ alt: el.getAttribute('alt'), src: el.currentSrc || el.src }));
    const tabs = items('[role="tab"]', (el) => ({ label: text(el) || el.getAttribute('aria-label') || '', selected: el.getAttribute('aria-selected') === 'true', controls: el.getAttribute('aria-controls') || '' }));
    const textSamples = items('body *', (el) => {
      if (el.children.length || !text(el)) return null;
      const style = getComputedStyle(el);
      const foreground = color(style.color); const background = backgroundFor(el);
      return { text: text(el).slice(0, 120), fontSize: style.fontSize, color: foreground, backgroundColor: background, contrastRatio: contrast(foreground, background) };
    }).slice(0, 100);
    const missingAltCount = [...document.images].filter(visible).filter((el) => !el.hasAttribute('alt')).length;
    const unlabeledControls = [...document.querySelectorAll('button,input,select,textarea,[role="button"]')].filter(visible).filter((el) => !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !(el.labels && el.labels.length) && !text(el)).length;
    return {
      url: location.href,
      title: document.title,
      visibleText: (document.body?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 12000),
      metadata: { description: document.querySelector('meta[name="description"]')?.content || '', lang: document.documentElement.lang || '', canonical: document.querySelector('link[rel="canonical"]')?.href || '' },
      viewport: { width: window.innerWidth, height: window.innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight },
      headings, links, buttons, navLabels, formLabels, images, tabs, textSamples,
      accessibilitySignals: { missingAltCount, unlabeledControls },
    };
  }.toString()})()`;
}

export function accessibilityError(message, code = 'CAPTURE_FAILED') {
  const error = new Error(message);
  error.code = code;
  return error;
}
