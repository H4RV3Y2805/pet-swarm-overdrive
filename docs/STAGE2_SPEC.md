# Pet Swarm: Overdrive - Stage 2 Specification

GitHub source control, GitHub Pages hosting, Google sign-in and family leaderboards.
Status: agreed with Len, 2026-10-03. All decisions in section 13 are closed. Score weights are provisional.

## 1. Goals

1. The game lives in a GitHub repo with history, tags and automated tests.
2. The game is playable at a GitHub Pages URL on any PC with a browser.
3. Len, Aiden and Natalie sign in with Google and see shared leaderboards.
4. The offline double-click build keeps working unchanged, with zero network requests.

## 2. Non-goals

- Public leaderboards or open registration.
- Cheat-proof scores. Scores are client-reported; acceptable for three trusted players.
- Cloud save sync (candidate for a later stage).
- Multiplayer, chat, friends lists, notifications.
- A build step, a framework, or Firebase Hosting.

## 3. Architecture

```
GitHub repo (main) --GitHub Actions--> GitHub Pages (static files)
                                            |
                              browser loads index.html
                                            |
              js/online.js (only on http/https) loads Firebase compat SDK from gstatic
                                |                         |
                     Firebase Authentication        Cloud Firestore
                     (Google provider, popup)       (players, runs)
```

Repo: `https://github.com/h4rv3y2805/pet-swarm-overdrive` (public). Site: `https://h4rv3y2805.github.io/pet-swarm-overdrive/`. Firebase project: `bath-n-guess`, shared with another app that uses Realtime Database. The game uses Firestore only and never touches the Realtime Database; `databaseURL` is left out of the game's config.

### New and changed files

| File | Purpose |
|---|---|
| `js/firebase-config.js` | Firebase web config object. Safe to commit: it identifies the project, it does not grant access. Security rests on rules. |
| `js/online.js` | The whole online layer, exposed as `PSO.Online`. Nothing else talks to Firebase. |
| `js/ui.js` | Sign-in control on the main menu, leaderboard screen, submission status on the run summary. |
| `js/main.js` | `tainted` flag; call `PSO.Online.submitRun()` once, at final run end. |
| `js/sim.js` | Boss fight timer (simulation time). Score calculation. |
| `js/data.js` | `gameVersion`, `BAL.score`, board definitions. |
| `firestore.rules`, `firestore.indexes.json`, `firebase.json` | Rules and indexes, deployed with the Firebase CLI. `firebase.json` contains only the Firestore block. |
| `.github/workflows/ci.yml`, `deploy.yml` | Tests on every push and pull request; Pages deploy from `main`. |

### `PSO.Online` contract

- `PSO.Online.available`: false on `file://`, or if the SDK failed to load. The rest of the game checks only this flag.
- `init()`: on `http:` or `https:` only, inject the three compat scripts in order (app, auth, firestore), then initialise. On `file://` do nothing at all, so the zero-network guarantee holds.
- `signIn()`, `signOut()`, `onChange(callback)`, `state`: one of `offline`, `signedOut`, `checking`, `allowed`, `notAllowed`, `error`.
- `submitRun(summary)`: returns a promise; never throws into the game loop.
- `fetchBoard(boardId)`: one-off read, no realtime listeners.
- Every call has an 8 s timeout and resolves to a soft failure with a visible message.
- Online code never consumes gameplay RNG and never changes simulation results.

### Firebase SDK

Compat builds from `https://www.gstatic.com/firebasejs/12.19.0/`: `firebase-app-compat.js`, `firebase-auth-compat.js`, `firebase-firestore-compat.js`. They work as classic scripts with no bundler. 12.19.0 was the latest `firebase` release on npm on 2026-10-03. Confirm the three CDN files load before milestone 3 is merged (gstatic is not reachable from the development sandbox). Upgrade deliberately.

## 4. Hosting

