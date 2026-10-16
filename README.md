# Daily Five

A two-minute daily trivia game using plain HTML, CSS and JavaScript. All 500 questions are original entries in ten category-specific JavaScript files. No backend, dependencies, build step, service worker, fetch, or local JSON requests are required.

## Run

Double-click `index.html` to open it in a browser (`file://` works). Optionally put the directory on any static web host. A new five-question set starts at **00:00 UTC**, regardless of your device's timezone. Everyone using the same version of the bank gets the same five questions and option order each day.

## Add or edit questions

Open one of the `data/*.js` files and add an object inside its `.concat([...])` array. Each record uses `id`, `cat`, `diff`, `q`, `a` and `fact`. `a` contains four answer strings; **the first is correct**. Keep each category at 50 questions (20 easy, 20 medium, 10 hard), or adjust the validator and rebalance the data. Use unique IDs and question texts; never add version-specific values like live sports records. **Changing the bank or its order changes daily puzzles**; publish content updates intentionally, preferably between UTC days.

## How daily seeding works

The UTC date key is `new Date().toISOString().slice(0,10)`. The key `daily-five:YYYY-MM-DD` is hashed to a 32-bit integer with `xmur3`, then passed to `mulberry32`. A Fisher–Yates shuffle of all question indices creates the daily ordering. The first selection pass picks two easy, two medium, one hard, all in different categories. If that fails, selection restarts with the same shuffled order and the category restriction dropped, while preserving difficulty. The same PRNG stream then shuffles the four options for each selected question. No unseeded randomness is used.

Puzzle No. 1 is January 1, 2026 UTC. Results and aggregate stats use localStorage with defensive try/catch. If storage is blocked, play works in memory for the open page (refresh persistence is unavailable).

## Validate

From the project folder run `node js/validate.js`. It loads the source data files and reports errors for counts, difficulty distribution, IDs, duplicate questions/options, missing facts and length limits. The browser alternative is to load all data scripts and then `js/validate.js` in a development HTML page; it is deliberately **not** loaded by `index.html`.

## Cross-device deterministic test

Open the game on two devices, then paste into each browser's developer console:

```js
DailyFive.makePuzzle('2026-10-16').map(question => question.id)
```

Compare the resulting five IDs. To verify the option order too:

```js
DailyFive.makePuzzle('2026-10-16').map(({id, options}) => ({id, options}))
```

This test does not alter the current game or stored answers.

## Keyboard and accessibility

Use keys **1–4** to pick answers and **Enter** after an answer to advance. The progress strip, locked correct/wrong answers, visible focus rings, live feedback and reduced-motion preference are supported. Colors switch automatically with the browser's light/dark preference.
