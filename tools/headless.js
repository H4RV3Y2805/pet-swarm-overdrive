/* Headless simulation test: node tools/headless.js [char] [pets,comma] [spec] [arena] [diff] [seed] [endlessMinutes]
   Runs the real game simulation (no rendering) with the autoplayer and prints results. */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');
global.window = global;
var store = {};
global.localStorage = { getItem: function (k) { return store[k] || null; }, setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; } };
['rng', 'data', 'save', 'sim', 'enemies', 'weapons', 'pets', 'upgrades', 'bot'].forEach(function (f) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), { filename: f + '.js' });
});
var PSO = global.PSO;
PSO.settings = { lowFx: false, numbers: true, shake: true };

function runOnce(cfg, opts) {
  opts = opts || {};
  PSO.Save.load();
  if (opts.save) opts.save(PSO.Save.data);
  var R = PSO.Sim.newRun(cfg, PSO.Save.data), inp = { mx: 0, my: 0, ability: false }, dt = 1 / 60;
  var peak = 0, steps = 0, tTotal = 0, tMax = 0, peakShots = 0, limit = (opts.maxMinutes || 40) * 60, endlessUntil = opts.endless ? 720 + opts.endless * 60 : 0;
  var hpLog = [], lvlLog = [];
  while (R.t < limit) {
    if (R.state === 'play' && R.pending > 0) { PSO.Upgrades.offer(R); if (opts.onOffer) opts.onOffer(R); PSO.Upgrades.apply(R, PSO.Bot.pick(R)); continue; }
    if (R.state === 'dead') break;
    if (R.state === 'won') { if (endlessUntil) PSO.Sim.continueEndless(R); else break; }
    if (endlessUntil && R.endless && R.t > endlessUntil) break;
    if (opts.afk) { inp.mx = 0; inp.my = 0; inp.ability = false; } else PSO.Bot.think(R, inp);
    var t0 = process.hrtime.bigint();
    PSO.Sim.step(R, dt, inp);
    var ms = Number(process.hrtime.bigint() - t0) / 1e6;
    tTotal += ms; if (ms > tMax) tMax = ms; steps++;
    if (R.enemies.length > peak) peak = R.enemies.length;
    if (R.shots.length > peakShots) peakShots = R.shots.length;
    if (steps % 3600 === 0) { hpLog.push(Math.round(R.player.hp)); lvlLog.push(R.level + '/' + R.enemies.length + '/' + R.kills); }
  }
  return { R: R, peak: peak, avgMs: tTotal / steps, maxMs: tMax, hpLog: hpLog, lvlLog: lvlLog, peakShots: peakShots };
}
module.exports = { runOnce: runOnce, PSO: PSO };

if (require.main === module) {
  var a = process.argv.slice(2);
  var cfg = { char: a[0] || 'rook', pets: (a[1] || 'zap,ember').split(','), spec: a[2] || 'arsenal', arena: a[3] || 'meadow', diff: a[4] || 'normal', seed: a[5] || 'TEST01' };
  var res = runOnce(cfg, { endless: Number(a[6] || 0) }), R = res.R;
  var mm = Math.floor(R.t / 60), ss = Math.floor(R.t % 60);
  console.log('Result:', R.state, 'won=' + R.won, 'time ' + mm + ':' + (ss < 10 ? '0' : '') + ss, 'level', R.level, 'kills', R.kills, 'bosses', R.bossKills);
  console.log('Peak enemies', res.peak, '| peak shots', res.peakShots, '| sim step avg', res.avgMs.toFixed(3), 'ms, max', res.maxMs.toFixed(2), 'ms');
  console.log('Per minute level/enemies/kills:', res.lvlLog.join(' '));
  console.log('HP per minute:', res.hpLog.join(' '));
  console.log('Weapons:', R.weapons.map(function (w) { return w.id + w.lvl + (w.evolved ? '*' : ''); }).join(' '), '| Pets:', R.pets.map(function (p) { return p.id + p.variant + p.lvl; }).join(' '));
  console.log('Tech:', JSON.stringify(R.tech), 'Syn:', Object.keys(R.syn).join(','));
  var dmg = Object.keys(R.dmgBy).sort(function (x, y) { return R.dmgBy[y] - R.dmgBy[x]; }).map(function (k) { return k + ':' + Math.round(R.dmgBy[k]); });
  console.log('Damage:', dmg.join(' '));
  console.log('Sparks:', PSO.Save.runSparks(R));
}
