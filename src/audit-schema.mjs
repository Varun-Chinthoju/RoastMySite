export const ISSUE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['title', 'description', 'severity', 'impact', 'recommendation', 'example'],
  properties: { title: { type: 'string' }, description: { type: 'string' }, severity: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] }, impact: { type: 'string' }, recommendation: { type: 'string' }, example: { type: 'string' } },
};

export const STRENGTH_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['title', 'description', 'evidence'],
  properties: { title: { type: 'string' }, description: { type: 'string' }, evidence: { type: 'string' } },
};

export const AUDIT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['overallScore', 'categoryScores', 'headline', 'summary', 'verdict', 'strengths', 'topIssues', 'usabilityIssues', 'copyIssues', 'accessibilityIssues', 'quickWins', 'redesignSuggestions', 'remakePrompt'],
  properties: {
    overallScore: { type: 'integer', minimum: 0, maximum: 100 },
    categoryScores: { type: 'object', additionalProperties: false, required: ['usability', 'accessibility', 'visualDesign', 'navigation', 'copy', 'conversion', 'consistency'], properties: Object.fromEntries(['usability', 'accessibility', 'visualDesign', 'navigation', 'copy', 'conversion', 'consistency'].map((key) => [key, { type: 'integer', minimum: 0, maximum: 100 }])) },
    headline: { type: 'string' }, summary: { type: 'string' }, verdict: { type: 'string' },
    strengths: { type: 'array', minItems: 2, maxItems: 5, items: STRENGTH_SCHEMA },
    topIssues: { type: 'array', minItems: 3, maxItems: 5, items: ISSUE_SCHEMA },
    usabilityIssues: { type: 'array', minItems: 2, maxItems: 6, items: ISSUE_SCHEMA },
    copyIssues: { type: 'array', minItems: 1, maxItems: 5, items: { type: 'object', additionalProperties: false, required: ['title', 'description', 'severity', 'impact', 'original', 'suggested'], properties: { title: { type: 'string' }, description: { type: 'string' }, severity: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] }, impact: { type: 'string' }, original: { type: 'string' }, suggested: { type: 'string' } } } },
    accessibilityIssues: { type: 'array', minItems: 2, maxItems: 6, items: { type: 'object', additionalProperties: false, required: ['title', 'description', 'severity', 'recommendation', 'confidence', 'basis', 'verification'], properties: { title: { type: 'string' }, description: { type: 'string' }, severity: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] }, recommendation: { type: 'string' }, confidence: { type: 'string', enum: ['confirmed', 'likely', 'possible'] }, basis: { type: 'string', enum: ['programmatic', 'visual', 'manual'] }, verification: { type: 'string' } } } },
    quickWins: { type: 'array', minItems: 4, maxItems: 8, items: { type: 'string' } },
    redesignSuggestions: { type: 'object', additionalProperties: false, required: ['section', 'summary', 'layout', 'suggestedHeadline', 'primaryCTA', 'ctaPlacement', 'spacing'], properties: { section: { type: 'string' }, summary: { type: 'string' }, layout: { type: 'array', maxItems: 5, items: { type: 'string' } }, suggestedHeadline: { type: 'string' }, primaryCTA: { type: 'string' }, ctaPlacement: { type: 'string' }, spacing: { type: 'string' } } },
    remakePrompt: { type: 'string' },
  },
};

