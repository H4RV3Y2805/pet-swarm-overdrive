/* Online layer test with Playwright + Chromium (developer tool, not needed to play):
     node tools/online-test.js
   Serves the game over http://localhost and replaces the Firebase SDK (gstatic) with a small fake,
   so the real js/online.js runs against controlled sign-in and Firestore behaviour.
   Nothing here talks to the real Firebase project. */
'use strict';
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
let pass = 0, fail = 0;
const ok = (c, n) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n); } };

/* The fake SDK. Behaviour is driven by window.__FAKE, which each test sets before acting.
   The signed-in user is kept in sessionStorage so a reload restores it, as the real SDK does. */
const FAKE_SDK = `(function () {
  var F = window.__FAKE = window.__FAKE || {};
  var KEY = 'fake_fb_user', cbs = [];
  function cur() { try { return JSON.parse(sessionStorage.getItem(KEY)); } catch (e) { return null; } }
  function fire() { var u = cur(); cbs.forEach(function (cb) { setTimeout(function () { cb(u); }, 0); }); }
  var auth = {
    get currentUser() { return cur(); },
    onAuthStateChanged: function (cb) { cbs.push(cb); setTimeout(function () { cb(cur()); }, 0); },
    signInWithPopup: function () {
      if (F.popupError) return Promise.reject({ code: F.popupError });
      sessionStorage.setItem(KEY, JSON.stringify({ uid: F.uid, email: 'must-not-be-used@example.com', displayName: 'Must Not Be Used' }));
      fire(); return Promise.resolve();
    },
    signOut: function () { sessionStorage.removeItem(KEY); fire(); return Promise.resolve(); }
  };
  function Provider() {} Provider.prototype.setCustomParameters = function () {};
  var authFn = function () { return auth; }; authFn.GoogleAuthProvider = Provider;
  var db = { collection: function (name) { return { doc: function (id) { return { get: function () {
    F.reads = (F.reads || []).concat(name + '/' + id);
    if (F.hang) return new Promise(function () {});
    if (F.getError) return Promise.reject({ code: F.getError });
    var d = (F.players || {})[id];
    if (!d) return Promise.reject({ code: 'permission-denied' });   /* what the real rules do for a non-player */
    return Promise.resolve({ exists: true, data: function () { return d; } });
  } }; } }; } };
  db.collection = (function (players) { return function (name) {
    if (name !== 'runs') return players(name);
    return { add: function (doc) {
      F.adds = (F.adds || 0) + 1;
      if (F.addHang) return new Promise(function () {});
      if (F.addError) return Promise.reject({ code: F.addError });
      F.runs = (F.runs || []).concat(JSON.parse(JSON.stringify(doc))); return Promise.resolve({ id: 'r' + F.runs.length });
    } };
  }; })(db.collection);
  var fsFn = function () { return db; }; fsFn.FieldValue = { serverTimestamp: function () { return '__SERVER_TIME__'; } };
  window.firebase = { initializeApp: function (c) { F.config = c; }, auth: authFn, firestore: fsFn };
})();`;

