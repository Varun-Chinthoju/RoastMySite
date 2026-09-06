import test from 'node:test';
import assert from 'node:assert/strict';

import { extractGeminiOutputText, extractOpenRouterOutputText } from '../src/provider-utils.mjs';

test('extracts structured text from a Gemini Interactions model_output step', () => {
  const response = { steps: [{ type: 'thought' }, { type: 'model_output', content: [{ type: 'text', text: '{"ok":true}' }] }] };
  assert.equal(extractGeminiOutputText(response), '{"ok":true}');
});

test('accepts the direct output_text response shape', () => {
  assert.equal(extractGeminiOutputText({ output_text: '{"ok":true}' }), '{"ok":true}');
});

test('returns null when Gemini has no text output', () => {
  assert.equal(extractGeminiOutputText({ steps: [{ type: 'thought' }] }), null);
});

test('extracts structured text from an OpenRouter chat completion', () => {
  assert.equal(extractOpenRouterOutputText({ choices: [{ message: { content: '{"ok":true}' } }] }), '{"ok":true}');
});

test('extracts text parts from an OpenRouter content array', () => {
  assert.equal(extractOpenRouterOutputText({ choices: [{ message: { content: [{ type: 'text', text: '{"ok":true}' }] } }] }), '{"ok":true}');
});

test('returns null when OpenRouter has no message content', () => {
  assert.equal(extractOpenRouterOutputText({ choices: [{ message: {} }] }), null);
});
