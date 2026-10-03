# Deploy the two Firestore indexes

Labels: manual, milestone-5

The leaderboard queries need the two composite indexes in `firestore.indexes.json`. Rules were pasted into the console by hand; indexes were never deployed. This blocks the leaderboard screen on the live site.

Route A (CLI). Needs Node.js 20 or later; this PC had 14.15.1.

- [ ] Upgrade Node (`winget install OpenJS.NodeJS.LTS`), open a new terminal.
- [ ] `firebase.cmd login`
- [ ] `firebase.cmd deploy --only firestore` (never a plain `firebase deploy`). Check the output mentions only Firestore rules and indexes.

Route B (console). Firestore, Indexes, Composite, Add index, collection `runs`, twice:

- [ ] `board` Ascending, `gameVersion` Ascending, `uid` Ascending, `score` Descending.
- [ ] `board` Ascending, `gameVersion` Ascending, `uid` Ascending, `createdAt` Descending.

Done when both indexes show "Enabled".