- GitHub Pages serves the site at `https://h4rv3y2805.github.io/pet-swarm-overdrive/`.
- `deploy.yml` runs on push to `main` and publishes `index.html`, `css/` and `js/` only. `tools/`, `docs/` and the rules files are not published. Pages source is set to "GitHub Actions".
- `index.html` uses relative paths for all 14 scripts and the stylesheet, so the sub-path needs no code change.
- Local storage on the Pages origin is separate from the `file://` copy. Existing progress moves across with Export save and Import save. The save key is `pso_save_v1`, already namespaced for the shared `github.io` origin. Any new key (for example the retry queue) takes the `pso_` prefix.

## 5. Authentication

- Provider: Google only. Already enabled in the project.
- Flow: `signInWithPopup`, started from a click. Avoid `signInWithRedirect`: on a non-Firebase-hosted domain it depends on third-party storage access, which current browsers block.
- Authorised domains: `h4rv3y2805.github.io` and `localhost` are both listed (confirmed 2026-10-03).
- Google sign-in does not work from `file://`. Develop online features against a local static server (`python -m http.server 8080` in the repo folder).
- Allowlist: after sign-in the client reads `players/{uid}`. A document means allowed. Permission denied means not on the list: show a plain message and sign out.
- UIDs are per Firebase project. Two of the three players already have accounts in this project from the other app and keep the same UID. The third gets one at first sign-in.
- Supervised (Family Link) Google accounts may need parent approval for third-party sign-in. Test with the real accounts in milestone 3, before building anything on top.

## 6. Data model (Firestore)

Database: `(default)`, Standard edition, `europe-west2`, created in production mode.

### `players/{uid}`

Created by Len in the Firebase console only. Clients can read, never write.

| Field | Type | Notes |
|---|---|---|
| `nick` | string | First name: Len, Aiden or Natalie. Set by Len. Display is capped at 16 characters. Not the Google display name. |
| `createdAt` | timestamp | |

### `runs/{autoId}`

One document per human run, written once when the run finally ends. Create-only.

| Field | Type | Notes |
|---|---|---|
| `uid` | string | Must equal the signed-in UID |
| `board` | string | Board id, see section 7 |
| `gameVersion` | string | `PSO` game version the run was played on |
| `mode` | string | `standard`, `endless`, `challenge` |
| `difficulty` | string | `normal`, `hard`, `overdrive` |
| `arena` | string | Arena id |
| `character` | string | Character id |
| `seed` | string | Run seed, so anyone can replay it |
| `challengeId` | string or null | `ch_glass`, `ch_pets`, `ch_horde` |
| `ended` | string | `dead`, `won`, `quit` |
| `won` | bool | True if the final scheduled boss was beaten, including runs that continued into endless |
| `timeSec` | number | Seconds survived |
| `kills` | int | |
| `bossKills` | int | |
| `level` | int | |
| `score` | int | See section 7 |
| `build` | map | `weapons`, `pets`, `synergies` as arrays of ids |
| `createdAt` | timestamp | Server timestamp at write |

The client maps `uid` to `nick` from the `players` collection (three documents). Nicknames are never client-written.

### Queries

Each board shows, per player, the highest score and the latest score, for the current `gameVersion` only. Per player, per board:

```
best:   where board == B, gameVersion == V, uid == U   orderBy score desc      limit 1
latest: where board == B, gameVersion == V, uid == U   orderBy createdAt desc  limit 1
```

That is two queries per player, six document reads to open one board with three players.

### Indexes (`firestore.indexes.json`)

| Collection | Fields |
|---|---|
| `runs` | `board` asc, `gameVersion` asc, `uid` asc, `score` desc |
| `runs` | `board` asc, `gameVersion` asc, `uid` asc, `createdAt` desc |

### Known consequence

A run that was queued offline gets its `createdAt` when it is finally written, not when it was played. It can therefore show as "latest" although a newer run exists. Accepted for now.

### Cost

Three players, reads only when the leaderboard screen opens, one write per run. Stay on the Spark (no-cost) plan with no billing account attached, so charges are not possible. Whether the shared project has a billing account attached for the other app: unknown, Len to check.

## 7. Boards and score

### Boards

