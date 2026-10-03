# Pet Swarm: Overdrive - instructions for Claude Code

Top-down survival arena browser game: vanilla JavaScript, Canvas 2D, synthesised WebAudio, classic scripts, one global `PSO` namespace, no build step. Stage 1 (offline game) is finished. Stage 2 (GitHub, Pages, Google sign-in, family leaderboards for Len, Aiden and Natalie) is the current work.

## Read first

- `docs/STAGE2_SPEC.md`: design, data model, rules, milestones, closed decisions.
- `docs/CURRENT_STATE.md`: progress, conventions, what is not verified.
- `docs/SETUP_RUNBOOK.md`: console steps only Len can do.
- `docs/issues/`: the outstanding work, one file per GitHub issue.
- `README.md`, `CHECKLIST.md`.

The repo is the source of truth. Read a file before changing it.

## Hard constraints

1. Offline still works. Double-clicking `index.html` from `file://` launches the full game and makes zero network requests. Online features activate only on `http:` or `https:`.
2. No build step, no bundler, no runtime npm dependencies. Classic scripts only. Firebase loads from the gstatic CDN compat builds at a pinned version (`PSO.DATA.ONLINE.sdkVersion`).
3. All numeric balance and content values stay in `js/data.js`, including the score formula.
4. Gameplay randomness goes only through the seeded RNG streams on the run. Online code never consumes gameplay RNG and never changes simulation results. A seeded run must play identically signed in, signed out, or offline.
5. The game never waits on the network. Sign-in, submit and fetch are asynchronous, limited to 8 s and fail soft with a visible message.
6. No purchases, advertisements, daily streaks or time gates. Leaderboards must not add pressure mechanics.
7. Privacy. The repo and the Pages site are public. Never commit emails, UIDs, surnames, service account keys or anything from `.env`. Firestore stores a UID and an admin-set nickname only. One player is a child.
8. Access control lives in `firestore.rules`. Client-side checks are user experience only.
9. Runs that used the autoplayer (`#bot`) or any debug hook are never submitted (`R.tainted`).

## Firebase project

Project `bath-n-guess` is shared with another app that uses Realtime Database. Never touch the Realtime Database or its rules. Never run a plain `firebase deploy`: only `firebase deploy --only firestore`. `firebase.json` contains only the `firestore` block. On this PC call the CLI as `firebase.cmd` (PowerShell blocks the `.ps1` wrapper).

## Working rules

- Scope: Stage 2 only unless Len asks. Park other ideas in "Ideas for later" in `CHECKLIST.md`.
- One logical change per branch, commit and pull request. Never commit to `main` directly. Reference the issue number in the pull request ("Closes #N").
- Before every commit: `npm run check`, `npm run test:logic`, `npm run test:browser`, `npm run test:online`. Run the browser suites one at a time, not in parallel. Add tests for new behaviour.
- Report verification in three buckets: verified in a real browser, verified headless only, not verified. Live Firebase behaviour cannot be verified by tests; give Len a short manual check list.
- Check Firebase and GitHub facts against current documentation before relying on them.
- Any security rules change: show the full rules file, say what each rule allows, include test cases. Len publishes rules himself.
- Any change to the save format: bump the save version, add a migration, keep import validation strict.
- Bump `gameVersion` in `js/data.js` only for gameplay or balance changes: each bump starts fresh leaderboards.
- Keep `README.md`, `CHECKLIST.md` and `docs/` current in the same commit as the change they describe.

## Style

Address Len. Lead with the result, then his next steps, then stop. Prose over lists unless structure is the answer. No em-dashes. Quantify results; say "unknown" rather than guess. Len is new to pull requests and Actions: give exact commands and buttons.
