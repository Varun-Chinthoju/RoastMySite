const STAGES = [
  'Inspecting layout…',
  'Scrolling through the page…',
  'Checking interactive tabs…',
  'Reading copy…',
  'Checking visual hierarchy…',
  'Looking for accessibility problems…',
  'Judging your CTA choices…',
  'Preparing the roast…',
];

const SCORE_META = {
  usability: 'Usability',
  accessibility: 'Accessibility',
  visualDesign: 'Visual Design',
  navigation: 'Navigation',
  copy: 'Copy',
  conversion: 'Conversion',
  consistency: 'Consistency',
};

const icons = {
  flame: '<path d="M12 22c4 0 7-3 7-7 0-3-2-5-4-7 0 2-1 3-2 4 0-4-2-7-6-10 1 5-3 7-3 12 0 5 3 8 8 8Z"/><path d="M9 18c0 2 1 3 3 3s3-1 3-3c0-1-1-3-3-4 0 2-1 3-3 4Z"/>',
  upload: '<path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  refresh: '<path d="M20 6v6h-6"/><path d="M4 18v-6h6"/><path d="M18.5 9A7 7 0 0 0 6 5.5L4 7"/><path d="M5.5 15A7 7 0 0 0 18 18.5l2-1.5"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  sparkles: '<path d="m12 3-1.9 4.6a2 2 0 0 1-1.1 1.1L4.4 10.6 9 12.5a2 2 0 0 1 1.1 1.1L12 18.2l1.9-4.6a2 2 0 0 1 1.1-1.1l4.6-1.9L15 8.7a2 2 0 0 1-1.1-1.1Z"/>',
  accessibility: '<circle cx="12" cy="4" r="2"/><path d="M5 8h14"/><path d="m9 22 3-6 3 6"/><path d="M8 8 12 13l4-5"/>',
  wand: '<path d="m15 4 5 5L8 21l-5-5Z"/><path d="m6 3 1 2"/><path d="m3 6 2 1"/><path d="m18 13 1 2"/><path d="m21 16 2 1"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9Z"/>',
  command: '<path d="M18 8a4 4 0 1 0-4-4v12a4 4 0 1 0 4-4H6a4 4 0 1 0 4 4V8a4 4 0 1 0-4 4h12"/>',
};