Nine boards: `std-<difficulty>` (3), `endless-<difficulty>` (3), `chal-<challengeId>` (3).

Assignment: a challenge run goes to its `chal-` board whatever happens. Otherwise a run goes to `endless-<difficulty>` if the player continued past the win, and to `std-<difficulty>` if not.

Boards split on every `gameVersion`. Only the current version is shown. Older runs stay in Firestore, hidden.

Each row shows nickname, best score and latest score, with character, pets, time and seed for the best run and a "play this seed" action.

### Game version

`gameVersion` is a string in `js/data.js`, starting at `1.0.0`. Bump it only for releases that change gameplay or balance: every bump empties the visible boards.

### Score

```
score     = round( (seconds * T + kills * K + sum of bossBonus) * difficultyMult )
bossBonus = base + speed * max(0, 1 - fightSeconds / par)        per boss killed
```

- All weights live in `BAL.score` in `js/data.js`.
- Provisional weights: `K` = 1, `T` = 10, `base` = 2,000, `speed` = 12,000, `par` = 120 s.
- `difficultyMult` starts at 1.0 for all three difficulties; Len tunes later. Challenge runs use a fixed 1.0. Because boards are split by difficulty, the multiplier scales scores without changing rankings within a board.
- `fightSeconds` is simulation time from boss spawn to boss death, so it is deterministic for a seed and input sequence.
- In endless, `par` is scaled by the boss HP multiplier (`BAL.endless.bossHpStep`, 60% tougher per endless boss).
- Requirements: same time with more kills scores higher; same time and kills with a faster boss kill scores higher.
- Stalling constraint: in a standard run the final boss kill ends the run, so a faster kill also means less time and fewer kills. The speed bonus must fall faster per second than time and kills accrue. With the provisional weights the bonus falls 100 points per second inside par; time accrues 10 per second; kills must therefore accrue under 90 per second during a boss fight. Kill rate during boss fights: not yet measured. A test must prove a faster kill never scores lower.
- Reference: a typical autoplayer win on Normal scores about 52,000 (roughly 40% kills, 14% time, 46% bosses).

## 8. Run eligibility and submission

A run is submitted if all hold: `PSO.Online.state` is `allowed`; the run was played by a human (the autoplayer was never active); no debug hook was called. A single `tainted` flag on the run is set by the `#bot` autoplayer, `PSO.Game.debugFastForward` and `PSO.Perf.start`/`stop`.

Every human run submits: death, victory, and "End run" from the pause menu.

Submission happens exactly once, at the final end of the run. Winning shows the victory screen but does not submit, because the player may continue into endless (`Game.continueEndless`). The run submits when it finally ends: leaving the victory screen without continuing, or death or "End run" during endless. A guard on the run prevents a second submission.

If submission fails, the run is queued in local storage (cap 20, oldest dropped) and retried after the next successful sign-in. Queued runs keep the `gameVersion` they were played on. If the player is not signed in, the run is not queued.

