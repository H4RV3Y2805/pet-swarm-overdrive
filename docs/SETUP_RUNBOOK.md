# Pet Swarm: Overdrive - Setup Runbook

Steps only Len can do: accounts, consoles, credentials. Console menu names move around; if a label differs, look for the nearest equivalent. Values: `<user>` is `h4rv3y2805`, `<repo>` is `pet-swarm-overdrive`, `<project>` is `bath-n-guess`.

Status on 2026-10-03: sections A and C are done. Section B is done up to step 2. Sections D to G are still to do.

## A. GitHub repo

1. Install Git for Windows if needed. Confirm with `git --version`.
2. On github.com create an empty repo `<repo>` (no README, no licence). Public.
3. In the unzipped game folder:

```
git init -b main
git add .
git commit -m "Stage 1 baseline: complete offline game"
git tag v1.0.0
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main --tags
```

4. Before the first push, check nothing private is in the folder (exported save files, notes).

## B. GitHub Pages

1. Repo, Settings, Pages. Quick start: Source "Deploy from a branch", branch `main`, folder `/ (root)`.
2. Wait for the deployment, then open `https://<user>.github.io/<repo>/` and play one run.
3. Before merging the pull request that adds `.github/workflows/deploy.yml`: Repo, Settings, Pages, set Source to "GitHub Actions". The site keeps serving the last deployment in the meantime.
4. Merge the pull request. Repo, Actions tab: wait for "Deploy to GitHub Pages" to go green. If it ran before step 3 and failed, open the run and click "Re-run all jobs".
5. Reload the Pages URL and play one run. Confirm `https://<user>.github.io/<repo>/tools/logic-test.js` now returns 404: only `index.html`, `css/` and `js/` are published.

## C. Firebase project

1. console.firebase.google.com: open the existing project `bath-n-guess`. It also hosts another app that uses Realtime Database. Leave that database and its rules alone.
2. Stay on the Spark plan. Do not attach a billing account. Check Settings, Usage and billing, to confirm the plan.
3. Add a Web app (no Firebase Hosting). Copy the `firebaseConfig` object; it goes in `js/firebase-config.js` without the `databaseURL` line. Done.
4. Authentication, Sign-in method: enable Google and set the support email. Done (already enabled).
5. Authentication, Settings, Authorised domains: add `<user>.github.io`. Confirm `localhost` is listed. Done.
6. Firestore (under Project shortcuts, or Databases and storage): Standard edition, database ID `(default)`, location `europe-west2` (London), production mode, no scheduled backups. Done. The location cannot be changed afterwards.

## D. Rules and indexes

Do not run this section until `firestore.rules`, `firestore.indexes.json` and `firebase.json` are in the repo.

The project also holds the other app's Realtime Database. `firebase.json` in this repo must contain only a `firestore` block, and the deploy command must keep `--only firestore`. A plain `firebase deploy` is never used here. With both in place, the Realtime Database and its rules are not touched.

In the repo folder:

```
npm install -g firebase-tools
firebase login
firebase use --add          (pick <project>)
firebase deploy --only firestore
```

Alternative without the CLI: paste the rules into Firestore, Rules, Publish, and create the two indexes from the links in the browser console errors the first time the leaderboard queries run.

## E. Allowlist the three players

For each of Len, Aiden and Natalie:

1. Sign in once on the hosted site with their Google account. The game will say the account is not on the list. That is expected. Len and Natalie already have accounts in this project from the other app, so they can skip this step; Aiden cannot.
2. Firebase console, Authentication, Users: copy that account's User UID.
3. Firestore, `players` collection: add a document whose id is the UID, with fields `nick` (string: `Len`, `Aiden` or `Natalie`) and `createdAt` (timestamp).
4. Sign in again and confirm the leaderboard screen opens.

If any account is supervised through Family Link, do step 1 with the parent present: third-party sign-in may need approval.

## F. Move existing progress to the hosted version

Per player, per browser: in the offline copy, Settings, Export save to file. On the hosted site, Settings, Import save from file.

## G. Optional hardening (milestone 6)

Google Cloud console, APIs and Services, Credentials, the browser API key: add HTTP referrer restrictions for `https://<user>.github.io/*`, `https://<project>.firebaseapp.com/*` (the sign-in popup is served from there) and the localhost address used for development. Test sign-in immediately afterwards; a wrong restriction breaks it.

## H. Report back to the Project

- Repo URL and Pages URL.
- Firebase project id and the `firebaseConfig` object.
- Results of each manual check list.
- Do not paste emails, UIDs or any service account key into chat or the repo.

## Local development of online features

Google sign-in does not work from `file://`. In the repo folder run `python -m http.server 8080` and open `http://localhost:8080/`.
