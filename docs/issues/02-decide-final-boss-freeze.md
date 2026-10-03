# Decision: keep the final-boss score freeze?

Labels: decision, milestone-4

`BAL.score.freezeDuringFinalBoss` (in `js/data.js`) is on. While the final boss of a run is alive, seconds and kills do not add to the score; only the speed of the kill does. Counting resumes in endless.

Reason: without it, stalling the final boss past the 120 s par pays, because time and kills keep adding after the speed bonus has stopped falling. This was added after the formula was agreed, so Len has not yet confirmed it.

- [ ] Len confirms: keep, or switch off.
- [ ] If switched off: remove or rewrite the two stalling tests in `tools/logic-test.js` and update `docs/STAGE2_SPEC.md` section 7.

No `gameVersion` bump is needed while the boards are empty. Once real scores exist, changing this needs a bump.