## 9. Security rules (draft, untested)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isPlayer() {
      return request.auth != null
        && exists(/databases/$(database)/documents/players/$(request.auth.uid));
    }

    match /players/{uid} {
      allow read: if isPlayer();
      allow write: if false;
    }

    match /runs/{runId} {
      allow read: if isPlayer();
      allow create: if isPlayer()
        && request.resource.data.keys().hasOnly(
             ['uid','board','gameVersion','mode','difficulty','arena','character',
              'seed','challengeId','ended','won','timeSec','kills','bossKills',
              'level','score','build','createdAt'])
        && request.resource.data.keys().hasAll(
             ['uid','board','gameVersion','ended','score','timeSec','createdAt'])
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.createdAt == request.time
        && request.resource.data.board is string
        && request.resource.data.board.size() <= 40
        && request.resource.data.gameVersion is string
        && request.resource.data.gameVersion.size() <= 20
        && request.resource.data.ended in ['dead','won','quit']
        && request.resource.data.score is int
        && request.resource.data.score >= 0
        && request.resource.data.score <= 1000000000
        && request.resource.data.timeSec is number
        && request.resource.data.timeSec >= 0
        && request.resource.data.timeSec <= 86400;
      allow update, delete: if false;
    }
  }
}
```

What each rule allows:

- `players`: an allowlisted player may read player documents (to map UID to nickname). Nobody may write from a client; only Len, in the console.
- `runs` read: an allowlisted player may read any run.
- `runs` create: an allowlisted player may add a run under their own UID, with only the listed fields, a server timestamp and bounded values.
- `runs` update and delete: nobody from a client.
- Everything else in the database: denied by default.

The allowlist is held as UIDs in Firestore, not as emails in the rules file, because the rules file sits in a public repo. These rules cover Firestore only and do not affect the other app's Realtime Database rules.

Required rule tests: signed-out read denied; signed-in non-player read and create denied; player create with own UID allowed; player create with another UID denied; extra field denied; missing required field denied; bad `ended` value denied; client-supplied `createdAt` denied; update and delete denied; player cannot write `players`.

## 10. Testing

- Existing suites keep passing, including the `file://` zero-network test.
- New logic tests: score monotonic in kills and in boss kill speed; faster final boss kill never scores lower; board assignment; `tainted` set by each debug surface; seeded run identical with online stubbed on and off.
- New Playwright tests over `http://localhost` with `PSO.Online` backed by a stub, covering every state in section 3 and the submit, queue and retry paths.
- Rules tests with the Firebase Emulator Suite (developer tooling in `tools/`; needs Node and Java).
- Manual check list for Len on the live site: sign-in on each real account, a non-allowlisted account is refused, a run appears on the board, bot run does not.

## 11. Milestones

| # | Milestone | State | Done when |
|---|---|---|---|
| 1 | Repo | Done | Stage 1 code committed and tagged `v1.0.0`; `.gitignore`; CI runs syntax, logic and browser tests |
| 2 | Pages | In progress | Deploy workflow live; game plays at the Pages URL; save export and import verified between `file://` and Pages |
| 3 | Sign-in | Unblocked | Sign-in and sign-out on the main menu; allowlist enforced; all three real accounts tested |
| 4 | Submit | Not started | `gameVersion`; boss fight timer; score; `tainted` flag; run written at final run end; retry queue |
| 5 | Boards | Not started | Leaderboard screen with nine boards, best and latest per player, seed replay |
| 6 | Hardening | Not started | Rules tests pass in the emulator; API key referrer restriction; README and CHECKLIST updated |

## 12. Acceptance criteria

1. Double-clicking `index.html` offline plays as in Stage 1 and the zero-network test passes.
2. The Pages URL plays the same game with no console errors.
3. Only the three allowlisted Google accounts can read or write leaderboard data, proven by rule tests.
4. A finished eligible run appears on the correct board within one screen refresh.
5. Bot and debug runs never appear.
6. With Firebase unreachable, the hosted game is fully playable and says leaderboards are unavailable.
7. No email, Google display name or photo is stored in Firestore or the repo.
8. A seeded run plays identically signed in, signed out and offline.

## 13. Decisions (all closed by Len, 2026-10-03)

| # | Decision | Outcome |
|---|---|---|
| 1 | Repo visibility | Public |
| 2 | GitHub user and repo | `h4rv3y2805` / `pet-swarm-overdrive` |
| 3 | Firebase project | Reuse the existing project, `bath-n-guess` |
| 4 | Database | Firestore, added alongside the other app's Realtime Database. UID allowlist. |
| 5 | Nicknames | Len, Aiden, Natalie. Set by Len in the console. Display capped at 16 characters. |
| 6 | Submission | Every human run submits, including "End run". One document per run, at final run end. |
| 7a | Boards | Nine boards; best and latest score per player. Endless board if the player continued past the win. |
| 7b | Score | Formula in section 7. Weights provisional. |
| 8 | Balance changes | Boards split on `gameVersion`; only the current version is shown. |
| 9 | Network | 8 s timeout; retry queue of 20 in local storage. |
