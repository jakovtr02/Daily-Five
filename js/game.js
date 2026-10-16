/* Daily Five — all puzzle selection and UI run locally, including on file://. */
(function (global) {
  'use strict';
  const { xmur3, mulberry32, shuffle } = global.DailyFiveRNG;
  const DIFFICULTIES = ['easy', 'easy', 'medium', 'medium', 'hard'];
  const START_UTC = Date.UTC(2026, 0, 1);
  const dateKey = () => new Date().toISOString().slice(0, 10);
  const numberForDate = key => Math.floor((Date.parse(key + 'T00:00:00Z') - START_UTC) / 86400000) + 1;

  function makePuzzle(key, bank = global.QUESTIONS) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Number.isFinite(Date.parse(key + 'T00:00:00Z'))) {
      throw new Error('Use a UTC date in YYYY-MM-DD format.');
    }
    const random = mulberry32(xmur3('daily-five:' + key));
    const indices = shuffle(Array.from({ length: bank.length }, (_, i) => i), random);
    const selected = [];
    const used = new Set();
    // First pass: preserve category variety for each prescribed difficulty slot.
    for (const difficulty of DIFFICULTIES) {
      const index = indices.find(i => bank[i].diff === difficulty && !selected.includes(i) && !used.has(bank[i].cat));
      if (index === undefined) break;
      selected.push(index);
      used.add(bank[index].cat);
    }
    // If impossible, retry with difficulty unchanged but categories unrestricted.
    if (selected.length !== 5) {
      selected.length = 0;
      for (const difficulty of DIFFICULTIES) {
        const index = indices.find(i => bank[i].diff === difficulty && !selected.includes(i));
        if (index === undefined) throw new Error('Question bank is missing the required difficulty: ' + difficulty);
        selected.push(index);
      }
    }
    return selected.map(i => {
      const item = bank[i];
      const options = shuffle(item.a.map((text, original) => ({ text, original })), random);
      return { id: item.id, cat: item.cat, diff: item.diff, q: item.q, fact: item.fact,
        options: options.map(o => o.text), correctIndex: options.findIndex(o => o.original === 0), correctAnswer: item.a[0] };
    });
  }

  const safeGet = key => { try { return global.localStorage.getItem(key); } catch (_) { return null; } };
  const safeSet = (key, value) => { try { global.localStorage.setItem(key, value); } catch (_) { /* session only */ } };
  const safeJSON = (str, fallback) => { try { return str ? JSON.parse(str) : fallback; } catch (_) { return fallback; } };
  const key = dateKey();
  const puzzle = makePuzzle(key);
  const puzzleNumber = numberForDate(key);
  const answerKey = 'daily-five:answers:' + key;
  const validAnswers = v => Array.isArray(v) && v.length <= 5 && v.every((a, i) => Number.isInteger(a) && a >= 0 && a < puzzle[i].options.length);
  let answers = safeJSON(safeGet(answerKey), []);
  if (!validAnswers(answers)) answers = [];
  let revealed = false;
  let stats = safeJSON(safeGet('daily-five:stats:v1'), null);
  if (!stats || !Number.isInteger(stats.gamesPlayed) || !Number.isInteger(stats.totalCorrect)) {
    stats = { gamesPlayed: 0, currentStreak: 0, bestStreak: 0, totalCorrect: 0, lastCompleted: null };
  }
  const $ = id => document.getElementById(id);
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function correct(i) { return answers[i] === puzzle[i].correctIndex; }
  function score() { return answers.filter((_, i) => correct(i)).length; }
  function previousUTC(keyString) { return new Date(Date.parse(keyString + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10); }
  function completeStats() {
    if (stats.lastCompleted === key) return;
    // Completeness matters: count a finished puzzle only once.
    stats.gamesPlayed += 1;
    stats.totalCorrect += score();
    stats.currentStreak = stats.lastCompleted === previousUTC(key) ? (stats.currentStreak || 0) + 1 : 1;
    stats.bestStreak = Math.max(stats.bestStreak || 0, stats.currentStreak);
    stats.lastCompleted = key;
    safeSet('daily-five:stats:v1', JSON.stringify(stats));
  }
  function drawTiles() {
    const container = $('progress');
    container.replaceChildren();
    for (let i = 0; i < 5; i++) {
      const state = i < answers.length ? (correct(i) ? 'correct' : 'wrong') : i === answers.length ? 'current' : 'empty';
      const tile = el('div', 'tile tile--' + state + ((revealed && i === answers.length - 1) ? ' tile--pop' : ''),
        state === 'correct' ? '✓' : state === 'wrong' ? '×' : String(i + 1));
      tile.setAttribute('aria-label', 'Question ' + (i + 1) + ': ' + state);
      container.append(tile);
    }
  }
  function answer(index) {
    if (answers.length >= 5 || revealed || !Number.isInteger(index) || index < 0 || index > 3) return;
    answers.push(index);
    safeSet(answerKey, JSON.stringify(answers));
    revealed = true;
    renderQuestion();
    $('next').focus();
  }
  function next() {
    if (!revealed) return;
    revealed = false;
    render();
    if (answers.length < 5) $('answer-0').focus();
  }
  function renderQuestion() {
    $('question-screen').hidden = false;
    $('results-screen').hidden = true;
    drawTiles();
    const pos = revealed ? answers.length - 1 : answers.length;
    const item = puzzle[pos];
    $('category').textContent = item.cat + ' · ' + item.diff;
    $('question').textContent = item.q;
    $('round-label').textContent = 'Question ' + (pos + 1) + ' of 5';
    const options = $('options');
    options.replaceChildren();
    item.options.forEach((option, index) => {
      const button = el('button', 'answer', '');
      button.id = 'answer-' + index;
      button.type = 'button';
      button.append(el('span', 'answer__number', String(index + 1)), el('span', 'answer__text', option));
      if (revealed) {
        button.disabled = true;
        if (index === item.correctIndex) button.classList.add('answer--correct');
        else if (index === answers[pos]) button.classList.add('answer--wrong');
      } else button.addEventListener('click', () => answer(index));
      options.append(button);
    });
    $('feedback').hidden = !revealed;
    $('feedback').textContent = revealed ? (correct(pos) ? 'Correct! ' : 'Not quite. ') + item.fact : '';
    $('next').hidden = !revealed;
    $('next').textContent = pos === 4 ? 'See results' : 'Next question';
    $('next').onclick = next;
  }
  function shareText() {
    return 'Daily Five No. ' + puzzleNumber + '\n' + score() + '/5\n' + answers.map((_, i) => correct(i) ? '🟩' : '🟥').join('');
  }
  async function copyResults() {
    const value = shareText();
    let worked = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
        worked = true;
      }
    } catch (_) { /* file:// may not permit clipboard API */ }
    if (!worked) {
      const area = el('textarea');
      area.value = value;
      area.setAttribute('aria-label', 'Share result text');
      area.style.position = 'fixed'; area.style.opacity = '0';
      document.body.append(area);
      area.focus(); area.select();
      try { worked = document.execCommand('copy'); } catch (_) { /* manual fallback */ }
      if (worked) area.remove();
      else { area.style.opacity = '1'; area.style.position = 'static'; area.style.width = '100%'; }
    }
    $('copy-status').textContent = worked ? 'Copied to clipboard!' : 'Select and copy the result text below.';
  }
  function renderResults() {
    completeStats();
    $('question-screen').hidden = true;
    $('results-screen').hidden = false;
    drawTiles();
    const total = score();
    $('final-score').textContent = total + '/5';
    $('score-message').textContent = ['A new day, a new chance.', 'You got one! Keep exploring.', 'Some good calls today.', 'Nice work — three right!', 'Strong showing!', 'A clean sweep!'][total];
    $('stat-played').textContent = String(stats.gamesPlayed);
    $('stat-streak').textContent = String(stats.currentStreak);
    $('stat-best').textContent = String(stats.bestStreak);
    $('stat-correct').textContent = String(stats.totalCorrect);
    const review = $('review'); review.replaceChildren();
    puzzle.forEach((item, i) => {
      const entry = el('li', 'review-item');
      const icon = el('span', 'review-icon ' + (correct(i) ? 'review-icon--correct' : 'review-icon--wrong'), correct(i) ? '✓' : '×');
      const detail = el('div', 'review-detail');
      detail.append(el('span', 'review-question', item.q), el('span', 'review-answer', item.correctAnswer));
      entry.append(icon, detail); review.append(entry);
    });
    updateCountdown();
  }
  function updateCountdown() {
    if (dateKey() !== key) { global.location.reload(); return; }
    const now = Date.now();
    const nextMidnight = Date.parse(key + 'T00:00:00Z') + 86400000;
    const remaining = Math.max(0, Math.ceil((nextMidnight - now) / 1000));
    const h = Math.floor(remaining / 3600), m = Math.floor(remaining % 3600 / 60), s = remaining % 60;
    $('countdown').textContent = [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
    if (remaining === 0) global.location.reload();
  }
  function render() { if (answers.length === 5 && !revealed) renderResults(); else renderQuestion(); }
  $('puzzle-number').textContent = 'No. ' + puzzleNumber;
  $('copy').addEventListener('click', copyResults);
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || event.target.matches('textarea, input')) return;
    if (/^[1-4]$/.test(event.key) && answers.length < 5 && !revealed) { event.preventDefault(); answer(Number(event.key) - 1); }
    else if (event.key === 'Enter' && revealed) { event.preventDefault(); next(); }
  });
  // An answered round has already been committed to storage: show the next one after reload.
  render();
  global.setInterval(() => { if (dateKey() !== key) global.location.reload(); else if (answers.length === 5 && !revealed) updateCountdown(); }, 1000);
  global.DailyFive = Object.freeze({ makePuzzle, numberForDate, dateKey });
})(window);
