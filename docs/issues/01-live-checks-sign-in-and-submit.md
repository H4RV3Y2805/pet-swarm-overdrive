# Live checks: sign-in and run submission (milestones 3 and 4)

Labels: manual, milestone-3, milestone-4

Code is merged and deployed. Nothing here has been verified against real Firebase; only a fake SDK was used in tests. These are checks for Len on `https://h4rv3y2805.github.io/pet-swarm-overdrive/`.

- [ ] Natalie signs in and sees "Signed in as Natalie" (Len and Aiden are done).
- [ ] Signed in, play a run and die: summary shows a score and "Score sent to the leaderboard."
- [ ] Firebase console, Firestore, `runs`: one document with the player's UID, `board` `std-normal`, a score, no email or name.
- [ ] "End run" from the pause menu adds a document with `ended` = `quit`.
- [ ] Signed out, a run shows "Not signed in: score not sent" and adds no document.
- [ ] With `#bot` on the address, a finished run adds no document.
- [ ] Firebase console, Settings, Usage and billing: confirm the project is on the Spark plan.

If a signed-in run says "Could not send the score", the published rules are rejecting the document: compare the Rules tab with `firestore.rules` in the repo and report the difference.
