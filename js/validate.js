/* Dev-only bank validator. Browser: load question scripts, then this file.
   Node: node js/validate.js (automatically loads all ten data scripts). */
(function (global) {
  'use strict';
  const categories = ['Science', 'Geography', 'History', 'Culture', 'Nature', 'Tech', 'Food', 'Sport', 'Music', 'Caribbean'];
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    const fs = require('fs'), vm = require('vm'), path = require('path');
    const sandbox = { window: { QUESTIONS: [] } };
    for (const category of categories) {
      const source = fs.readFileSync(path.join(__dirname, '..', 'data', category.toLowerCase() + '.js'), 'utf8');
      vm.runInNewContext(source, sandbox, { filename: category + '.js' });
    }
    global.QUESTIONS = sandbox.window.QUESTIONS;
  }
  const bank = global.QUESTIONS || [];
  const errors = [], ids = new Set(), texts = new Set();
  const fail = message => errors.push(message);
  if (bank.length !== 500) fail(`Expected 500 questions, found ${bank.length}`);
  for (const category of categories) {
    const entries = bank.filter(q => q.cat === category);
    if (entries.length !== 50) fail(`${category}: expected 50 questions, found ${entries.length}`);
    for (const [difficulty, target] of [['easy', 20], ['medium', 20], ['hard', 10]]) {
      const count = entries.filter(q => q.diff === difficulty).length;
      if (count !== target) fail(`${category}/${difficulty}: expected ${target}, found ${count}`);
    }
  }
  bank.forEach((q, i) => {
    const name = `${q && q.id || 'row-' + i}`;
    if (!q || typeof q !== 'object') { fail(`${name}: invalid record`); return; }
    if (typeof q.id !== 'string' || ids.has(q.id)) fail(`${name}: missing or duplicate ID`);
    ids.add(q.id);
    if (!categories.includes(q.cat)) fail(`${name}: unknown category`);
    if (!['easy', 'medium', 'hard'].includes(q.diff)) fail(`${name}: invalid difficulty`);
    if (typeof q.q !== 'string' || !q.q.trim() || q.q.length > 140) fail(`${name}: invalid/long question`);
    const normalized = String(q.q).trim().toLowerCase();
    if (texts.has(normalized)) fail(`${name}: duplicate question text`);
    texts.add(normalized);
    if (!Array.isArray(q.a) || q.a.length !== 4) fail(`${name}: must have exactly four answers`);
    else {
      if (new Set(q.a.map(a => String(a).trim().toLowerCase())).size !== 4) fail(`${name}: duplicate answer options`);
      if (q.a.some(a => typeof a !== 'string' || !a.trim() || a.length > 50)) fail(`${name}: empty or long answer`);
    }
    if (typeof q.fact !== 'string' || !q.fact.trim()) fail(`${name}: missing fact`);
  });
  if (errors.length) {
    console.error(`Daily Five validation FAILED: ${errors.length} issue(s)`);
    errors.forEach(message => console.error('  ✗ ' + message));
    if (typeof process !== 'undefined') process.exitCode = 1;
  } else {
    console.log('✓ Daily Five validation PASSED: 500 questions, 10 categories × 50, each with 20 easy / 20 medium / 10 hard.');
    console.log('✓ IDs, question text, option uniqueness, facts and length limits passed.');
  }
})(typeof window !== 'undefined' ? window : globalThis);
