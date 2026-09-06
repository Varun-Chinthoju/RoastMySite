import test from 'node:test';
import assert from 'node:assert/strict';

import { demoAudit, validateAuditShape } from '../src/audit-schema.mjs';

test('accepts the built-in audit shape and preserves accessibility evidence labels', () => {
  const audit = demoAudit('professional');

  assert.equal(validateAuditShape(audit), audit);
  assert.ok(audit.strengths.length >= 2);
  assert.match(audit.remakePrompt, /Build/);
  assert.deepEqual(
    audit.accessibilityIssues.map((issue) => [issue.confidence, issue.basis]),
    [['likely', 'visual'], ['possible', 'manual']],
  );
});

test('rejects an audit missing a required top-level field', () => {
  const audit = demoAudit();
  delete audit.summary;

  assert.throws(() => validateAuditShape(audit), /missing summary/);
});

test('rejects an audit without strengths or a remake prompt', () => {
  const missingStrengths = demoAudit();
  delete missingStrengths.strengths;
  assert.throws(() => validateAuditShape(missingStrengths), /missing strengths/);

  const missingPrompt = demoAudit();
  delete missingPrompt.remakePrompt;
  assert.throws(() => validateAuditShape(missingPrompt), /missing remakePrompt/);
});

test('rejects accessibility findings with an unsupported evidence basis', () => {
  const audit = demoAudit();
  audit.accessibilityIssues[0].basis = 'inferred';

  assert.throws(() => validateAuditShape(audit), /invalid value/);
});

test('rejects a non-object model response', () => {
  assert.throws(() => validateAuditShape(null), /returned no audit/);
  assert.throws(() => validateAuditShape('not-json'), /returned no audit/);
});

test('rejects malformed scores and underspecified issue arrays', () => {
  const invalidScore = demoAudit();
  invalidScore.overallScore = 101;
  assert.throws(() => validateAuditShape(invalidScore), /overallScore/);

  const invalidIssues = demoAudit();
  invalidIssues.topIssues = [];
  assert.throws(() => validateAuditShape(invalidIssues), /too few items/);
});

test('accepts a concise redesign layout when the page does not need three steps', () => {
  const audit = demoAudit();
  audit.redesignSuggestions.layout = ['Headline', 'Primary CTA'];

  assert.equal(validateAuditShape(audit), audit);
});

test('accepts an empty redesign layout when no concrete sequence is justified', () => {
  const audit = demoAudit();
  audit.redesignSuggestions.layout = [];

  assert.equal(validateAuditShape(audit), audit);
});
