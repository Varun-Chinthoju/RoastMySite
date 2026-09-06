import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUDIT_SCHEMA, demoAudit, validateAuditShape } from './src/audit-schema.mjs';
import { accessibilityError, buildDOMInspectionScript, computeScrollPositions, isBlockedPageData, normalizeWebsiteURL } from './src/capture-utils.mjs';
import { extractGeminiOutputText, extractOpenRouterOutputText } from './src/provider-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAPTURE_TIMEOUT_MS = 20_000;
const AI_TIMEOUT_MS = 90_000;
const NETWORK_IDLE_MS = 900;
const MAX_SCROLL_STEPS = 6;
const MAX_TAB_STATES = 12;
const TAB_SETTLE_MS = 500;

function loadLocalEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1].startsWith('#') || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

loadLocalEnv();

function makeWindow(options = {}) {
  return new BrowserWindow({
    width: options.width || 1200,
    height: options.height || 900,
    show: false,
    offscreen: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true },
  });
}

async function withTimeout(promise, ms, message, code = 'TIMEOUT') {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(accessibilityError(message, code)), ms); })]);
  } finally { clearTimeout(timer); }
}

async function waitForNetworkIdle(contents) {
  const started = Date.now();
  let quietSince = Date.now();
  let previousCount = -1;
  while (Date.now() - started < CAPTURE_TIMEOUT_MS) {
    const state = await contents.executeJavaScript(`({ readyState: document.readyState, count: performance.getEntriesByType('resource').length })`);
    if (state.readyState === 'complete' && state.count === previousCount) {
      if (Date.now() - quietSince >= NETWORK_IDLE_MS) return;
    } else { quietSince = Date.now(); previousCount = state.count; }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw accessibilityError('The website did not finish loading before the timeout. Try uploading a screenshot instead.', 'TIMEOUT');
}

function assertNotBlocked(pageData) {
  const reason = isBlockedPageData(pageData);
  if (reason === 'AUTH_REQUIRED') throw accessibilityError('The website requires authentication. Upload a screenshot instead.', reason);
  if (reason === 'BLOCKED') throw accessibilityError('The website is blocking automated loading (CAPTCHA, Cloudflare, or access denied). Upload a screenshot instead.', reason);
}

async function captureViewport(contents, width, height) {
  const image = await contents.capturePage({ x: 0, y: 0, width, height });
  return image.toDataURL();
}

async function captureScrollCoverage(contents, width, height) {
  const metrics = await contents.executeJavaScript(`({ scrollHeight: Math.max(document.body?.scrollHeight || 0, document.documentElement.scrollHeight), viewportHeight: window.innerHeight })`);
  const positions = computeScrollPositions(metrics.scrollHeight, metrics.viewportHeight || height, MAX_SCROLL_STEPS);
  const screenshots = [];
  for (const position of positions) {
    await contents.executeJavaScript(`window.scrollTo(0, ${position})`);
    await new Promise((resolve) => setTimeout(resolve, 220));
    await contents.executeJavaScript(`Promise.race([
      Promise.all([...document.images].filter((image) => image.getBoundingClientRect().bottom >= 0 && image.getBoundingClientRect().top <= innerHeight && !image.complete).map((image) => image.decode?.().catch(() => {}))),
      new Promise((resolve) => setTimeout(resolve, 450))
    ])`);
    screenshots.push(await captureViewport(contents, width, height));
  }
  await contents.executeJavaScript('window.scrollTo(0, 0)');
  return { positions, screenshots };
}

function selectCoverageScreenshots(screenshots, max = 4) {
  if (screenshots.length <= max) return screenshots;
  const indexes = [0, Math.floor((screenshots.length - 1) / 3), Math.floor(((screenshots.length - 1) * 2) / 3), screenshots.length - 1];
  return [...new Set(indexes)].map((index) => screenshots[index]);
}

const TAB_SELECTOR = '[role="tab"], [role="tablist"] button[aria-controls], [role="tablist"] a[aria-controls], [role="tablist"] [data-bs-toggle="tab"], [role="tablist"] [data-toggle="tab"], [role="tablist"] [data-tab-target]';
const TAB_DISCOVERY_SCRIPT = `(() => [...document.querySelectorAll(${JSON.stringify(TAB_SELECTOR)})]
  .filter((element, index, all) => all.indexOf(element) === index)
  .filter((element) => { const style = getComputedStyle(element); const rect = element.getBoundingClientRect(); const target = element.getAttribute('aria-controls') || element.getAttribute('data-bs-target') || element.getAttribute('data-target') || element.getAttribute('data-tab-target') || ''; const hasSafeTarget = element.getAttribute('role') === 'tab' || Boolean(target.startsWith('#')); return hasSafeTarget && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0 && !element.disabled && element.getAttribute('aria-disabled') !== 'true'; })
  .slice(0, ${MAX_TAB_STATES})
  .map((element, index) => ({ index, label: (element.innerText || element.textContent || element.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 160), selected: element.getAttribute('aria-selected') === 'true', controls: element.getAttribute('aria-controls') || '', tag: element.tagName.toLowerCase() })))()`;

async function captureTabStates(contents, width, height, originalURL) {
  const tabs = await contents.executeJavaScript(TAB_DISCOVERY_SCRIPT);
  if (!tabs.length) return [];
  const initialIndex = tabs.findIndex((tab) => tab.selected);
  const states = [];
  for (const tab of tabs) {
    await contents.executeJavaScript(`(() => { const tabs = [...document.querySelectorAll(${JSON.stringify(TAB_SELECTOR)})].filter((element, index, all) => all.indexOf(element) === index).filter((element) => { const style = getComputedStyle(element); const rect = element.getBoundingClientRect(); const target = element.getAttribute('aria-controls') || element.getAttribute('data-bs-target') || element.getAttribute('data-target') || element.getAttribute('data-tab-target') || ''; return (element.getAttribute('role') === 'tab' || Boolean(target.startsWith('#'))) && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0 && !element.disabled && element.getAttribute('aria-disabled') !== 'true'; }); tabs[${tab.index}]?.click(); })()`);
    await new Promise((resolve) => setTimeout(resolve, TAB_SETTLE_MS));
    const currentURL = await contents.executeJavaScript('location.href');
    if (currentURL !== originalURL && !currentURL.startsWith(`${originalURL}#`)) {
      await contents.loadURL(originalURL);
      await waitForNetworkIdle(contents);
      break;
    }
    await contents.executeJavaScript('window.scrollTo(0, 0)');
    const inspection = await contents.executeJavaScript(buildDOMInspectionScript());
    states.push({ label: tab.label || `Tab ${tab.index + 1}`, controls: tab.controls, screenshot: await captureViewport(contents, width, height), inspection });
  }
  if (initialIndex >= 0 && states.length) {
    await contents.executeJavaScript(`(() => { const tabs = [...document.querySelectorAll(${JSON.stringify(TAB_SELECTOR)})].filter((element, index, all) => all.indexOf(element) === index); tabs[${initialIndex}]?.click(); })()`);
    await new Promise((resolve) => setTimeout(resolve, TAB_SETTLE_MS));
    await contents.executeJavaScript('window.scrollTo(0, 0)');
  }
  return states;
}

async function captureWebsite(url) {
  const normalized = normalizeWebsiteURL(url);
  const browser = makeWindow({ width: 1440, height: 1000 });
  try {
    const allowNavigation = (_event, targetURL) => {
      try { const parsed = new URL(targetURL); if (!['http:', 'https:'].includes(parsed.protocol)) _event.preventDefault(); }
      catch { _event.preventDefault(); }
    };
    browser.webContents.on('will-redirect', allowNavigation);
    browser.webContents.on('will-navigate', allowNavigation);
    browser.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    const failed = new Promise((_, reject) => browser.webContents.once('did-fail-load', (_event, errorCode, errorDescription) => reject(accessibilityError(`The website could not be loaded (${errorDescription || errorCode}). Upload a screenshot instead.`, 'LOAD_FAILED'))));
    await withTimeout(Promise.race([browser.loadURL(normalized), failed]), CAPTURE_TIMEOUT_MS, 'The website timed out while loading. Upload a screenshot instead.');
    await waitForNetworkIdle(browser.webContents);
    const initialPageData = await browser.webContents.executeJavaScript(buildDOMInspectionScript());
    assertNotBlocked(initialPageData);
    const desktopCoverage = await captureScrollCoverage(browser.webContents, 1440, 1000);
    const desktopPageData = await browser.webContents.executeJavaScript(buildDOMInspectionScript());
    assertNotBlocked(desktopPageData);
    const tabStates = await captureTabStates(browser.webContents, 1440, 1000, normalized);
    const desktop = desktopCoverage.screenshots[0];
    await browser.webContents.setZoomFactor(1);
    browser.setSize(390, 844);
    await withTimeout(browser.loadURL(normalized), CAPTURE_TIMEOUT_MS, 'The mobile viewport timed out while loading. Upload a screenshot instead.');
    await waitForNetworkIdle(browser.webContents);
    const mobilePageData = await browser.webContents.executeJavaScript(buildDOMInspectionScript());
    assertNotBlocked(mobilePageData);
    const mobileCoverage = await captureScrollCoverage(browser.webContents, 390, 844);
    const settledMobilePageData = await browser.webContents.executeJavaScript(buildDOMInspectionScript());
    assertNotBlocked(settledMobilePageData);
    const mobile = mobileCoverage.screenshots[0];
    return { url: normalized, desktopScreenshot: desktop, mobileScreenshot: mobile, screenshots: [...selectCoverageScreenshots(desktopCoverage.screenshots), ...selectCoverageScreenshots(mobileCoverage.screenshots), ...tabStates.map((state) => state.screenshot)], pageData: { desktop: desktopPageData, mobile: settledMobilePageData, desktopScrollPositions: desktopCoverage.positions, mobileScrollPositions: mobileCoverage.positions, tabs: tabStates.map(({ label, controls, inspection }) => ({ label, controls, inspection })) } };
  } finally { if (!browser.isDestroyed()) browser.destroy(); }
}

function buildPrompt(mode, context) {
  const tone = mode === 'roast' ? 'Use light, witty sarcasm aimed only at the website; every joke must still communicate a concrete observation.' : 'Use a constructive, neutral, professional tone.';
  return `You are a senior UX auditor. ${tone}\n\nAudit the supplied desktop and mobile screenshots and the programmatic page inspection below. Produce only the requested structured JSON. Never claim an issue that is not supported by the screenshots or inspection. Identify at least two things the site does well, with concrete evidence, so the owner does not accidentally remove effective patterns. The remakePrompt must be a self-contained prompt for another AI to rebuild this product experience: preserve the strengths, fix the highest-impact issues, retain the site's personality, and include responsive and accessibility requirements. If the source is an app or dashboard, explicitly preserve its app shell, navigation, workflows, and information-dense layout; do not turn it into a marketing landing page. Do not recommend removing a successful pattern unless you explain what should replace it. Keep redesignSuggestions.layout concise: include 0 to 5 concrete layout steps; use an empty array only when no specific redesign sequence is justified by the evidence.\n\nAccessibility evidence rules: use basis="programmatic" and confidence="confirmed" only for issues established by the DOM data (for example missing image alt attributes or unlabeled controls); use basis="visual" and confidence="likely" for visible visual risks; use basis="manual" and confidence="possible" for anything requiring keyboard, screen reader, exact color sampling, or other manual verification. Include the verification field for every accessibility finding.\n\n${JSON.stringify(context).slice(0, 120000)}`;
}

async function analyzeWithOpenAI({ mode, url, screenshots, pageData }) {
  if (!process.env.OPENAI_API_KEY) throw accessibilityError('OpenAI analysis is not configured on this computer. Set OPENAI_API_KEY, or choose Gemini with AI_PROVIDER=gemini.', 'CONFIGURATION');
  const content = [{ type: 'input_text', text: buildPrompt(mode, { url, pageData }) }];
  for (const image of screenshots) content.push({ type: 'input_image', image_url: image, detail: 'high' });
  const response = await withTimeout(fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4.1', input: [{ role: 'user', content }], text: { format: { type: 'json_schema', name: 'roastmysite_audit', strict: true, schema: AUDIT_SCHEMA } } }) }), AI_TIMEOUT_MS, 'The AI audit timed out. Try again or use a smaller screenshot.');
  const data = await response.json();
  if (!response.ok) throw accessibilityError('The AI audit failed. Check the model configuration and try again.', 'AI_FAILED');
  const outputText = data.output_text || data.output?.flatMap((item) => item.content || []).find((part) => part.type === 'output_text')?.text;
  if (!outputText) throw accessibilityError('The AI returned no structured audit. Try again.', 'AI_INVALID');
  try { return validateAuditShape(JSON.parse(outputText)); } catch (error) { throw accessibilityError(error.message, 'AI_INVALID'); }
}

async function analyzeWithOpenRouter({ mode, url, screenshots, pageData }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw accessibilityError('OpenRouter analysis is not configured on this computer. Set OPENROUTER_API_KEY, or choose another provider with AI_PROVIDER.', 'CONFIGURATION');
  const content = [{ type: 'text', text: buildPrompt(mode, { url, pageData }) }];
  for (const image of screenshots) content.push({ type: 'image_url', image_url: { url: image } });
  const model = process.env.OPENROUTER_MODEL || 'openrouter/free';
  const response = await withTimeout(fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://roastmysite.local',
      'X-OpenRouter-Title': 'RoastMySite',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
      response_format: { type: 'json_schema', json_schema: { name: 'roastmysite_audit', strict: true, schema: AUDIT_SCHEMA } },
      provider: { require_parameters: true },
    }),
  }), AI_TIMEOUT_MS, 'The OpenRouter audit timed out. Try again or use a smaller screenshot.');
  const data = await response.json();
  if (!response.ok) throw accessibilityError(`The OpenRouter audit failed: ${data.error?.message || 'check the model name and API key, then try again.'}`, 'AI_FAILED');
  const outputText = extractOpenRouterOutputText(data);
  if (!outputText) throw accessibilityError('OpenRouter returned no structured audit. Try again.', 'AI_INVALID');
  try { return validateAuditShape(JSON.parse(outputText)); } catch (error) { throw accessibilityError(error.message, 'AI_INVALID'); }
}

