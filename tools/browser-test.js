/* Real-browser test with Playwright + Chromium (developer tool, not needed to play):
     npm i playwright && node tools/browser-test.js
   Loads index.html from file://, blocks the network, and drives the real UI. */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os');
const URL_ = 'file://' + path.resolve(__dirname, '..', 'index.html');
let pass = 0, fail = 0;
const ok = (c, n) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n); } };

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
  await ctx.setOffline(true);                               // prove it needs no network
  const page = await ctx.newPage();
  const errors = [], reqs = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('request', r => reqs.push(r.url()));
  const ev = fn => page.evaluate(fn);
  const wait = ms => page.waitForTimeout(ms);
  const drain = () => ev(() => { const R = PSO.Game.R; let n = 0; while (R && R.state === 'levelup' && n++ < 50) PSO.Game.pickUpgrade(0); });

  console.log('Fresh launch (offline, file://)');
  await page.goto(URL_); await wait(400);
  ok(await page.isVisible('text=Play'), 'main menu appears');
  ok(reqs.every(u => u.startsWith('file://')), 'only local file requests (' + reqs.length + ' files, 0 network)');
  ok(await page.isVisible('text=Next unlock goal'), 'next unlock goal with progress is shown');
  ok(await ev(() => PSO.Online.state === 'offline' && PSO.Online.available === false) && !(await page.isVisible('text=Sign in with Google')), 'online layer is inert on file:// (no sign-in control)');
  await page.click('text=Play'); await wait(150);
  ok(await page.isVisible('text=Locked. Reach level 10 in one run.'), 'locked content shows its unlock condition');
  ok(await page.isVisible('text=Every 1.6s zaps the nearest enemy for 14 damage'), 'pet cards state exactly what the pet does');
  await page.click('text=View tech tree'); await wait(100);
  ok(await page.isVisible('text=Requires: Sharpened') || await page.isVisible('text=Requires: Sharpened + an Explosion source'), 'tech tree lists prerequisites');
  await page.click('text=Back'); await wait(100);
  await page.fill('input.seed', 'TESTSEED');
  await page.click('text=Start run'); await wait(300);

  console.log('Movement, tutorial, combat');
  const p0 = await ev(() => ({ x: PSO.Game.R.player.x, y: PSO.Game.R.player.y, seed: PSO.Game.R.seedStr, tut: PSO.Game.R.tut.step }));
  ok(p0.seed === 'TESTSEED', 'entered seed is used');
  await page.keyboard.down('KeyD'); await wait(700); await page.keyboard.up('KeyD');
  await page.keyboard.down('ArrowDown'); await wait(700); await page.keyboard.up('ArrowDown');
  const p1 = await ev(() => ({ x: PSO.Game.R.player.x, y: PSO.Game.R.player.y, tut: PSO.Game.R.tut.step }));
  ok(p1.x > p0.x + 80 && p1.y > p0.y + 80, 'WASD and arrow keys move the player');
  ok(p1.tut >= 1, 'tutorial advances after moving');
  await page.keyboard.press('Space'); await wait(100);
  ok(await ev(() => PSO.Game.R.abilityUses) === 1, 'Space triggers the ability');

  console.log('Pause and focus loss');
  await page.keyboard.press('Escape'); await wait(150);
  const tA = await ev(() => PSO.Game.R.t); await wait(500); const tB = await ev(() => PSO.Game.R.t);
  ok(await ev(() => PSO.Game.paused) && tA === tB && await page.isVisible('text=Paused'), 'Esc pauses and time stops');
  await page.keyboard.press('KeyP'); await wait(300);
  ok(!(await ev(() => PSO.Game.paused)) && await ev(() => PSO.Game.R.t) > tB, 'P resumes');
  await ev(() => window.dispatchEvent(new Event('blur'))); await wait(150);
  ok(await ev(() => PSO.Game.paused), 'window blur pauses automatically');
  await page.click('text=Resume'); await wait(100);
  await ev(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); Object.defineProperty(document, 'hidden', { value: false, configurable: true }); }); await wait(100);
  ok(await ev(() => PSO.Game.paused), 'hidden tab pauses automatically');
  await page.click('text=Settings'); await wait(100);
  await page.locator('input[aria-label="Master volume"]').fill('30'); await wait(50);
  ok(Math.abs(await ev(() => PSO.Save.data.settings.master) - 0.3) < 1e-9, 'volume slider changes the setting');
  ok(await ev(() => PSO.Audio.ok && PSO.Audio.ctx.state) === 'running', 'WebAudio context is running');
  await page.click('.row:has-text("Screen shake") button'); await page.click('.row:has-text("Damage numbers") button'); await page.click('.row:has-text("Low effects") button');
  const st = await ev(() => PSO.Save.data.settings);
  ok(st.shake === false && st.numbers === false && st.lowFx === true, 'shake, damage numbers and low-effects toggles work');
  await page.click('.row:has-text("Screen shake") button'); await page.click('.row:has-text("Damage numbers") button'); await page.click('.row:has-text("Low effects") button');
  await page.click('text=Back'); await page.click('text=Resume'); await wait(100);

  console.log('Level-up');
  await ev(() => { const R = PSO.Game.R; PSO.Sim.gainXp(R, R.xpNext); }); await wait(200);
  ok(await ev(() => PSO.Game.R.state) === 'levelup' && await page.isVisible('text=Pick an upgrade'), 'level-up pauses the game and shows choices');
  const tC = await ev(() => PSO.Game.R.t); await wait(300);
  ok(await ev(() => PSO.Game.R.t) === tC, 'gameplay is frozen during upgrade selection');
  const cards = await page.locator('.card.offer').count();
  ok(cards === 3, 'three upgrade cards shown');
  const rr0 = await ev(() => PSO.Game.R.rerolls); await page.keyboard.press('KeyR'); await wait(100);
  ok(await ev(() => PSO.Game.R.rerolls) === rr0 - 1, 'R rerolls the offer');
  await page.click('.card.offer >> nth=1'); await wait(150);
  ok(await ev(() => PSO.Game.R.picks.length) === 1 && await ev(() => PSO.Game.R.state) === 'play', 'clicking a card applies it and resumes');
  await ev(() => { const R = PSO.Game.R; PSO.Sim.gainXp(R, R.xpNext); }); await wait(200);
  await page.keyboard.press('Digit1'); await wait(150);
  ok(await ev(() => PSO.Game.R.picks.length) === 2, 'number key picks an upgrade');

  console.log('Death, summary, restart, save persistence');
  await ev(() => PSO.Game.debugFastForward(60)); await drain();
  await ev(() => { const R = PSO.Game.R; R.revives = 0; R.player.iframes = 0; PSO.Sim.hurtPlayer(R, 99999, null); }); await wait(300);
  ok(await page.isVisible('text=Defeated') && await page.isVisible('text=Damage dealt'), 'death shows the run summary with damage contributions');
  const sparks1 = await ev(() => PSO.Save.data.sparks);
  ok(sparks1 > 0, 'a failed run still awards Sparks (' + sparks1 + ')');
  ok(await ev(() => PSO.Save.data.tutorialDone), 'tutorial marked complete');
  await page.reload(); await wait(300);
  ok(await ev(() => PSO.Save.data.sparks) === sparks1 && await ev(() => PSO.Save.data.life.runs) === 1, 'reload keeps progress and does not duplicate rewards');
  await page.reload(); await wait(300);
  ok(await ev(() => PSO.Save.data.sparks) === sparks1, 'second reload: still identical');
  await page.click('text=Play'); await page.click('text=Start run'); await wait(300);
  ok(await ev(() => PSO.Game.R.state === 'play' && PSO.Game.R.t < 1 && PSO.Game.R.tut === null), 'a new run starts cleanly after a death');

  console.log('Victory and endless');
  /* The seed here is random, so two things vary from run to run: the autoplayer sometimes dies before 12:00,
     and a strong build can kill the Hex Engine within seconds of its spawn. So: boost the test player before
     fast-forwarding, never fast-forward past the spawn (go to 11:55, then creep forward in quarter-second
     steps), and stop the moment the final boss exists. */
  const finalBossUp = () => ev(() => !!(PSO.Game.R.boss && PSO.Game.R.boss.final));
  const boost = () => ev(() => { const R = PSO.Game.R; R.char = Object.assign({}, R.char, { hp: 100000 }); PSO.Sim.recalc(R); R.player.hp = R.stats.maxHp; });   // test-only: make sure we reach the final boss
  let runsExpected = 2;                                     // the earlier death, plus this run
  await boost();
  let ff = await ev(() => PSO.Game.debugFastForward(715)); await drain();
  if (ff.state === 'dead') { console.log('  (boosted autoplayer still died at ' + ff.t.toFixed(0) + 's; restarting)'); await page.click('text=Play again'); await wait(200); await boost(); runsExpected = 3; }
  for (let i = 0; i < 60 && !(await finalBossUp()); i++) {
    await ev(() => { const R = PSO.Game.R; if (R.state === 'play' || R.state === 'levelup') PSO.Game.debugFastForward(R.t < 719 ? 719 - R.t : 0.25); });
    await drain();
  }
  ok(await ev(() => !!(PSO.Game.R.boss && PSO.Game.R.boss.final)), 'final boss (Hex Engine) spawns at 12:00');
  ok(await ev(() => PSO.Game.R.bossesDefeated.indexOf('gloop') >= 0), 'first boss (Gloop King) was fought and defeated on the way');
  await ev(() => { const R = PSO.Game.R; if (R.boss) PSO.Sim.dmgEnemy(R, R.boss, 1e9, 'bolt', {}); }); await wait(400);
  ok(await page.isVisible('text=Victory!') && await page.isVisible('text=Keep going: endless mode'), 'victory summary with endless option');
  const sparksWin = await ev(() => PSO.Save.data.sparks);
  ok(await ev(() => PSO.Save.data.ach.ach_win === true && PSO.Save.data.life.wins === 1), 'win recorded, achievement unlocked');
  await page.click('text=Keep going: endless mode'); await wait(400);
  ok(await ev(() => { const R = PSO.Game.R; return R.endless && (R.state === 'play' || R.state === 'levelup'); }), 'endless continuation resumes play');
  await ev(() => PSO.Game.debugFastForward(20)); await drain();
  await ev(() => { const R = PSO.Game.R; R.revives = 0; R.player.iframes = 0; R.player.hp = 1; R.stats.dmgTaken = 1; R.player.shield = 0; R.barrierReady = false; PSO.Sim.hurtPlayer(R, 1e9, null); }); await wait(400);
  ok(await page.isVisible('text=Endless run over'), 'dying in endless shows the final summary');
  const sparksEnd = await ev(() => PSO.Save.data.sparks);
  ok(sparksEnd >= sparksWin && sparksEnd - sparksWin < 40 && await page.evaluate(n => PSO.Save.data.life.wins === 1 && PSO.Save.data.life.runs === n, runsExpected), 'endless banks only the extra progress (+' + (sparksEnd - sparksWin) + '), win not counted twice');
  await page.click('text=Main menu'); await wait(200);

  console.log('Research, export, import, invalid import, reset');
  await page.click('text=Research'); await wait(100);
  await page.click('.card:has-text("Magnetism") button'); await wait(100);
  ok(await ev(() => PSO.Save.data.research.r_magnet) === 1 && await ev(() => PSO.Save.data.sparks) === sparksEnd - 30, 'research can be bought with Sparks');
  await page.click('text=Back'); await page.click('text=Settings'); await wait(100);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('text=Export save to file')]);
  const file = path.join(os.tmpdir(), 'pso-export.json'); await dl.saveAs(file);
  const exported = JSON.parse(fs.readFileSync(file, 'utf8'));
  ok(exported.game === 'pet-swarm-overdrive' && exported.sparks === sparksEnd - 30, 'export downloads a valid JSON save');
  const bad = path.join(os.tmpdir(), 'pso-bad.json'); fs.writeFileSync(bad, '{ "hello": "this is not a save" }');
  await page.setInputFiles('input[type=file]', bad); await wait(200);
  ok(await page.isVisible('text=Import failed') && await ev(() => PSO.Save.data.sparks) === sparksEnd - 30, 'invalid file shows a visible error and changes nothing');
  const junk = path.join(os.tmpdir(), 'pso-junk.json'); fs.writeFileSync(junk, 'garbage!!');
  await page.setInputFiles('input[type=file]', junk); await wait(200);
  ok(await page.isVisible('text=not valid JSON'), 'non-JSON file shows a visible error');
  await page.click('text=Reset save'); await wait(100);
  ok(await page.isVisible('text=Erase ALL progress'), 'reset asks for confirmation first');
  await page.click('text=Keep my save'); await wait(100);
  ok(await ev(() => PSO.Save.data.sparks) === sparksEnd - 30, 'cancelling the reset keeps the save');
  await page.click('text=Reset save'); await page.click('text=Yes, erase everything'); await wait(150);
  ok(await ev(() => PSO.Save.data.sparks === 0 && PSO.Save.data.life.runs === 0 && !PSO.Save.data.ach.ach_win), 'confirmed reset erases progress');
  await page.setInputFiles('input[type=file]', file); await wait(200);
  ok(await ev(() => PSO.Save.data.sparks) === sparksEnd - 30 && await ev(() => PSO.Save.data.ach.ach_win === true), 'importing the exported file restores progress');
  await page.reload(); await wait(300);
  ok(await ev(() => PSO.Save.data.sparks) === sparksEnd - 30, 'imported save persists across reload');

  ok(errors.length === 0, 'no console errors or exceptions during the whole session' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  ok(reqs.every(u => u.startsWith('file://') || u.startsWith('blob:')), 'no network requests at any point');
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
