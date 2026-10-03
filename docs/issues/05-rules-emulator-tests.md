# Milestone 6: Firestore rules tests in the emulator

Labels: test, milestone-6

`firestore.rules` has never been tested. Add rules tests using the Firebase Emulator Suite and `@firebase/rules-unit-testing` as developer tooling only (devDependency, under `tools/`). Needs Node 20 or later and Java. Check current Firebase documentation for versions and setup first.

Cases (spec section 9):

- [ ] Signed-out read of `players` and `runs` denied.
- [ ] Signed-in non-player: read and create denied.
- [ ] Player: read `players` and `runs` allowed.
- [ ] Player create with own UID and valid fields allowed.
- [ ] Denied: another UID; extra field; missing required field; bad `ended`; client-supplied `createdAt`; negative or oversized score; oversized `timeSec`.
- [ ] Update and delete on `runs` denied. Any write on `players` denied.
- [ ] A document built by `Sim.runSummary` plus `uid` and `createdAt` is accepted.

- [ ] `npm run test:rules` script. Decide with Len whether CI runs it (it needs Java on the runner).
- [ ] If any rule changes: show the full file and what each rule allows; Len republishes.
