import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 5173);

const ISSUE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'description', 'severity', 'impact', 'recommendation', 'example'],
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    severity: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
    impact: { type: 'string' },
    recommendation: { type: 'string' },
    example: { type: 'string' },
  },
};

const AUDIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['overallScore', 'categoryScores', 'headline', 'summary', 'verdict', 'topIssues', 'usabilityIssues', 'copyIssues', 'accessibilityIssues', 'quickWins', 'redesignSuggestions'],
  properties: {
    overallScore: { type: 'integer', minimum: 0, maximum: 100 },
    categoryScores: {
      type: 'object',
      additionalProperties: false,
      required: ['usability', 'accessibility', 'visualDesign', 'navigation', 'copy', 'conversion', 'consistency'],
      properties: {
        usability: { type: 'integer', minimum: 0, maximum: 100 },
        accessibility: { type: 'integer', minimum: 0, maximum: 100 },
        visualDesign: { type: 'integer', minimum: 0, maximum: 100 },
        navigation: { type: 'integer', minimum: 0, maximum: 100 },
        copy: { type: 'integer', minimum: 0, maximum: 100 },
        conversion: { type: 'integer', minimum: 0, maximum: 100 },
        consistency: { type: 'integer', minimum: 0, maximum: 100 },
      },
    },
    headline: { type: 'string' },
    summary: { type: 'string' },
    verdict: { type: 'string' },
    topIssues: { type: 'array', minItems: 3, maxItems: 5, items: ISSUE_SCHEMA },
    usabilityIssues: { type: 'array', minItems: 2, maxItems: 6, items: ISSUE_SCHEMA },
    copyIssues: {
      type: 'array',
      minItems: 1,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'description', 'severity', 'impact', 'original', 'suggested'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          severity: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
          impact: { type: 'string' },
          original: { type: 'string' },
          suggested: { type: 'string' },
        },
      },
    },
    accessibilityIssues: {
      type: 'array',
      minItems: 2,
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'description', 'severity', 'recommendation', 'confidence', 'verification'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          severity: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
          recommendation: { type: 'string' },
          confidence: { type: 'string', enum: ['confirmed', 'likely', 'possible'] },
          verification: { type: 'string' },
        },
      },
    },
    quickWins: { type: 'array', minItems: 4, maxItems: 8, items: { type: 'string' } },
    redesignSuggestions: {
      type: 'object',
      additionalProperties: false,
      required: ['section', 'summary', 'layout', 'suggestedHeadline', 'primaryCTA', 'ctaPlacement', 'spacing'],
      properties: {
        section: { type: 'string' },
        summary: { type: 'string' },
        layout: { type: 'array', minItems: 3, maxItems: 5, items: { type: 'string' } },
        suggestedHeadline: { type: 'string' },
        primaryCTA: { type: 'string' },
        ctaPlacement: { type: 'string' },
        spacing: { type: 'string' },
      },
    },
  },
};

