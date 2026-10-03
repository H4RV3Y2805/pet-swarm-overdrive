# Pet Swarm: Overdrive - project checklist

## Implemented

- [x] Movement, auto-attacks, enemies, XP gems, level-ups, win, loss, restart
- [x] 3 characters with distinct weapons and Space abilities
- [x] 5 weapons, 5 levels each, 5 evolutions gated by a key tech
- [x] 6 pets, 2 variants each (variant B unlocked by Bond), pet levels during a run, 2 slots + 1 from research
- [x] Run tech: 3 branches, 19 nodes, prerequisites, 3 capstones, 4 specialisations
- [x] 5 cross-branch synergies gated by build tags
- [x] Permanent research: 9 nodes, modest effects, bought with Sparks
- [x] 6 enemy types with telegraphs, 2 bosses, seeded surprise encounters
- [x] 3 arenas (open, pillars, lava vents), 3 difficulties, 3 challenges, endless mode
- [x] 11 achievements with gameplay unlocks, next-goal display
- [x] Seeded runs with separate streams for spawns, offers and combat; cosmetic randomness separate
- [x] Limited rerolls; offers never contain duplicates, maxed items or items with unmet prerequisites
- [x] Save in local storage, JSON export/import with validation and visible errors, confirmed reset
- [x] Pause menu, auto-pause on blur and hidden tab, volume and effects settings, low effects mode
- [x] Interactive tutorial, in-game controls hint, tech tree viewer, end-of-run summary
- [x] Synthesised sound effects and music (no audio files)
- [x] Spatial hash grid, pooled projectiles, capped and merged gems, capped particles and damage numbers

## Stage 2 progress

- [x] Source control on GitHub, `v1.0.0` tagged at the Stage 1 delivery
- [x] GitHub Pages serving `main`
- [x] `package.json` (developer dependency only) and CI workflow: syntax check, logic tests, browser tests
- [x] Stage 2 documents in `docs/`, all design decisions closed
- [x] Firebase console setup: web app, Google provider, authorised domain, Firestore created (no rules deployed yet)
- [ ] Google sign-in in the game
- [ ] Firestore leaderboards and security rules

## Test results

Environment for all tests: Linux sandbox, 1 CPU core, Node 22, headless Chromium 141 via Playwright,
software rendering (SwiftShader, no GPU). Not tested on a real Windows PC, Edge or Firefox.

**Browser test** (`tools/browser-test.js`, page loaded from `file://` with the network blocked): 47 of 47 pass.
Fresh launch, keyboard movement, ability, tutorial, Esc/P pause, blur and hidden-tab auto-pause, volume slider,
effects toggles, level-up by mouse and keyboard, reroll, death summary, restart, reload without duplicated rewards,
both bosses, victory, endless continuation, endless banking only the extra progress, research purchase, export,
import, two kinds of invalid file (visible error, save untouched), reset with confirmation, zero network requests,
zero console errors.

**Logic test** (`tools/logic-test.js`): 40 of 40 pass. Offer legality over full autoplayer runs
(873 offers in 20 runs on an earlier revision, 204 offers in 5 runs on the final one), seed reproducibility,
reroll rules, all five synergies, Shared Target, Energy Shield, Barrier, evolution gating, save validation, banking.

**Frame rate** (`tools/perf-test.js`, software rendering on one core; measured before the last two small edits):

| Scenario | 1366x768 | 1920x1080 |
|---|---|---|
| Mid run 4:00 (about 100 to 180 enemies) | 60 fps | 57 fps |
| Late run 11:00, full effects (about 160 to 260 enemies) | 60 fps | 47 fps |
| Late run, low effects | 60 fps | 52 fps |
| Stress: 520 unkillable enemies around the player | 44 fps | 29 fps |
| Same, low effects | 50 fps | 35 fps |

Script time per frame was 0.3 to 1.1 ms simulation plus 0.9 to 2.2 ms issuing draw calls; the limit in this
environment is software pixel filling, not game logic. A PC with any GPU acceleration is expected to do better,
but that has not been measured.

**Balance probe** (autoplayer with a 0.35 s reaction delay and a noisy heading, random upgrade picks, 7 builds):
Normal 6 of 7 wins, Hard 2 of 7. Standing still on Normal: defeated between 1:47 and 3:06.
Winning runs: 12:11 to 13:18, level 37 to 46, about 21,000 to 27,000 kills, 250 to 460 enemies alive at peak.
All three challenges were won by the autoplayer. Endless reached 17:00 with a third boss kill.

## Not verified

- Real Windows hardware, Edge, Firefox, Safari.
- How the sound actually sounds (only that the audio context runs and volumes change).
- Fun and difficulty for a human player. The autoplayer dodges differently from a child.
- Very long endless runs (beyond 17:00).

## Known limitations

- A run in progress is not saved; closing the tab mid-run loses that run's rewards.
- Local storage on `file://` is tied to the folder path and browser. Moving the folder needs export/import.
- Exact replay needs the same seed, arena, difficulty and choices; enemy positions also depend on how you move.
- Imported saves are validated for shape and range, not protected against deliberate editing.
- No gamepad or touch controls.

## Ideas for later

- [ ] Sixth weapon (for example a boomerang) and a third boss
- [ ] More challenges and a personal best table per seed
- [ ] Gamepad support
- [ ] Banish (remove an upgrade from the pool for the run)
- [ ] Colour-blind palette option
