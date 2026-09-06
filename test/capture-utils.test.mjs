import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeWebsiteURL, classifyAccessibilityBasis, isBlockedPageData, computeScrollPositions, buildDOMInspectionScript } from '../src/capture-utils.mjs';

test('normalizes a bare hostname to an https URL', () => {
  assert.equal(normalizeWebsiteURL(' example.com/path '), 'https://example.com/path');
});

test('rejects unsupported URL schemes', () => {
  assert.throws(() => normalizeWebsiteURL('file:///tmp/site.html'), /http or https/);
});

test('classifies DOM evidence as programmatic and missing evidence as manual', () => {
  assert.equal(classifyAccessibilityBasis({ programmatic: true }), 'programmatic');
  assert.equal(classifyAccessibilityBasis({ visuallyLikely: true }), 'visual');
  assert.equal(classifyAccessibilityBasis({}), 'manual');
});

test('detects challenge and authentication pages from bounded visible text', () => {
  assert.equal(isBlockedPageData({ title: 'Checking your browser', visibleText: 'Please verify you are human' }), 'BLOCKED');
  assert.equal(isBlockedPageData({ title: 'Sign in', visibleText: 'Log in to continue' }), 'AUTH_REQUIRED');
  assert.equal(isBlockedPageData({ title: 'Example', visibleText: 'Welcome home' }), null);
});

test('computes bounded scroll positions that always include the page start and end', () => {
  assert.deepEqual(computeScrollPositions(5000, 1000, 4), [0, 1000, 2000, 3000, 4000]);
  assert.deepEqual(computeScrollPositions(700, 1000, 4), [0]);
});

test('DOM inspection includes semantic tab evidence without requiring activation', () => {
  const script = buildDOMInspectionScript();
  assert.match(script, /role=\\?"tab\\?"/);
  assert.match(script, /tabs/);
});