function demoAudit(mode = 'roast') {
  const roast = mode === 'roast';
  return {
    overallScore: 62,
    categoryScores: {
      usability: 68,
      accessibility: 57,
      visualDesign: 72,
      navigation: 74,
      copy: 49,
      conversion: 51,
      consistency: 70,
    },
    headline: roast ? 'Pretty page. Shy product.' : 'Strong visual foundation, unclear product story.',
    summary: roast
      ? 'The page looks polished at first glance, but the hero makes users decode what the product does before they can decide whether they care. Your main CTA is also competing with too many equally loud elements.'
      : 'The page has a solid visual foundation, but the hero does not communicate the product value quickly enough. The primary action also needs stronger visual priority.',
    verdict: roast
      ? 'You do not need a redesign from orbit. You need a clearer promise, one obvious action, and about 25% less visual negotiation.'
      : 'Keep the visual system, but simplify the first screen around one promise and one primary action.',
    topIssues: [
      {
        title: 'The hero headline does not explain the product',
        description: roast ? '“Unlock your digital potential” is carrying a lot of motivational-poster energy and almost zero product information.' : 'The headline is aspirational but does not explain what the product actually helps users do.',
        severity: 'High',
        impact: 'Users cannot quickly tell whether the product is relevant to them, which weakens comprehension and conversion.',
        recommendation: 'Replace the abstract promise with an outcome, audience, or concrete job-to-be-done.',
        example: 'Build and deploy production websites with AI in minutes.',
      },
      {
        title: 'The primary CTA is visually underpowered',
        description: roast ? 'Your CTA is playing hide-and-seek, and unfortunately it is winning.' : 'The main CTA does not stand out enough from secondary actions and nearby content.',
        severity: 'High',
        impact: 'Users have to scan longer to find the next step, reducing momentum at the most important point on the page.',
        recommendation: 'Use one high-contrast primary button, reduce emphasis on secondary links, and keep the CTA adjacent to the value proposition.',
        example: 'Start building free',
      },
      {
        title: 'Too many elements compete above the fold',
        description: 'Badges, supporting copy, navigation, CTAs, and decorative elements all demand attention at nearly the same visual weight.',
        severity: 'Medium',
        impact: 'A crowded attention hierarchy makes the page feel slower to understand even when it looks aesthetically polished.',
        recommendation: 'Reduce the number of high-contrast elements above the fold and create a clear sequence: headline → proof → CTA.',
        example: 'Keep one badge, one headline, one short paragraph, and one primary CTA in the first viewport.',
      },
      {
        title: 'Body copy is denser than the visual style suggests',
        description: 'The supporting paragraph is longer and more complex than the rest of the page’s clean visual language.',
        severity: 'Medium',
        impact: 'Dense copy creates a speed bump immediately after the headline and can reduce message retention.',
        recommendation: 'Cut the hero paragraph to one sentence focused on the most valuable outcome.',
        example: 'Turn a prompt into a production-ready site without wrestling with setup, hosting, or boilerplate.',
      },
    ],
    usabilityIssues: [
      {
        title: 'Primary and secondary actions look too similar',
        description: 'Multiple actions use similar visual treatment, so the interface does not clearly signal which one is the recommended next step.',
        severity: 'High',
        impact: 'Choice friction increases at the exact point where the page should be easiest to act on.',
        recommendation: 'Reserve the strongest fill, contrast, and size for one primary CTA. Demote secondary actions to text or outline styles.',
        example: 'Primary: “Start building free” · Secondary: “View examples”',
      },
      {
        title: 'Section spacing does not clearly separate topics',
        description: 'Some content groups are visually close enough that they read as one section even though they serve different purposes.',
        severity: 'Medium',
        impact: 'Users scanning the page may miss transitions and struggle to build a mental model of the page structure.',
        recommendation: 'Increase vertical spacing between major sections and tighten spacing within each content group.',
        example: 'Use roughly 72–96px between major desktop sections and 20–32px inside each section.',
      },
      {
        title: 'The first viewport asks for too much scanning',
        description: 'The eye has to bounce between navigation, hero text, supporting badges, and multiple actions before the page communicates a clear path.',
        severity: 'Medium',
        impact: 'High scan cost makes an otherwise polished interface feel less effortless.',
        recommendation: 'Collapse supporting details below the first decision point and keep the hero visually linear.',
        example: 'Headline → one-line proof → CTA → lightweight trust signal.',
      },
    ],
    copyIssues: [
      {
        title: 'Headline is too abstract',
        description: 'The current headline communicates ambition but not capability.',
        severity: 'High',
        impact: 'Visitors should understand the product category and value within a few seconds.',
        original: 'Unlock your digital potential',
        suggested: 'Build and deploy websites with AI in minutes',
      },
      {
        title: 'CTA sounds generic',
        description: 'The call to action does not preview what will happen after the click.',
        severity: 'Medium',
        impact: 'Specific CTAs reduce uncertainty and better connect the action to the promised outcome.',
        original: 'Get Started',
        suggested: 'Start building free',
      },
    ],
    accessibilityIssues: [
      {
        title: 'Secondary text may be too low-contrast',
        description: 'Several muted text elements appear light against the background in the screenshot.',
        severity: 'Medium',
        recommendation: 'Darken secondary text and verify foreground/background contrast with an automated contrast checker.',
        confidence: 'likely',
        verification: 'Sample the exact foreground and background colors in the rendered browser and test them against WCAG contrast thresholds.',
      },
      {
        title: 'Some small labels may be difficult to read',
        description: 'Eyebrow labels and metadata appear visually small, especially if the screenshot represents desktop scale at 100%.',
        severity: 'Medium',
        recommendation: 'Keep essential interface text comfortably legible and avoid relying on tiny uppercase labels for important information.',
        confidence: 'possible',
        verification: 'Inspect computed font sizes and test at browser zoom levels up to 200%.',
      },
      {
        title: 'Click-target size cannot be confirmed from the screenshot',
        description: 'Some controls look compact, but a static image cannot reliably reveal their actual interactive hit area.',
        severity: 'Low',
        recommendation: 'Ensure interactive controls have generous hit areas even when the visible icon or label is small.',
        confidence: 'possible',
        verification: 'Inspect the rendered element box size and keyboard focus behavior in the browser.',
      },
    ],
    quickWins: [
      'Rewrite the hero headline around a concrete user outcome',
      'Give one CTA the strongest contrast on the page',
      'Cut the hero paragraph to one sentence',
      'Increase contrast on muted body text',
      'Add more space between major content sections',
      'Demote secondary actions to reduce competition',
    ],
    redesignSuggestions: {
      section: 'Hero section',
      summary: 'Keep the current visual language, but rebuild the hero around a single narrative path. The goal is to make the product understandable before the user notices the decorative polish.',
      layout: [
        'Short category or proof label',
        'One concrete outcome-focused headline',
        'One sentence explaining who it is for and what it replaces',
        'One primary CTA with one quiet secondary link',
        'Lightweight social proof or product preview below the decision point',
      ],
      suggestedHeadline: 'Build and deploy websites with AI in minutes',
      primaryCTA: 'Start building free',
      ctaPlacement: 'Directly below the supporting sentence, left-aligned with the hero copy. Keep the secondary action visually quieter beside it.',
      spacing: 'Use 16–20px from headline to supporting copy, 24–28px before the CTA row, and 64–88px before the next major section.',
    },
  };
}

