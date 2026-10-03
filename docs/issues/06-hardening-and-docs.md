# Milestone 6: hardening and final documentation

Labels: manual, docs, milestone-6

- [ ] Confirm in a real browser that the three Firebase compat scripts load from gstatic at the pinned version (`PSO.DATA.ONLINE.sdkVersion`, 12.19.0): on the live site, browser dev tools, Network tab, no failed `firebasejs` requests.
- [ ] API key referrer restriction (Runbook section G): Google Cloud console, APIs and Services, Credentials, the browser key. Allow `https://h4rv3y2805.github.io/*`, `https://bath-n-guess.firebaseapp.com/*`, and the other app's addresses that use the same key. Check what the other app needs before saving. Test sign-in on both apps immediately afterwards; a wrong restriction breaks it.
- [ ] README, CHECKLIST, `docs/` reviewed against the finished Stage 2. Mark all milestones done in the spec.
- [ ] Walk the acceptance criteria in spec section 12 and record the result of each.
- [ ] Tag the release (for example `v2.0.0`).
