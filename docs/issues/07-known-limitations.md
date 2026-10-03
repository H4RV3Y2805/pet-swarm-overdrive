# Known limitations to decide on

Labels: decision, later

Accepted for now. Decide whether to fix, or move to "Ideas for later" in `CHECKLIST.md`.

- [ ] Closing the tab on the victory screen, before continuing or leaving it, loses that run's submission.
- [ ] A run queued offline gets `createdAt` when it is finally sent, so it can show as "latest" out of order.
- [ ] Score weights and difficulty multipliers in `BAL.score` are provisional (all multipliers 1.0). Tuning them after real scores exist needs a `gameVersion` bump.
- [ ] The local PC has Node 14; developer tests need Node 22. Tests currently run only in CI.
