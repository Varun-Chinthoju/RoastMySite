# RoastMySite

RoastMySite is an Electron desktop UX-audit app. It captures a submitted website with Electron's Chromium runtime, inspects the rendered DOM, sends desktop/mobile screenshots plus structured page data to a multimodal OpenAI model, and renders a polished audit in Roast or Professional mode. Screenshot upload remains available when capture is not appropriate.

## Quick start

Requires Node.js 18+ and a local Electron install from the project dependencies.

```bash
npm install
npm run dev
```

`npm start` is an alias for launching the Electron app. `npm run web` starts the legacy static server for development only; it is not required by the desktop app.

## API key and model configuration

Real URL or screenshot analysis uses the provider selected in the main process. Gemini is the default when `GEMINI_API_KEY` is present; OpenAI remains supported.

```bash
export OPENAI_API_KEY="your-key"
export OPENAI_MODEL="gpt-4.1" # optional; defaults to gpt-4.1
npm run dev
```

For the lowest-cost multimodal path, use Gemini 2.5 Flash-Lite:

```bash
export AI_PROVIDER=gemini
export GEMINI_API_KEY="your-key"
export GEMINI_MODEL="gemini-3.7-flash" # optional; this is the default
npm run dev
```

Do not commit a key or place it in renderer code. Without a key, use the built-in Demo Audit action to preview the interface. A missing key never causes a fabricated URL or screenshot audit.

Gemini pricing and model capability change over time; check Google's [official pricing](https://ai.google.dev/gemini-api/docs/pricing) and [Gemini 3.7 Flash model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.7-flash) before shipping cost assumptions.

## URL capture workflow

1. Enter a hostname or `http://`/`https://` URL. The app normalizes bare hostnames to HTTPS and rejects unsupported schemes or embedded credentials.
2. The Electron main process creates a hidden, sandboxed `BrowserWindow` with Node integration disabled.
3. It waits for DOM ready and network activity to settle, with a hard timeout, then scrolls through bounded desktop positions to trigger common lazy-loaded content and captures representative top, middle, and bottom evidence.
4. It detects visible semantic tab controls, activates each safe same-document tab, and captures its rendered state and DOM evidence. Ordinary navigation links are never followed as tabs.
5. It resizes the same capture window to about 390px wide and repeats the coverage pass for responsive content.
6. It extracts visible headings, links, buttons, navigation and form labels, image alt attributes, font/color samples, accessibility signals, tab states, and page metadata.
7. Screenshots and inspection data are sent to the model with strict JSON-schema output. Each audit includes evidence-backed strengths, prioritized issues, and a copyable remake prompt that preserves successful patterns. The validator rejects missing required fields and invalid accessibility evidence labels.

Capture failures are surfaced as actionable errors. Cloudflare/CAPTCHA pages, access-denied/authentication walls, load failures, and timeouts suggest uploading a screenshot instead. The app never invents a capture or audit for a blocked site.

## Screenshot fallback

Drop a PNG, JPEG, or WebP screenshot into the upload area, or click to browse. Uploads are limited to 12 MB and are sent through the same main-process OpenAI call. This path is useful for authenticated sites, blocked pages, local staging environments, or any site that cannot be captured reliably by Electron.

## Architecture

- `main.mjs` — Electron main process, hidden website capture, DOM inspection, OpenAI request, timeout/error handling, and IPC handlers
- `preload.cjs` — narrow `contextBridge` API (`analyzeUrl`, `analyzeUpload`, `loadDemo`)
- `app.js` — renderer-only UI, upload interaction, loading states, mode selection, and report rendering
- `src/capture-utils.mjs` — URL normalization, capture inspection script, and error helpers
- `src/audit-schema.mjs` — strict audit schema, shape validation, and demo audit data
- `styles.css` / `index.html` — existing RoastMySite visual design and app shell

The renderer has no Node APIs and does not hold the OpenAI key. Accessibility findings are labeled as confirmed programmatic issues, likely visual issues, or possible issues requiring manual verification.

## Test commands

```bash
npm test                 # all Node tests
node --test test/capture-utils.test.mjs
node --test test/audit-schema.test.mjs
```

The tests are intentionally network-free. Live URL capture and OpenAI analysis require an API key and a running Electron session, so they are not part of the default test suite.