(async () => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]), file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(fs.readFileSync(file));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const BASE = 'http://localhost:' + server.address().port + '/';
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

  async function open(opts) {
    opts = opts || {};
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage(), errors = [], reqs = [];
    page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
    page.on('request', r => reqs.push(r.url()));
    await page.route('https://www.gstatic.com/**', route => {
      if (opts.sdkDown) return route.abort();
      route.fulfill({ contentType: 'text/javascript', body: /firebase-app-compat\.js$/.test(route.request().url()) ? FAKE_SDK : '' });
    });
    await page.route(u => !u.href.startsWith(BASE) && !u.href.startsWith('https://www.gstatic.com/'), route => route.abort());
    await page.addInitScript(f => { window.__FAKE = f; }, opts.fake || {});
    /* Gem scatter in js/sim.js draws from the cosmetic generator, which is seeded from Math.random.
       Fixing Math.random makes two pages comparable step for step. */
    if (opts.fixedRandom) await page.addInitScript(() => { let a = 1; Math.random = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x80000000; }; });
    await page.goto(BASE); await page.waitForTimeout(400);
    return { ctx, page, errors, reqs, ev: fn => page.evaluate(fn), wait: ms => page.waitForTimeout(ms), state: () => page.evaluate(() => PSO.Online.state) };
  }
  const PLAYERS = { 'uid-len': { nick: 'Len' }, 'uid-long': { nick: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' } };

  console.log('Hosted launch, signed out');
  let t = await open({ fake: { players: PLAYERS, uid: 'uid-len' } });
  ok(await t.state() === 'signedOut' && await t.ev(() => PSO.Online.available), 'http launch reaches signedOut with the SDK available');
  ok(await t.page.isVisible('text=Sign in with Google') && await t.page.isVisible('text=Play'), 'menu shows the sign-in button and the game menu');
  const sdk = t.reqs.filter(u => u.startsWith('https://www.gstatic.com/'));
  ok(sdk.length === 3 && sdk.every(u => u.indexOf('/firebasejs/12.19.0/firebase-') > 0 && /-compat\.js$/.test(u)), 'exactly three pinned compat scripts are requested (' + sdk.length + ')');
  ok(t.reqs.every(u => u.startsWith(BASE) || u.startsWith('https://www.gstatic.com/')), 'no other network requests');
  ok(await t.ev(() => !('databaseURL' in window.__FAKE.config) && window.__FAKE.config.projectId === 'bath-n-guess'), 'config has no Realtime Database URL');

  console.log('Sign in, allowed');
  await t.page.click('text=Sign in with Google'); await t.wait(200);
  ok(await t.state() === 'allowed' && await t.page.isVisible('text=Signed in as Len'), 'allowlisted account is signed in and named by nickname');
  ok(await t.ev(() => window.__FAKE.reads.join() === 'players/uid-len'), 'allowlist check reads only players/{own uid}');
  ok(await t.ev(() => JSON.stringify(PSO.Online).indexOf('example.com') < 0 && JSON.stringify(PSO.Online).indexOf('Must Not') < 0 && document.body.textContent.indexOf('Must Not') < 0), 'email and Google display name are never kept or shown');
  await t.page.reload(); await t.wait(400);
  ok(await t.state() === 'allowed' && await t.page.isVisible('text=Signed in as Len'), 'sign-in survives a reload');
  await t.page.click('text=Sign out'); await t.wait(200);
  ok(await t.state() === 'signedOut' && await t.page.isVisible('text=Sign in with Google'), 'sign out returns to signedOut');
  ok(t.errors.length === 0, 'no page errors' + (t.errors.length ? ': ' + t.errors[0] : ''));
  await t.ctx.close();

  console.log('Nickname cap');
  t = await open({ fake: { players: PLAYERS, uid: 'uid-long' } });
  await t.page.click('text=Sign in with Google'); await t.wait(200);
  ok(await t.ev(() => PSO.Online.nick) === 'ABCDEFGHIJKLMNOP', 'nickname display is capped at 16 characters');
  await t.ctx.close();

  console.log('Not on the list');
  t = await open({ fake: { players: PLAYERS, uid: 'uid-stranger' } });
  await t.page.click('text=Sign in with Google'); await t.wait(300);
  ok(await t.state() === 'notAllowed' && await t.page.isVisible('text=not on the player list'), 'non-allowlisted account is refused with a plain message');
  ok(await t.ev(() => sessionStorage.getItem('fake_fb_user') === null && PSO.Online.uid === ''), 'refused account is signed out again');
  ok(await t.page.isVisible('text=Sign in with Google'), 'another account can be tried');
  await t.ctx.close();

  console.log('Popup problems');
  t = await open({ fake: { players: PLAYERS, uid: 'uid-len', popupError: 'auth/popup-closed-by-user' } });
  await t.page.click('text=Sign in with Google'); await t.wait(200);
  ok(await t.state() === 'signedOut' && await t.page.isVisible('text=Sign-in was cancelled.'), 'closing the popup stays signed out with a message');
  await t.ev(() => { window.__FAKE.popupError = 'auth/popup-blocked'; });
  await t.page.click('text=Sign in with Google'); await t.wait(200);
  ok(await t.page.isVisible('text=blocked the sign-in window'), 'blocked popup explains what to do');
  await t.ev(() => { window.__FAKE.popupError = 'auth/network-request-failed'; });
  await t.page.click('text=Sign in with Google'); await t.wait(200);
  ok(await t.state() === 'error' && await t.page.isVisible('text=Leaderboards unavailable'), 'network failure during sign-in shows the error state');
  await t.ctx.close();

  console.log('Slow or failing server');
  t = await open({ fake: { players: PLAYERS, uid: 'uid-len', hang: true } });
  ok(await t.ev(() => PSO.DATA.ONLINE.timeoutMs) === 8000, 'timeout is 8 s by default');
  await t.ev(() => { PSO.DATA.ONLINE.timeoutMs = 300; });
  await t.page.click('text=Sign in with Google'); await t.wait(100);
  ok(await t.state() === 'checking', 'state is checking while the allowlist read is pending');
  await t.wait(500);
  ok(await t.state() === 'error' && await t.page.isVisible('text=did not answer in time'), 'a hung read times out into the error state');
  await t.ev(() => { window.__FAKE.hang = false; });
  await t.page.click('text=Try again'); await t.wait(200);
  ok(await t.state() === 'allowed', 'Try again recovers once the server answers');
  await t.ctx.close();
  t = await open({ fake: { players: PLAYERS, uid: 'uid-len', getError: 'unavailable' } });
  await t.page.click('text=Sign in with Google'); await t.wait(200);
  ok(await t.state() === 'error', 'a server error is an error, not a refusal');
  await t.ctx.close();

  console.log('SDK unreachable');
  t = await open({ sdkDown: true });
  ok(await t.state() === 'error' && !(await t.ev(() => PSO.Online.available)), 'SDK load failure gives the error state');
  ok(await t.page.isVisible('text=Leaderboards unavailable. The game still works.'), 'the menu says leaderboards are unavailable');
  await t.page.click('text=Play'); await t.wait(150); await t.page.fill('input.seed', 'ONLINE1'); await t.page.click('text=Start run'); await t.wait(400);
  ok(await t.ev(() => PSO.Game.R && PSO.Game.R.state === 'play' && PSO.Game.R.t > 0), 'the game is fully playable with Firebase unreachable');
  ok(t.errors.length === 0, 'no page errors' + (t.errors.length ? ': ' + t.errors[0] : ''));
  await t.ctx.close();

  /* Helpers that drive a real run without any debug hook, so the run stays eligible. */
  const start = async (x, seed) => { await x.page.click('text=Play'); await x.wait(150); await x.page.fill('input.seed', seed); await x.page.click('text=Start run'); await x.wait(300); };
  const die = x => x.ev(() => { const R = PSO.Game.R; R.revives = 0; R.player.iframes = 0; R.player.hp = 1; R.player.shield = 0; R.barrierReady = false; PSO.Sim.hurtPlayer(R, 1e9, null); });
  const win = x => x.ev(() => { const R = PSO.Game.R; if (R.state === 'levelup') { while (R.state === 'levelup') PSO.Game.pickUpgrade(0); } const e = PSO.Enemies.spawnBoss(R, 'hex', 1); PSO.Sim.dmgEnemy(R, e, 1e9, 'bolt', {}); });
  const runs = x => x.ev(() => window.__FAKE.runs || []);
  const signIn = async x => { await x.page.click('text=Sign in with Google'); await x.wait(200); };

  console.log('Submit at run end');
  t = await open({ fake: { players: PLAYERS, uid: 'uid-len' } });
  await signIn(t); await start(t, 'SUBMIT1'); await die(t); await t.wait(500);
  let rs = await runs(t);
  ok(rs.length === 1 && rs[0].uid === 'uid-len' && rs[0].ended === 'dead' && rs[0].board === 'std-normal' && rs[0].seed === 'SUBMIT1' && rs[0].gameVersion === '1.0.0' && rs[0].createdAt === '__SERVER_TIME__', 'a death submits one run with uid, board, seed, version and a server timestamp');
  ok(Number.isInteger(rs[0].score) && JSON.stringify(rs[0]).indexOf('example.com') < 0 && JSON.stringify(rs[0]).indexOf('Must Not') < 0, 'score is an integer; no email or Google name in the document');
  ok(await t.page.isVisible('text=Score sent to the leaderboard.') && await t.page.isVisible('.stat-k:has-text("Score")'), 'the summary shows the score and that it was sent');
  await t.page.click('text=Main menu'); await t.wait(150);
  ok((await runs(t)).length === 1, 'leaving the summary does not submit again');
  await start(t, 'SUBMIT2'); await t.page.keyboard.press('Escape'); await t.wait(200); await t.page.click('button:text-is("End run")'); await t.wait(100); await t.page.click('text=Yes, end run'); await t.wait(400);
  rs = await runs(t);
  ok(rs.length === 2 && rs[1].ended === 'quit', '"End run" from the pause menu submits');
  await t.page.click('text=Main menu'); await t.wait(150);

  console.log('Victory and endless: one document, at the final end');
  await start(t, 'SUBMIT3'); await win(t); await t.wait(500);
  ok(await t.page.isVisible('text=Keep going: endless mode') && (await runs(t)).length === 2, 'the victory screen does not submit yet');
  await t.page.click('text=Main menu'); await t.wait(300);
  rs = await runs(t);
  ok(rs.length === 3 && rs[2].ended === 'won' && rs[2].won === true && rs[2].board === 'std-normal', 'leaving the victory screen submits the win on the std board');
  await start(t, 'SUBMIT4'); await win(t); await t.wait(500); await t.page.click('text=Keep going: endless mode'); await t.wait(300); await die(t); await t.wait(500);
  rs = await runs(t);
  ok(rs.length === 4 && rs[3].board === 'endless-normal' && rs[3].ended === 'dead' && rs[3].won === true && rs[3].mode === 'endless', 'continuing then dying submits once, on the endless board');
  await t.page.click('text=Play again'); await t.wait(300);
  ok((await runs(t)).length === 4, 'starting the next run does not resubmit the last one');
  ok(t.errors.length === 0, 'no page errors' + (t.errors.length ? ': ' + t.errors[0] : ''));
  await t.ctx.close();

  console.log('Runs that must not be sent');
  t = await open({ fake: { players: PLAYERS, uid: 'uid-len' } });
  await start(t, 'NOSEND1'); await die(t); await t.wait(400);
  ok(await t.ev(() => !window.__FAKE.adds) && await t.ev(() => PSO.Online.queueLength()) === 0 && await t.page.isVisible('text=Not signed in: score not sent'), 'signed out: not sent, not queued, and the summary says so');
  await t.page.click('text=Main menu'); await t.wait(150); await signIn(t);
  await start(t, 'NOSEND2'); await t.ev(() => PSO.Game.debugFastForward(5)); await t.ev(() => { while (PSO.Game.R.state === 'levelup') PSO.Game.pickUpgrade(0); }); await die(t); await t.wait(400);
  ok(await t.ev(() => !window.__FAKE.adds) && await t.page.isVisible('text=Autoplayer or test run: score not sent.'), 'a run that used debugFastForward is never sent');
  await t.page.click('text=Main menu'); await t.wait(150);
  await start(t, 'NOSEND3'); await t.ev(() => { PSO.Perf.start(); PSO.Perf.stop(); }); await die(t); await t.wait(400);
  ok(await t.ev(() => !window.__FAKE.adds), 'a run that used PSO.Perf is never sent');
  await t.ctx.close();
  t = await open({ fake: { players: PLAYERS, uid: 'uid-len' } });
  await signIn(t); await t.ev(() => { PSO.Game.bot = true; }); await start(t, 'NOSEND4'); await t.wait(300); await t.ev(() => { PSO.Game.bot = false; }); await t.ev(() => { while (PSO.Game.R.state === 'levelup') PSO.Game.pickUpgrade(0); }); await die(t); await t.wait(400);
  ok(await t.ev(() => !window.__FAKE.adds && PSO.Game.R.tainted === true), 'a run started with the autoplayer is never sent, even if it is switched off later');
  await t.ctx.close();

  console.log('Failed submission: queue and retry');
  t = await open({ fake: { players: PLAYERS, uid: 'uid-len', addError: 'unavailable' } });
  await signIn(t); await start(t, 'QUEUE1'); await die(t); await t.wait(500);
  ok(await t.ev(() => PSO.Online.queueLength()) === 1 && await t.page.isVisible('text=will be sent after the next sign-in'), 'a failed send is queued on this PC with a visible message');
  await t.ev(() => { const q = JSON.parse(localStorage.getItem('pso_online_queue_v1')); q[0].gameVersion = '0.9.9'; q.push(Object.assign({}, q[0], { uid: 'uid-other', seed: 'OTHER' })); localStorage.setItem('pso_online_queue_v1', JSON.stringify(q)); });
  await t.ev(() => { window.__FAKE.addError = null; });
  await t.page.click('text=Main menu'); await t.wait(150); await t.page.click('text=Sign out'); await t.wait(200); await signIn(t); await t.wait(300);
  rs = await runs(t);
  ok(rs.length === 1 && rs[0].seed === 'QUEUE1' && rs[0].gameVersion === '0.9.9' && rs[0].createdAt === '__SERVER_TIME__', 'the queued run is sent after the next sign-in and keeps its own gameVersion');
  ok(await t.ev(() => { const q = JSON.parse(localStorage.getItem('pso_online_queue_v1')); return q.length === 1 && q[0].uid === 'uid-other'; }), 'another player\'s queued run waits for that player');
  await t.ev(() => { window.__FAKE.addError = 'permission-denied'; });
  await start(t, 'QUEUE2'); await die(t); await t.wait(500);
  ok(await t.ev(() => PSO.Online.queueLength()) === 1 && await t.page.isVisible('text=Could not send the score.'), 'a run refused by the server rules is not queued');
  await t.ev(() => { const q = []; for (let i = 0; i < 30; i++) q.push({ uid: 'uid-x', seed: 'S' + i }); localStorage.setItem('pso_online_queue_v1', JSON.stringify(q)); window.__FAKE.addError = 'unavailable'; });
  await t.page.click('text=Main menu'); await t.wait(150); await start(t, 'QUEUE3'); await die(t); await t.wait(500);
  ok(await t.ev(() => { const q = JSON.parse(localStorage.getItem('pso_online_queue_v1')); return q.length === 20 && q[19].seed === 'QUEUE3' && q[0].seed === 'S11'; }), 'the queue is capped at 20, dropping the oldest');
  await t.ctx.close();
  t = await open({ fake: { players: PLAYERS, uid: 'uid-len', addHang: true } });
  await signIn(t); await t.ev(() => { PSO.DATA.ONLINE.timeoutMs = 300; }); await start(t, 'QUEUE4'); await die(t); await t.wait(150);
  ok(await t.page.isVisible('text=Sending score...') && await t.page.isVisible('text=Play again'), 'the summary is usable while the send is pending');
  await t.wait(500);
  ok(await t.ev(() => PSO.Online.queueLength()) === 1, 'a send that hangs times out and is queued');
  await t.ctx.close();

  console.log('Simulation is unaffected by sign-in');
  const sim = async signedIn => {
    const x = await open({ fixedRandom: true, fake: { players: PLAYERS, uid: 'uid-len' } });
    if (signedIn) { await x.page.click('text=Sign in with Google'); await x.wait(200); }
    /* Step the real simulation directly at a fixed 1/60 s so frame timing cannot differ between the two pages. */
    const r = await x.ev(() => {
      const R = PSO.Sim.newRun({ char: 'rook', pets: ['zap'], spec: 'arsenal', arena: 'meadow', diff: 'normal', seed: 'SAMESEED' }, PSO.Save.data), inp = { mx: 0, my: 0, ability: false };
      for (let i = 0; i < 5400 && R.state !== 'dead'; i++) {
        if (R.state === 'play' && R.pending > 0) { PSO.Upgrades.offer(R); PSO.Upgrades.apply(R, PSO.Bot.pick(R)); continue; }
        PSO.Bot.think(R, inp); PSO.Sim.step(R, 1 / 60, inp);
      }
      return [PSO.Online.state, R.t.toFixed(3), R.kills, R.level, R.enemies.length, R.player.x.toFixed(3), R.player.y.toFixed(3)].join('|');
    });
    await x.ctx.close(); return r;
  };
  const a = await sim(false), b = await sim(true);
  ok(a.indexOf('signedOut|') === 0 && b.indexOf('allowed|') === 0 && a.slice(a.indexOf('|')) === b.slice(b.indexOf('|')), 'same seed gives the same simulation signed out and signed in (' + b + ')');

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close(); server.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
