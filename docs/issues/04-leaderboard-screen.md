# Milestone 5: leaderboard screen

Labels: feature, milestone-5

Spec: `docs/STAGE2_SPEC.md` sections 6 and 7. Depends on the indexes issue for live use, not for development.

Build:

- [ ] `PSO.Online.fetchBoard(boardId)`: one-off reads, no realtime listeners, 8 s timeout, soft failure. Per player on the list: best (`orderBy score desc limit 1`) and latest (`orderBy createdAt desc limit 1`), filtered by `board`, `gameVersion` (current only) and `uid`. Player list and nicknames come from the `players` collection.
- [ ] Board definitions in `js/data.js`: nine boards, `std-<difficulty>` (3), `endless-<difficulty>` (3), `chal-<challengeId>` (3), with display names.
- [ ] "Leaderboards" button on the main menu, shown only when `PSO.Online.state` is `allowed`.
- [ ] Leaderboard screen in `js/ui.js`: board picker; one row per player with nickname (max 16 characters), best score and latest score; for the best run show character, pets, time and seed; sorted by best score.
- [ ] "Play this seed" on a row: opens the loadout with that seed, arena, difficulty and challenge filled in.
- [ ] States: loading, empty board, fetch failed with a "Try again" button. Never blocks the game.
- [ ] No pressure mechanics: no streaks, timers, or "you were beaten" prompts.

Tests:

- [ ] Extend the fake SDK in `tools/online-test.js` with `where`, `orderBy`, `limit`, `get` on `runs`.
- [ ] Online tests: best and latest per player, current `gameVersion` only, empty board, failure and retry, timeout, seed replay fills the loadout, button hidden when signed out.
- [ ] `file://` suite still shows no online controls and zero network requests.

Docs: README, CHECKLIST, CURRENT_STATE, spec milestone table.

Manual check list for Len after deploy: each of the nine boards opens; a new run appears after reopening the board; a run on an older `gameVersion` is hidden.