function icon(name, size = 16) {
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.sparkles}</svg>`;
}

const state = {
  view: 'landing',
  mode: 'roast',
  url: '',
  file: null,
  preview: '',
  dragging: false,
  stage: 0,
  audit: null,
  error: '',
  copied: false,
  copiedPrompt: false,
  quickWinsDone: {},
};

const app = document.querySelector('#app');

function brand() {
  return `<div class="brand"><div class="brand-mark">${icon('sparkles', 18)}</div><span>RoastMySite</span></div>`;
}

function modeToggle() {
  return `<div class="mode-toggle" aria-label="Feedback tone">
    <button data-mode="professional" class="${state.mode === 'professional' ? 'active' : ''}">Professional</button>
    <button data-mode="roast" class="${state.mode === 'roast' ? 'active' : ''}">Roast ${icon('flame', 13)}</button>
  </div>`;
}

function render() {
  if (state.view === 'loading') return renderLoading();
  if (state.view === 'results' && state.audit) return renderResults();
  renderLanding();
}

function renderLanding() {
  app.innerHTML = `<main class="app-shell">
    <header class="app-header">
      ${brand()}
      <div class="app-header-actions"><span class="app-status"><span class="status-dot"></span>Ready for a new audit</span>${modeToggle()}</div>
    </header>
    <section class="workspace">
      <div class="workspace-heading">
        <div>
          <div class="eyebrow">${icon('scan', 14)} Audit workspace</div>
          <h1>Start a new audit</h1>
          <p>Review a site with concrete findings across usability, accessibility, copy, hierarchy, and conversion.</p>
        </div>
        <div class="workspace-shortcut">${icon('command', 14)} <span>Paste a URL or drop a screenshot</span></div>
      </div>
      <div class="workspace-grid">
        <div class="analysis-card">
          <div class="card-heading"><div><span class="card-kicker">Source</span><h2>What should we review?</h2></div><span class="privacy-note">Runs locally until analysis</span></div>
          <div class="input-label-row"><label for="site-url">Website URL <span>optional context</span></label></div>
        <div class="url-input-wrap">${icon('link', 18)}<input id="site-url" value="${escapeAttr(state.url)}" placeholder="https://your-site.com" type="url"></div>
        <div class="or-divider"><span>and / or</span></div>
        <div id="drop-zone" class="drop-zone ${state.dragging ? 'dragging' : ''} ${state.preview ? 'has-preview' : ''}">
          <input id="file-input" type="file" accept="image/png,image/jpeg,image/webp" hidden>
          ${state.preview ? previewMarkup() : uploadMarkup()}
        </div>
        ${state.error ? `<div class="inline-error">${icon('alert', 17)}<span>${escapeHtml(state.error)}</span></div>` : ''}
        <div class="action-row">
          <button class="demo-link" id="demo-btn">Open sample audit ${icon('arrow', 15)}</button>
          <button class="primary-button" id="analyze-btn" ${state.file || state.url.trim() ? '' : 'disabled'}>${icon('flame', 18)} Roast My Site ${icon('arrow', 17)}</button>
        </div>
        <p class="url-caveat">URL capture runs in Electron’s Chromium. If a site blocks loading, upload a screenshot instead.</p>
      </div>
        <aside class="workspace-side">
          <div class="side-intro"><span class="side-icon">${icon('sparkles', 16)}</span><div><strong>What you’ll get</strong><p>A report you can actually work from.</p></div></div>
          <div class="capability-list">
            <div>${icon('alert', 15)}<span><strong>Priority-ranked findings</strong><small>Know what to fix first.</small></span></div>
            <div>${icon('wand', 15)}<span><strong>Specific recommendations</strong><small>Turn criticism into next steps.</small></span></div>
            <div>${icon('copy', 15)}<span><strong>Rewritten copy</strong><small>See clearer alternatives in context.</small></span></div>
            <div>${icon('accessibility', 15)}<span><strong>Accessibility confidence</strong><small>Separate evidence from assumptions.</small></span></div>
          </div>
          <button class="sample-card" id="side-demo-btn"><span class="sample-preview"><span></span><span></span><span></span></span><span><strong>Not ready to upload?</strong><small>Explore a sample report</small></span>${icon('arrow', 15)}</button>
        </aside>
      </div>
    </section>
  </main>`;
  bindLanding();
  document.querySelector('#side-demo-btn').addEventListener('click', loadDemo);
}

function uploadMarkup() {
  return `<div class="upload-empty"><div class="upload-icon">${icon('upload', 25)}</div><strong>Drop a website screenshot here</strong><p>or click to browse · PNG, JPG, WebP up to 12 MB</p><span class="recommended-badge">${icon('sparkles', 12)} Recommended for the live demo</span></div>`;
}

function previewMarkup() {
  return `<div class="preview-state"><img src="${state.preview}" alt="Website screenshot preview"><div class="preview-overlay"><div><strong>${escapeHtml(state.file?.name || 'Screenshot')}</strong><span>${formatFileSize(state.file?.size || 0)} · ready to roast</span></div><button class="icon-button" id="remove-file" aria-label="Remove screenshot">×</button></div></div>`;
}

function bindLanding() {
  document.querySelectorAll('[data-mode]').forEach((btn) => btn.addEventListener('click', () => { state.mode = btn.dataset.mode; render(); }));
  const urlInput = document.querySelector('#site-url');
  urlInput.addEventListener('input', (e) => { state.url = e.target.value; state.error = ''; updateAnalyzeButton(); });
  const fileInput = document.querySelector('#file-input');
  const drop = document.querySelector('#drop-zone');
  drop.addEventListener('click', (e) => { if (!state.preview && e.target.id !== 'remove-file') fileInput.click(); });
  fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
  drop.addEventListener('dragenter', (e) => { e.preventDefault(); state.dragging = true; drop.classList.add('dragging'); });
  drop.addEventListener('dragover', (e) => e.preventDefault());
  drop.addEventListener('dragleave', (e) => { e.preventDefault(); state.dragging = false; drop.classList.remove('dragging'); });
  drop.addEventListener('drop', (e) => { e.preventDefault(); state.dragging = false; handleFiles(e.dataTransfer.files); });
  document.querySelector('#remove-file')?.addEventListener('click', (e) => { e.stopPropagation(); resetFile(); });
  document.querySelector('#analyze-btn').addEventListener('click', analyze);
  document.querySelector('#demo-btn').addEventListener('click', loadDemo);
}

function updateAnalyzeButton() {
  const btn = document.querySelector('#analyze-btn');
  if (btn) btn.disabled = !(state.file || state.url.trim());
}

function handleFiles(files) {
  const chosen = files?.[0];
  if (!chosen) return;
  if (!chosen.type.startsWith('image/')) return setError('Please upload a PNG, JPEG, or WebP screenshot.');
  if (chosen.size > 12 * 1024 * 1024) return setError('That screenshot is over 12 MB. Try a compressed image.');
  if (state.preview) URL.revokeObjectURL(state.preview);
  state.file = chosen;
  state.preview = URL.createObjectURL(chosen);
  state.error = '';
  render();
}

function resetFile() {
  if (state.preview) URL.revokeObjectURL(state.preview);
  state.file = null;
  state.preview = '';
  render();
}

function setError(message) { state.error = message; render(); }

function readAsDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function analyze() {
  state.url = document.querySelector('#site-url')?.value || state.url;
  state.error = '';
  if (!state.file && !state.url.trim()) return setError('Enter a website URL or drop in a screenshot first.');

  state.view = 'loading'; state.stage = 0; render();
  const timer = setInterval(() => { state.stage = Math.min(state.stage + 1, STAGES.length - 1); renderLoading(); }, 920);
  try {
    const started = Date.now();
    const payload = state.url.trim()
      ? await window.roastMySite.analyzeUrl(state.url.trim(), state.mode)
      : await window.roastMySite.analyzeUpload(await readAsDataURL(state.file), '', state.mode);
    if (payload.capture?.desktopScreenshot) state.preview = payload.capture.desktopScreenshot;
    const elapsed = Date.now() - started;
    if (elapsed < 4200) await sleep(4200 - elapsed);
    state.audit = payload.audit; state.quickWinsDone = {}; state.copiedPrompt = false; state.view = 'results';
  } catch (err) {
    const message = err?.message || 'Something went wrong while analyzing the audit.';
    if (state.file && state.url.trim()) {
      state.url = '';
      state.error = `${message} Your screenshot is still ready — click Roast My Site to use the upload fallback.`;
    } else state.error = message;
    state.view = 'landing';
  } finally { clearInterval(timer); render(); }
}

async function loadDemo() {
  state.error = ''; state.view = 'loading'; state.stage = 0; render();
  const timer = setInterval(() => { state.stage = Math.min(state.stage + 1, STAGES.length - 1); renderLoading(); }, 620);
  try {
    const payload = await window.roastMySite.loadDemo(state.mode);
    await sleep(3300);
    state.audit = payload.audit; state.quickWinsDone = {}; state.copiedPrompt = false; state.view = 'results';
  } catch { state.error = 'Could not load the demo audit.'; state.view = 'landing'; }
  finally { clearInterval(timer); render(); }
}

function renderLoading() {
  app.innerHTML = `<main class="loading-shell"><div class="loading-top">${brand()}<span>${state.mode === 'roast' ? 'Roast mode' : 'Professional mode'}</span></div><div class="loading-content">
    <div class="scan-preview">${state.preview ? `<img src="${state.preview}" alt="Analyzing screenshot">` : '<div class="fake-page"></div>'}<div class="scan-line"></div><div class="scan-corners"><span></span><span></span><span></span><span></span></div></div>
    <div class="loading-copy"><div class="loading-kicker"><span class="spinner"></span> Running UX audit</div><h2>${STAGES[state.stage]}</h2><p>We’re looking for concrete problems, not “consider improving your user experience” filler.</p><div class="stage-list">${STAGES.map((label, i) => `<div class="stage-item ${i < state.stage ? 'done' : ''} ${i === state.stage ? 'current' : ''}"><span class="stage-dot">${i < state.stage ? icon('check', 12) : i + 1}</span><span>${label.replace('…','')}</span></div>`).join('')}</div></div>
  </div></main>`;
}

function renderResults() {
  const a = state.audit;
  const biggest = (a.topIssues || []).slice(0,5);
  const totalFindings = biggest.length + (a.usabilityIssues?.length || 0) + (a.accessibilityIssues?.length || 0);
  app.innerHTML = `<main class="results-shell">
    <header class="results-header">${brand()}<div class="results-header-actions"><div class="tone-chip">${state.mode === 'roast' ? icon('flame',13)+' Roast mode' : 'Professional mode'}</div><button class="secondary-button small" id="copy-summary">${icon('copy',15)} <span>${state.copied ? 'Copied' : 'Copy summary'}</span></button><button class="dark-button small" id="new-audit">${icon('refresh',15)} New audit</button></div></header>
    <div class="results-main">
      <section class="audit-hero"><div class="audit-context"><div class="eyebrow">${icon('scan',14)} Audit complete</div><h1>${escapeHtml(a.headline || 'Audit complete')}</h1><p>${escapeHtml(a.summary)}</p><div class="context-tags">${state.url ? `<span>${icon('link',13)} ${escapeHtml(safeHost(state.url))}</span>` : ''}<span>${icon('image',13)} Screenshot analyzed</span><span>${icon('check',13)} ${totalFindings} findings</span></div></div>${scoreRing(a.overallScore)}</section>
      <section class="score-grid">${Object.entries(a.categoryScores || {}).filter(([k]) => SCORE_META[k]).map(([k,v]) => scoreCard(SCORE_META[k], v)).join('')}</section>
      <section class="two-col-layout"><div class="main-column">
        ${sectionHeading('01','What’s working','Protect these strengths while you make improvements.')}
        <div class="strength-grid">${(a.strengths || []).map(strengthCard).join('')}</div>
        ${sectionHeading('02','Biggest problems','Fix these before polishing anything else.')}
        <div class="issue-stack">${biggest.map((x,i) => issueCard(x, i+1)).join('')}</div>
        ${sectionHeading('03','UX issues','Navigation, hierarchy, layout, and interaction friction.')}
        <div class="issue-grid">${(a.usabilityIssues || []).map(x => issueCard(x,null,true)).join('')}</div>
        ${sectionHeading('04','Confusing copy','Where the words make users work too hard.')}
        <div class="copy-stack">${(a.copyIssues || []).map(copyCard).join('')}</div>
        ${sectionHeading('05','Accessibility','Visible risks are labeled by confidence — not presented as a fake compliance scan.')}
        <div class="issue-stack">${(a.accessibilityIssues || []).map(accessibilityCard).join('')}</div>
        ${sectionHeading('06','Suggested redesign','A concrete direction for the highest-impact section.')}
        ${redesignCard(a.redesignSuggestions)}
        ${sectionHeading('07','Remake prompt','A grounded brief you can paste into another AI builder.')}
        ${remakePromptCard(a.remakePrompt)}
      </div><aside class="side-column"><div class="sticky-side">
        ${state.preview ? `<div class="side-card screenshot-card"><div class="side-card-title">${icon('image',16)} Screenshot</div><img src="${state.preview}" alt="Analyzed website"></div>` : ''}
        <div class="side-card quick-wins-card"><div class="side-card-title">${icon('zap',16)} Quick wins</div><p>Low-effort changes with a decent chance of making the page feel better immediately.</p><div class="quick-win-list">${(a.quickWins || []).map((win,i) => `<button data-win="${i}" class="${state.quickWinsDone[i] ? 'completed' : ''}"><span class="check-box">${state.quickWinsDone[i] ? icon('check',12) : ''}</span><span>${escapeHtml(win)}</span></button>`).join('')}</div></div>
        <div class="side-card verdict-card"><div class="side-card-title">${icon('wand',16)} Bottom line</div><blockquote>“${escapeHtml(a.verdict)}”</blockquote></div>
      </div></aside></section>
    </div></main>`;
  bindResults(biggest);
}

function bindResults(biggest) {
  document.querySelector('#new-audit').addEventListener('click', () => { state.audit = null; state.error = ''; state.view = 'landing'; render(); window.scrollTo({top:0,behavior:'smooth'}); });
  document.querySelector('#copy-summary').addEventListener('click', async () => {
    const text = `${state.audit.summary}\n\nTop issues:\n${biggest.map(x => `- ${x.title}: ${x.recommendation}`).join('\n')}`;
    await navigator.clipboard.writeText(text); state.copied = true; renderResults(); setTimeout(() => { state.copied = false; if (state.view === 'results') renderResults(); }, 1400);
  });
  document.querySelector('#copy-remake-prompt')?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(state.audit.remakePrompt || '');
    state.copiedPrompt = true; renderResults();
    setTimeout(() => { state.copiedPrompt = false; if (state.view === 'results') renderResults(); }, 1400);
  });
  document.querySelectorAll('[data-win]').forEach(btn => btn.addEventListener('click', () => { const i = btn.dataset.win; state.quickWinsDone[i] = !state.quickWinsDone[i]; renderResults(); }));
}

function scoreRing(value=0) {
  const score = clamp(value); return `<div class="overall-score"><div class="score-ring" style="--score-angle:${score*3.6}deg"><div class="score-ring-inner"><strong>${score}</strong><span>/100</span></div></div><span>Overall score</span></div>`;
}
function scoreCard(label,value) { const s=clamp(value); const cap=s>=80?'Strong':s>=65?'Needs polish':s>=50?'Needs work':'Priority fix'; return `<div class="score-card"><div class="score-card-top"><span>${escapeHtml(label)}</span><strong>${s}</strong></div><div class="progress-track"><span style="width:${s}%"></span></div><div class="score-caption">${cap}</div></div>`; }
function sectionHeading(number,title,subtitle) { return `<div class="section-heading"><span>${number}</span><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div></div>`; }
function severity(level='Medium') { return `<span class="severity severity-${String(level).toLowerCase()}">${escapeHtml(level)}</span>`; }
function issueCard(issue,rank=null,compact=false) { return `<article class="issue-card ${compact?'compact':''}"><div class="issue-top"><div class="issue-title-wrap">${rank?`<span class="rank">${String(rank).padStart(2,'0')}</span>`:''}<h3>${escapeHtml(issue.title)}</h3></div>${severity(issue.severity)}</div><p class="issue-description">${escapeHtml(issue.description)}</p><div class="issue-details"><div><span class="detail-label">Why it matters</span><p>${escapeHtml(issue.impact)}</p></div><div class="fix-block"><span class="detail-label">${icon('wand',12)} Recommended fix</span><p>${escapeHtml(issue.recommendation)}</p></div></div>${issue.example?`<div class="example-line"><span>Example</span><p>${escapeHtml(issue.example)}</p></div>`:''}</article>`; }
function strengthCard(item) { return `<article class="strength-card"><div class="strength-icon">${icon('check',16)}</div><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p><span>${escapeHtml(item.evidence)}</span></div></article>`; }
function copyCard(item) { return `<article class="copy-card"><div class="copy-card-head"><div><span>Copy issue</span><h3>${escapeHtml(item.title)}</h3></div>${severity(item.severity)}</div><p>${escapeHtml(item.description)}</p><div class="copy-compare"><div class="copy-original"><span>Original</span><blockquote>“${escapeHtml(item.original)}”</blockquote></div><div class="copy-mid-arrow">→</div><div class="copy-suggested"><span>Suggested</span><blockquote>“${escapeHtml(item.suggested)}”</blockquote></div></div><div class="copy-rationale"><strong>Why:</strong> ${escapeHtml(item.impact)}</div></article>`; }
function accessibilityCard(issue) { const c=(issue.confidence||'possible').toLowerCase(); const basis=(issue.basis||'manual').toLowerCase(); const label=basis==='programmatic'?'Confirmed programmatic issue':basis==='visual'?'Likely visual issue':'Possible issue — manual verification'; return `<article class="accessibility-card"><div class="accessibility-head"><div class="accessibility-icon">${icon('accessibility',18)}</div><div><h3>${escapeHtml(issue.title)}</h3><span class="confidence confidence-${c}">${label}</span></div>${severity(issue.severity)}</div><p>${escapeHtml(issue.description)}</p><div class="accessibility-fix"><strong>Fix:</strong> ${escapeHtml(issue.recommendation)}</div>${issue.verification?`<div class="verification">${icon('scan',14)}<span><strong>Verify:</strong> ${escapeHtml(issue.verification)}</span></div>`:''}</article>`; }
function redesignCard(r) { if(!r)return''; const steps=r.layout||[]; return `<article class="redesign-card"><div class="redesign-header"><div><span class="redesign-kicker">Focus area</span><h3>${escapeHtml(r.section)}</h3></div><span class="redesign-badge">${icon('sparkles',12)} High-impact rethink</span></div><p class="redesign-summary">${escapeHtml(r.summary)}</p><div class="redesign-layout"><div class="wireframe">${steps.slice(0,5).map((step,i)=>`<div class="wire-row wire-${i+1}"><span>${i+1}</span><p>${escapeHtml(step)}</p></div>`).join('')}</div><div class="redesign-notes"><div><span>Suggested headline</span><strong>${escapeHtml(r.suggestedHeadline)}</strong></div><div><span>Primary CTA</span><strong>${escapeHtml(r.primaryCTA)}</strong></div><div><span>CTA placement</span><p>${escapeHtml(r.ctaPlacement)}</p></div><div><span>Spacing</span><p>${escapeHtml(r.spacing)}</p></div></div></div></article>`; }
function remakePromptCard(prompt) { if(!prompt)return''; return `<article class="remake-prompt-card"><div class="remake-prompt-head"><div><span>AI build brief</span><h3>Remake this site without losing its good parts</h3></div><button class="secondary-button small" id="copy-remake-prompt">${icon('copy',14)} ${state.copiedPrompt ? 'Copied' : 'Copy prompt'}</button></div><textarea readonly aria-label="AI remake prompt">${escapeHtml(prompt)}</textarea></article>`; }

function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function clamp(v){return Math.max(0,Math.min(100,Number(v)||0));}
function formatFileSize(bytes){if(!bytes)return'0 KB';return bytes>1024*1024?`${(bytes/1024/1024).toFixed(1)} MB`:`${Math.round(bytes/1024)} KB`;}
function safeHost(value){try{return new URL(value).hostname.replace(/^www\./,'')}catch{return value}}
function escapeHtml(value=''){return String(value).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}
function escapeAttr(value=''){return escapeHtml(value);}

render();