function buildPrompt(mode, url) {
  const tone = mode === 'roast'
    ? 'Use light, witty sarcasm where it helps, aimed only at the website. Never insult the designer or user. Every joke must still communicate a concrete design observation.'
    : 'Use a constructive, neutral, professional tone.';

  return `You are a senior UX auditor analyzing a website screenshot. ${tone}

Your job is to produce a specific, evidence-based audit of what is actually visible in the screenshot.
${url ? `The user supplied this URL only as context: ${url}. Do not claim you visited or scraped it.` : ''}

Evaluate usability, visual hierarchy, navigation, accessibility, copy clarity, layout and spacing, mobile implications that can reasonably be inferred, calls to action, consistency, and overall user experience.

Rules:
- Be concrete. Point to visible UI patterns, wording, hierarchy, spacing, density, alignment, contrast, and action clarity.
- Do not invent text that is not visible. If exact text is unreadable, describe the element instead of pretending you read it.
- Accessibility must distinguish what is visibly evident from what requires browser/DOM verification. Use confidence="confirmed" only when the issue can truly be established from the screenshot itself; otherwise use likely or possible.
- Do not claim formal WCAG violations from a screenshot unless they are directly determinable.
- Scores should be internally consistent with the findings, not randomly generous.
- Prioritize 3–5 highest-impact problems.
- Recommendations must be actionable enough that a designer or developer could implement them.
- For copy issues, quote only wording you can actually read in the image.
- The redesign suggestion should focus on the single highest-impact section and include concrete hierarchy, copy, CTA placement, and spacing guidance.
- Keep each field concise enough for a polished dashboard, not a long report.`;
}


const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function readJson(req, maxBytes = 18 * 1024 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('PAYLOAD_TOO_LARGE');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8') || '{}';
  return JSON.parse(raw);
}

async function handleApi(req, res, urlPath) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });

  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    if (error.message === 'PAYLOAD_TOO_LARGE') return json(res, 413, { error: 'Screenshot payload is too large.' });
    return json(res, 400, { error: 'Invalid JSON request.' });
  }

  if (urlPath === '/api/demo') {
    return json(res, 200, { audit: demoAudit(body?.mode) });
  }

  if (urlPath !== '/api/analyze') return json(res, 404, { error: 'Not found.' });

  const { imageDataUrl, mode = 'roast', url = '' } = body || {};
  if (!imageDataUrl) return json(res, 400, { error: 'A screenshot is required for reliable analysis in this demo.' });
  if (!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(imageDataUrl)) return json(res, 400, { error: 'Unsupported screenshot format.' });

  // Webinar-safe fallback: the full UI still works without an API key.
  if (!process.env.OPENAI_API_KEY) return json(res, 200, { audit: demoAudit(mode), demoFallback: true });

  try {
    const apiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5.6-terra',
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: buildPrompt(mode, url) },
            { type: 'input_image', image_url: imageDataUrl, detail: 'high' },
          ],
        }],
        text: {
          format: {
            type: 'json_schema',
            name: 'ux_audit',
            strict: true,
            schema: AUDIT_SCHEMA,
          },
        },
      }),
    });

    const data = await apiResponse.json();
    if (!apiResponse.ok) {
      console.error('OpenAI error:', data);
      return json(res, 502, { error: 'The AI audit failed. Check your API key/model access and try again.' });
    }

    const outputText = data.output_text || data.output
      ?.flatMap((item) => item.content || [])
      ?.find((part) => part.type === 'output_text')
      ?.text;

    if (!outputText) {
      console.error('No structured output text:', data);
      return json(res, 502, { error: 'The AI returned an unexpected response.' });
    }

    const audit = JSON.parse(outputText);
    return json(res, 200, { audit });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'The AI audit failed. Check your API key/model access and try again.' });
  }
}

async function serveStatic(res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(requested).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(__dirname, safePath);
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403); return res.end('Forbidden');
  }
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mime[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
    });
    res.end(data);
  } catch {
    try {
      const data = await fs.readFile(path.join(__dirname, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(data);
    } catch {
      res.writeHead(404); res.end('Not found');
    }
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url.pathname);
  return serveStatic(res, decodeURIComponent(url.pathname));
});

server.listen(port, '0.0.0.0', () => {
  console.log(`RoastMySite running at http://localhost:${port}`);
});
