# Pet Swarm: Overdrive - Current State

Snapshot date: 2026-10-03. Stage 1 figures below are as reported when Stage 1 was delivered. Re-measure before quoting them as current.

## Stage 2 progress

- Repo `h4rv3y2805/pet-swarm-overdrive`, public, tag `v1.0.0`. The repo is the source of truth for code and documents.
- CI (`.github/workflows/ci.yml`): syntax check on 20 files, 40 logic tests, 47 browser tests. Green on `main` at `cd73576` (reported by Len).
- Site live at `https://h4rv3y2805.github.io/pet-swarm-overdrive/`.
- Firebase project `bath-n-guess` (shared with another app on Realtime Database): web app added, Google sign-in enabled, `h4rv3y2805.github.io` authorised, Firestore created (`(default)`, Standard, `europe-west2`, production mode). No rules or indexes deployed yet.
- All design decisions closed: see `docs/STAGE2_SPEC.md` section 13.

## What exists

A complete, playable offline game: `index.html`, `css/style.css`, 14 scripts under `js/`, developer tools under `tools/`, `README.md`, `CHECKLIST.md`. Content and file map are in the README.

## Architecture and conventions

- Classic `<script>` tags, no modules, no bundler. Everything hangs off one global namespace, `PSO`. Script load order is defined in `index.html` and matters.
- `js/data.js` holds every balance value and content definition (`BAL`, `WEAPONS`, `PETS`, `TECH`, `SYNERGIES`, `ENEMIES`, `BOSSES`, `WAVES`, `DIFFS`, `RESEARCH`, `ACHIEVEMENTS`, `CHALLENGES`).
- `js/rng.js` provides seeded gameplay streams via `makeRng(seed)` and a separate cosmetic generator `PSO.fxRng`. Particles and other cosmetics must use the cosmetic generator so they never disturb a seeded run.
- `js/save.js` owns persistence: browser local storage, JSON export and import with validation, reward banking at run end. A run in progress is not saved. The local storage key is `pso_save_v1`, already namespaced for the shared `github.io` origin. Save format `VERSION = 1`.
- There is no game version constant yet. Stage 2 adds `gameVersion` to `js/data.js`.
- Artwork is drawn procedurally with Canvas 2D at start-up (`js/sprites.js`). Audio is synthesised (`js/audio.js`). There are no asset files.
- The game makes no network requests.

## Debug and test hooks (relevant to leaderboard integrity)

- `index.html#bot` enables the autoplayer in `js/bot.js`.
- `PSO.Game.debugFastForward(seconds)` skips simulation time using the autoplayer without rendering.
- `PSO.Perf.start()` and `PSO.Perf.stop()` record per-frame timings.

Any run touched by these must be marked ineligible for submission in Stage 2.

## Test tooling (in `tools/`, not needed to play)

- Headless Node harness: loads the unmodified browser scripts into one context with `vm.runInThisContext`, after setting `global.window = global` and a minimal `localStorage` polyfill. Same source runs in Node and the browser; there is no separate test build.
- Logic test suite: 40 tests, all passing at delivery.
- Playwright (Chromium) browser suite: 47 tests, all passing at delivery. Includes a check, run from a `file://` URL with the browser context set offline, that every captured request URL is `file://`.
- Batch balance probe using the autoplayer, and a frame-rate measurement script.
- Routine: `npm run check`, then `npm run test:logic`, then `npm run test:browser`, or `npm test` for all three.
- Run the browser suite sequentially. Parallel runs collide on a shared temp file (`pso-export.json`) and fail the import tests falsely.
- Known flake, fixed in PR #2: the victory test runs on a random seed and sometimes died before the final boss. The test player is now boosted before fast-forwarding, the fast-forward stops at 11:55 and creeps to the boss spawn, and the run-count assertion follows the path taken. After the fix: 47 of 47 on 8 of 8 consecutive sandbox runs.

## Measured performance (headless Chromium, software rendering, one CPU core, no GPU)

- 60 fps at 1366x768 in typical mid-run conditions.
- 29 fps at 1920x1080 under an artificial 520-enemy stress test.

Real hardware with a GPU was not measured.

## Balance and rendering history worth knowing

- Enemy spawn rates were roughly doubled and the XP curve steepened after the first pass left the arena under-populated.
- One synergy and one pet's damage scaling were nerfed; Normal-difficulty damage was softened; enemy HP growth moved to a quadratic curve.
- Ground rendering uses cheap tile rectangles plus small stamped decoration sprites. A full-screen repeating pattern cost about 30% of frame rate and was removed.
- Low effects mode does not lower internal resolution: that was tried and measured slower than full resolution.

## Not verified

- Behaviour on real Windows in Edge, Chrome and Firefox.
- How the audio sounds to a human ear.
- Whether it is fun for a child. Difficulty was tuned against the autoplayer, not a human player.

- A full run on the Pages URL, and save export from `file://` then import on Pages (Len, milestone 2).
- Whether the three Firebase compat files load from gstatic at 12.19.0 (not reachable from the sandbox).
- Kill rate during boss fights, needed to confirm the score's speed term.
- The Firestore rules draft.

## Facts the Stage 2 design depends on

- `Game.endRun` (`js/main.js`) sets state `quit` and calls `finish('quit')`, which banks Sparks exactly as a death does.
- Endless is a continuation of a won run: `Game.continueEndless` then `Sim.continueEndless`. `Save.bankRun` is incremental for this reason.
- Boss schedule: `BAL.bossTimes = [360, 720]`. Endless bosses every 180 s, each 60% tougher (`BAL.endless.bossHpStep`).
- Run statistics already available: `R.kills`, `R.t`, `R.bossKills`, `R.level`, `R.gemsGot`, `R.won`, `R.diffId`, `R.challenge`, `R.dmgBy`, `R.dmgTaken`, `R.seedStr`. No score value exists yet.
- Difficulties: `normal`, `hard`, `overdrive`. Challenges: `ch_glass`, `ch_pets`, `ch_horde`, each fixed seed, meadow, normal.
