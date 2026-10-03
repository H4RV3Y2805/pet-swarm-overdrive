# Pet Swarm: Overdrive

A top-down survival arena game for the browser. Pick a character and a team of pets, fight
growing swarms, build a wild combination of weapons, pets and technology, beat two bosses in
about 12 minutes, then try a different build.

## How to launch

1. Unzip the folder anywhere on the PC (for example the Desktop).
2. Double-click `index.html`. It opens in the default browser (Edge, Chrome or Firefox).
3. Press F11 for full screen if you like.

No installation, no internet, no account, no build step. The game makes no network requests.

## Controls

| Action | Keys |
|---|---|
| Move | W A S D or the arrow keys |
| Character ability | Space |
| Pause / resume | Esc or P |
| Pick an upgrade | Click the card, or press 1 to 4 |
| Reroll upgrade offer | R (limited rerolls per run) |

Weapons and pets attack automatically. Menus are fully usable with the mouse.
The game pauses by itself when the window loses focus or the tab is hidden.

## What is in the game

- **3 characters**: Rook (Bolt Caster, Comet Dash), Vex (Arc Coil, Thunderclap), Moss (Sentry Pod, Rally Beacon).
- **5 weapons**, each with 5 levels and an evolution that changes how it attacks:
  Bolt Caster to Rail Lance, Arc Coil to Storm Web, Orbit Blades to Saw Halo, Boom Seeds to Cluster Bloom, Sentry Pod to Tesla Bastion.
- **6 pets**, each with two ability variants: Zapkit, Emberwyrm, Bulwark Beetle (available at once),
  Magpip, Cogmole, Frostfinch (unlocked by clearly stated goals). Two pet slots, a third from research.
- **Run technology** (resets every run): three branches (Swarm, Arsenal, Engineering) with prerequisites and a capstone each,
  plus **5 cross-branch synergies** (Pyro Salvo, Hunter's Signal, Scrap Halo, Cryo Shatter, Live Wire).
- **Permanent research** (kept forever, bought with Sparks): new options and small boosts only.
- **6 enemy types** with telegraphed attacks, **2 bosses** (Gloop King at 6:00, Hex Engine at 12:00), optional endless mode after winning.
- **3 arenas**: Meadow Circuit (open), Crystal Caverns (pillars block movement and enemy shots), Molten Foundry (lava vents hurt everyone).
- **3 difficulties**, **3 fixed-seed challenges**, **11 achievements** that each unlock something playable.
- **Seeded runs**: type a seed on the team screen to replay the same upgrade offers and encounters. The seed is shown in the HUD and on the summary.
- Short interactive tutorial on the first run, next-unlock goal on the main menu, end-of-run summary with damage per source.

Danger is never shown by colour alone: enemy attacks are red **and** striped **and** marked with "!"; enemy shots are spiky stars.

## Saving

- Progress saves automatically in the browser's local storage for this file location.
  If you move the folder, or use a different browser, export first and import afterwards.
- Settings, Export save to file / Import save from file use a JSON file. Invalid files are rejected with a visible message and change nothing.
- Settings, Reset save asks for confirmation.
- A run in progress is not saved. Rewards are banked when a run ends (death, victory, or End run from the pause menu).
  Closing the tab mid-run forfeits that run's rewards.
- If a browser blocks local storage for local files, the main menu says so; use export/import in that case.

## Settings

Master, effects and music volume. Screen shake, damage numbers, low effects mode (fewer particles, no damage numbers,
no ground decoration), FPS counter.

## Files

```
index.html            entry point (double-click this)
css/style.css         menu styling
js/rng.js             seeded random numbers (gameplay) and a separate cosmetic generator
js/data.js            ALL balance values and content definitions - edit numbers here
js/save.js            save, validation, export/import, reward banking
js/audio.js           synthesised sound and music (no audio files)
js/sim.js             core simulation: stats, damage, player, pickups, spatial grid
js/enemies.js         spawn director, enemy AI, bosses, telegraphs, arena hazards
js/weapons.js         weapons, projectiles (pooled), bombs, turrets, traps
js/pets.js            pet behaviours, bonus strikes, Swarmlings
js/upgrades.js        upgrade offers, prerequisites, descriptions
js/sprites.js         all artwork, drawn with Canvas 2D at start-up
js/render.js          world and HUD rendering
js/ui.js              menus
js/main.js            game loop, input, pause, run flow
js/bot.js             autoplayer for testing only (open index.html#bot)
js/firebase-config.js Firebase project identifiers (public by design; access is set by firestore.rules)
js/online.js          optional online layer: Google sign-in and player list check. Inert on file://
firestore.rules       who may read and write leaderboard data
firestore.indexes.json, firebase.json, .firebaserc   Firestore indexes and Firebase CLI settings
tools/                developer tests (need Node.js; browser tests also need Playwright). Not needed to play.
CHECKLIST.md          what is done, what was tested, ideas for later
```

## Online features (hosted version only)

Played from the GitHub Pages address, the main menu shows an optional "Sign in with Google" panel for the family leaderboards. Only accounts on the player list are accepted. The game stores a player ID and a nickname chosen by Len: no email, Google name or photo. Opened by double-click (`file://`), the game shows no sign-in panel and makes no network requests. If the sign-in service cannot be reached, the hosted game still plays and says leaderboards are unavailable.

Every run shows a score on its summary screen. When signed in, each finished run (death, victory or "End run") is sent to the leaderboard once. Runs that used the autoplayer or a test hook are never sent. A send that fails is kept on the PC and retried after the next sign-in. Score weights are in `BAL.score` in `js/data.js`.

## Stage 2 documents

`docs/STAGE2_SPEC.md` (design), `docs/SETUP_RUNBOOK.md` (console and command-line steps), `docs/CURRENT_STATE.md` (baseline and progress).

## Developer tests

Not needed to play. Needs Node.js 22 or later.

```
npm ci                              installs Playwright (developer dependency only)
npx playwright install chromium     one-off browser download
npm test                            syntax check, 61 logic tests, 48 browser tests, 49 online tests
```

`npm run check`, `npm run test:logic`, `npm run test:browser` and `npm run test:online` run each part alone.
The online tests serve the game on localhost and swap the Firebase SDK for a fake; they never contact the real project.
GitHub Actions (`.github/workflows/ci.yml`) runs the same four steps on every push and pull request to `main`.

## Tuning

Everything numeric is in `js/data.js`: `BAL` (global), `WEAPONS`, `PETS`, `TECH`, `SYNERGIES`, `ENEMIES`, `BOSSES`,
`WAVES` (spawn rate per second over time), `DIFFS`, `RESEARCH`, `ACHIEVEMENTS`, `CHALLENGES`.
Too hard early: lower the `rate` values in the first rows of `WAVES`, or `DIFFS.normal.dmg`.
Too easy late: raise `hpScaleQuad` or the later `WAVES` rates.

## Browser notes

- Uses only classic scripts and Canvas 2D, so it works from `file://` without a server.
- Sound starts after the first click or key press (browsers require this).
- Performance and test results are in `CHECKLIST.md`.