function geminiSchema(schema) {
  if (schema.type === 'object') return { type: 'object', properties: Object.fromEntries(Object.entries(schema.properties || {}).map(([key, value]) => [key, geminiSchema(value)])), required: schema.required || [] };
  if (schema.type === 'array') return { type: 'array', items: geminiSchema(schema.items) };
  return { type: schema.type, ...(schema.enum ? { enum: schema.enum } : {}) };
}

async function analyzeWithGemini({ mode, url, screenshots, pageData }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw accessibilityError('Gemini analysis is not configured on this computer. Set GEMINI_API_KEY, or use OpenAI with AI_PROVIDER=openai.', 'CONFIGURATION');
  const input = [{ type: 'text', text: buildPrompt(mode, { url, pageData }) }];
  for (const image of screenshots) {
    const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(image || '');
    if (!match) throw accessibilityError('The screenshot format is not supported.', 'INVALID_UPLOAD');
    input.push({ type: 'image', mime_type: match[1], data: match[2] });
  }
  const model = process.env.GEMINI_MODEL || 'gemini-3.7-flash';
  const response = await withTimeout(fetch('https://generativelanguage.googleapis.com/v1beta/interactions', { method: 'POST', headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json', 'Api-Revision': '2026-05-20' }, body: JSON.stringify({ model, input, store: false, response_format: { type: 'text', mime_type: 'application/json', schema: geminiSchema(AUDIT_SCHEMA) } }) }), AI_TIMEOUT_MS, 'The Gemini audit timed out. Try again or use a smaller screenshot.');
  const data = await response.json();
  if (!response.ok) throw accessibilityError(`The Gemini audit failed: ${data.error?.message || 'check the model name and API key, then try again.'}`, 'AI_FAILED');
  const outputText = extractGeminiOutputText(data);
  if (!outputText) throw accessibilityError('Gemini returned no structured audit. Try again.', 'AI_INVALID');
  try { return validateAuditShape(JSON.parse(outputText)); } catch (error) { throw accessibilityError(error.message, 'AI_INVALID'); }
}

async function analyzeWithModel(input) {
  const provider = (process.env.AI_PROVIDER || (process.env.OPENROUTER_API_KEY ? 'openrouter' : process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY ? 'gemini' : 'openai')).toLowerCase();
  if (provider === 'openrouter') return analyzeWithOpenRouter(input);
  if (provider === 'gemini') return analyzeWithGemini(input);
  if (provider === 'openai') return analyzeWithOpenAI(input);
  throw accessibilityError(`Unsupported AI_PROVIDER "${provider}". Use openrouter, gemini, or openai.`, 'CONFIGURATION');
}

function toClientError(error) { return { code: error.code || 'AUDIT_FAILED', message: error.message || 'The audit failed. Upload a screenshot and try again.' }; }
function throwClientError(error) {
  const clientError = toClientError(error);
  const exposed = new Error(clientError.message);
  exposed.code = clientError.code;
  throw exposed;
}
function assertImageDataURL(value) {
  if (typeof value !== 'string' || !/^data:image\/(png|jpeg|jpg|webp);base64,[a-z\d+/]+=*$/i.test(value)) throw accessibilityError('Upload a PNG, JPEG, or WebP screenshot.', 'INVALID_UPLOAD');
  if (value.length > 18 * 1024 * 1024) throw accessibilityError('That screenshot is too large. Upload an image under 12 MB.', 'PAYLOAD_TOO_LARGE');
}

ipcMain.handle('audit:demo', (_event, { mode }) => ({ audit: demoAudit(mode) }));
ipcMain.handle('audit:upload', async (_event, { imageDataUrl, url = '', mode = 'roast' }) => {
  try { assertImageDataURL(imageDataUrl); return { audit: await analyzeWithModel({ mode, url, screenshots: [imageDataUrl], pageData: { source: 'screenshot upload' } }) }; }
  catch (error) { throwClientError(error); }
});
ipcMain.handle('audit:url', async (_event, { url, mode = 'roast' }) => {
  try { const capture = await captureWebsite(url); return { audit: await analyzeWithModel({ mode, url: capture.url, screenshots: capture.screenshots, pageData: capture.pageData }), capture: { url: capture.url, desktopScreenshot: capture.desktopScreenshot, mobileScreenshot: capture.mobileScreenshot } }; }
  catch (error) { throwClientError(error); }
});

async function createMainWindow() {
  const window = new BrowserWindow({ width: 1320, height: 920, minWidth: 900, minHeight: 700, backgroundColor: '#f5f3ee', icon: path.join(__dirname, 'assets/icon.svg'), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  await window.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(async () => { await createMainWindow(); app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createMainWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
