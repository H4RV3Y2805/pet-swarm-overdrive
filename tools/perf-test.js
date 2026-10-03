/* Frame-time measurement in real Chromium (developer tool): node tools/perf-test.js
   Fast-forwards a run with the autoplayer to late game, then renders normally and records frames. */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const W = Number(process.argv[2] || 1920), H = Number(process.argv[3] || 1080), flags = process.argv.slice(4);
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  console.log('Viewport', W + 'x' + H, 'flags', flags.join(' ') || '(none)');
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html') + '#bot');
  console.log('UA:', await page.evaluate(() => navigator.userAgent));
  console.log('Renderer:', await page.evaluate(() => { try { const g = document.createElement('canvas').getContext('webgl'); const e = g.getExtension('WEBGL_debug_renderer_info'); return g.getParameter(e.UNMASKED_RENDERER_WEBGL); } catch (x) { return 'unknown'; } }), '| cores:', await page.evaluate(() => navigator.hardwareConcurrency));
  await page.click('text=Play'); await page.click('text=Start run'); await page.waitForTimeout(300);
  await page.evaluate(() => { const R = PSO.Game.R; R.char = Object.assign({}, R.char, { hp: 100000 }); PSO.Sim.recalc(R); R.player.hp = R.stats.maxHp; });  // keep the bot alive for measuring
  const measure = async (label, secs, lowFx) => {
    await page.evaluate(l => { PSO.settings.lowFx = l; PSO.settings.numbers = true; PSO.settings.shake = true; PSO.Render.resize(); }, lowFx);
    await page.waitForTimeout(800);
    await page.evaluate(() => PSO.Perf.start());
    await page.waitForTimeout(secs * 1000);
    const r = await page.evaluate(() => PSO.Perf.stop());
    if (!r) { console.log(label, 'no frames'); return; }
    console.log(label.padEnd(44), 'fps ' + r.avgFps.toFixed(1), '| frame ms median ' + r.medianMs.toFixed(1) + ' p95 ' + r.p95Ms.toFixed(1) + ' p99 ' + r.p99Ms.toFixed(1) + ' worst ' + r.worstMs.toFixed(1),
      '| sim ' + r.avgSimMs.toFixed(2) + ' ms draw ' + r.avgDrawMs.toFixed(2) + ' ms', '| enemies avg ' + r.avgEnemies.toFixed(0) + ' max ' + r.maxEnemies, '| shots+particles avg ' + r.avgShotsParticles.toFixed(0), '| frames ' + r.frames);
  };
  const ff = async s => { const r = await page.evaluate(x => PSO.Game.debugFastForward(x), s); await page.evaluate(() => { const R = PSO.Game.R; let n = 0; while (R.state === 'levelup' && n++ < 50) PSO.Game.pickUpgrade(0); }); return r; };
  await ff(240); await measure('4:00 mid run', 12, false);
  await ff(660 - 255); await measure('11:00 late run, full effects', 20, false);
  await page.screenshot({ path: '/tmp/shots/perf-late.png' });
  await measure('11:30 late run, low effects', 15, true);
  /* Worst case: fill the arena to the enemy cap around the player. */
  await page.evaluate(() => { const R = PSO.Game.R, rng = PSO.fxRng; while (R.enemies.length < PSO.DATA.BAL.enemyCap) { const a = rng.next() * 6.283, d = 150 + rng.next() * 500; const e = PSO.Enemies.spawn(R, rng.next() < 0.7 ? 'grub' : 'skitter', R.player.x + Math.cos(a) * d, R.player.y + Math.sin(a) * d); e.hp = e.maxHp = 1e7; } });
  await measure('stress: 520 unkillable enemies around player', 10, false);
  await page.screenshot({ path: '/tmp/shots/perf-stress.png' });
  await measure('stress: same, low effects', 10, true);
  await page.screenshot({ path: '/tmp/shots/perf-stress.png' });
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('CRASH', e); process.exit(2); });