function assertSchema(value, schema, path = 'audit') {
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path} must be an object.`);
    for (const key of schema.required || []) if (!(key in value)) throw new Error(`The AI audit is missing ${key}.`);
    if (schema.additionalProperties === false) for (const key of Object.keys(value)) if (!schema.properties?.[key]) throw new Error(`${path}.${key} is not allowed.`);
    for (const [key, child] of Object.entries(schema.properties || {})) if (key in value) assertSchema(value[key], child, `${path}.${key}`);
    return;
  }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) throw new Error(`${path} must be an array.`);
    if (schema.minItems !== undefined && value.length < schema.minItems) throw new Error(`${path} has too few items.`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) throw new Error(`${path} has too many items.`);
    value.forEach((item, index) => assertSchema(item, schema.items, `${path}[${index}]`));
    return;
  }
  if (schema.type === 'string' && typeof value !== 'string') throw new Error(`${path} must be a string.`);
  if (schema.type === 'integer' && (!Number.isInteger(value) || value < schema.minimum || value > schema.maximum)) throw new Error(`${path} must be an integer between ${schema.minimum} and ${schema.maximum}.`);
  if (schema.enum && !schema.enum.includes(value)) throw new Error(`${path} has an invalid value.`);
}

export function validateAuditShape(audit) {
  if (!audit || typeof audit !== 'object' || Array.isArray(audit)) throw new Error('The AI returned no audit.');
  assertSchema(audit, AUDIT_SCHEMA);
  return audit;
}

export function demoAudit(mode = 'roast') {
  const roast = mode === 'roast';
  const issue = (title, description, recommendation, example = '') => ({ title, description, severity: 'High', impact: 'Users have to work harder to understand the page and choose an action.', recommendation, example });
  return { overallScore: 62, categoryScores: { usability: 68, accessibility: 57, visualDesign: 72, navigation: 74, copy: 49, conversion: 51, consistency: 70 }, headline: roast ? 'Pretty page. Shy product.' : 'Strong visual foundation, unclear product story.', summary: roast ? 'The page looks polished, but the hero makes users decode what the product does before they can decide whether they care.' : 'The page has a solid visual foundation, but the hero does not communicate the product value quickly enough.', verdict: roast ? 'You need a clearer promise, one obvious action, and less visual negotiation.' : 'Keep the visual system, but simplify the first screen around one promise and one primary action.', strengths: [{ title: 'The visual system feels intentional', description: 'The page uses a consistent visual language that makes the experience feel designed rather than assembled.', evidence: 'Repeated spacing, color, and component styling are visible across the page.' }, { title: 'The page has a clear starting point', description: 'The first screen gives users an obvious place to begin exploring the experience.', evidence: 'The primary content and first interaction are visible without requiring a search.' }], topIssues: [issue('The hero headline does not explain the product', 'The headline is aspirational but does not explain what the product helps users do.', 'Replace the abstract promise with a concrete outcome.', 'Build and deploy websites with AI in minutes.'), issue('The primary action is easy to miss', 'Multiple elements compete for attention above the fold.', 'Give one CTA the strongest visual priority.', ''), issue('Muted text may be too quiet', 'Secondary copy appears visually faint.', 'Increase contrast and verify exact colors in the browser.', '')], usabilityIssues: [issue('The page asks users to decode the value proposition', 'The first screen does not answer who this is for quickly.', 'Add audience and outcome language near the headline.'), issue('The hierarchy has too many equal moments', 'Several elements have similar visual weight.', 'Create a clearer headline, proof, CTA sequence.')], copyIssues: [{ title: 'Abstract hero copy', description: 'The headline sounds positive but remains vague.', severity: 'High', impact: 'Vague copy delays comprehension.', original: 'Unlock your digital potential', suggested: 'Build and launch your next website in minutes' }], accessibilityIssues: [{ title: 'Possible muted-text contrast issue', description: 'Secondary text appears light against the page background.', severity: 'Medium', recommendation: 'Sample the rendered colors and check contrast against WCAG thresholds.', confidence: 'likely', basis: 'visual', verification: 'Verify exact foreground and background colors programmatically.' }, { title: 'Interactive labels need browser verification', description: 'A screenshot cannot confirm whether every control has an accessible name.', severity: 'Medium', recommendation: 'Inspect accessible names for controls and form fields.', confidence: 'possible', basis: 'manual', verification: 'Run an accessibility tree or keyboard review.' }], quickWins: ['Make the hero promise outcome-focused', 'Give one CTA the strongest contrast', 'Increase contrast on muted body text', 'Add more space between major sections'], redesignSuggestions: { section: 'Hero section', summary: 'Keep the current visual language, but rebuild the hero around one narrative path.', layout: ['Proof label', 'Concrete headline', 'Supporting sentence', 'Primary CTA', 'Lightweight proof'], suggestedHeadline: 'Build and deploy websites with AI in minutes', primaryCTA: 'Start building free', ctaPlacement: 'Directly below the supporting sentence.', spacing: 'Use 16–20px between headline and copy, 24–28px before the CTA.' }, remakePrompt: 'Build a production-quality product experience from this audit. Preserve the intentional visual system, clear starting point, and consistent spacing. Fix the hero with a concrete outcome-focused headline, one dominant primary CTA, clearer supporting copy, and stronger contrast for secondary text. If this product is an app or dashboard, build it as an Electron desktop app with an app shell, navigation, and focused workflows—not as a marketing landing page. Keep it responsive, accessible, and grounded in the existing brand rather than replacing its personality.' };
}
