/* Logic tests on the real simulation (no browser needed): node tools/logic-test.js [fullRuns=6]
   Checks upgrade offers, prerequisites, synergies, save validation and reward banking. */
'use strict';
var h = require('./headless.js'), PSO = h.PSO, D = PSO.DATA, Sim = PSO.Sim, Up = PSO.Upgrades, Save = PSO.Save;
var pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name); } }
function fresh() { localStorage.removeItem('pso_save_v1'); Save.load(); return Save.data; }
function mkRun(cfg) { return Sim.newRun(Object.assign({ char: 'rook', pets: ['zap', 'ember'], spec: 'arsenal', arena: 'meadow', diff: 'normal', seed: 'UNIT' }, cfg || {}), Save.data); }
function stepN(R, n) { var inp = { mx: 0, my: 0, ability: false }; for (var i = 0; i < n; i++) { if (R.pending > 0) R.pending = 0; Sim.step(R, 1 / 60, inp); } }
function putEnemy(R, type, dx, dy) { var e = PSO.Enemies.spawn(R, type, R.player.x + dx, R.player.y + dy); e.spawnT = 0; R.grid.clear(); R.enemies.forEach(function (x) { R.grid.insert(x); }); return e; }

var RUNS = Number(process.argv[2] || 6);   // full autoplayer runs for the offer check; each takes 15 to 50 seconds
console.log('Offers: prerequisites, duplicates, usability (' + RUNS + ' full runs, every offer checked)');
(function () {
  var offers = 0, bad = [];
  var cfgs = [['rook', 'zap,ember', 'arsenal'], ['rook', 'beetle,ember', 'swarm'], ['vex', 'zap,beetle', 'engineering'], ['moss', 'cog,frost', 'hybrid'], ['vex', 'magpip,frost', 'swarm']];
  for (var i = 0; i < RUNS; i++) {
    var c = cfgs[i % cfgs.length];
    PSO.Bot.rng = PSO.makeRng(500 + i); PSO.Bot.react = 0; PSO.Bot.noise = 0; PSO.Bot.hold = 0;
    h.runOnce({ char: c[0], pets: c[1].split(','), spec: c[2], arena: 'meadow', diff: 'normal', seed: 'OFFER' + i }, {
      maxMinutes: 14, save: function (s) { s.research.r_choice = 1; s.research.r_slot = 1; },
      onOffer: function (R) {
        offers++;
        var seen = {};
        R.offer.options.forEach(function (o) {
          if (seen[o.key]) bad.push('duplicate ' + o.key); seen[o.key] = 1;
          if (o.type === 'tech') {
            var n = D.TECH[o.id];
            if ((R.tech[o.id] || 0) >= n.max) bad.push('maxed tech offered ' + o.id);
            (n.req || []).forEach(function (r) { if (!(R.tech[r] > 0)) bad.push('prereq missing for ' + o.id); });
            if (n.reqAny && !n.reqAny.some(function (r) { return R.tech[r] > 0; })) bad.push('reqAny missing for ' + o.id);
            if (n.needsTag && !R.tags[n.needsTag]) bad.push('tag missing for ' + o.id);
          }
          if (o.type === 'weapon' && Sim.getWeapon(R, o.id).lvl >= D.BAL.weaponMaxLvl) bad.push('maxed weapon offered');
          if (o.type === 'newweapon' && (Sim.getWeapon(R, o.id) || R.weapons.length >= D.BAL.weaponSlots)) bad.push('bad new weapon');
          if (o.type === 'evolve' && !(R.tech[D.WEAPONS[o.id].evo.needs] > 0)) bad.push('evolve without key tech');
          if (o.type === 'pet' && Sim.getPet(R, o.id).lvl >= D.BAL.petMaxLvl) bad.push('maxed pet offered');
          if (o.type === 'syn' && (R.syn[o.id] || !Up.synMet(R, D.SYNERGIES[o.id]))) bad.push('bad synergy offered ' + o.id);
        });
        if (R.offer.options.length !== R.choices) bad.push('wrong option count');
      }
    });
  }
  ok(bad.length === 0, offers + ' offers checked, no illegal option' + (bad.length ? ' -> ' + bad.slice(0, 5).join('; ') : ''));
})();

console.log('Seeds');
(function () {
  fresh();
  var a = mkRun({ seed: 'SAME' }), b = mkRun({ seed: 'SAME' }), c = mkRun({ seed: 'OTHER' });
  var ka = [], kb = [], kc = [];
  [[a, ka], [b, kb], [c, kc]].forEach(function (p) { for (var i = 0; i < 6; i++) { p[0].pending = 1; Up.offer(p[0]); p[1].push(p[0].offer.options.map(function (o) { return o.key; }).join(',')); Up.apply(p[0], p[0].offer.options[0]); } });
  ok(ka.join('|') === kb.join('|'), 'same seed gives the same upgrade offers for the same choices');
  ok(ka.join('|') !== kc.join('|'), 'different seed gives different offers');
  stepN(a, 600); stepN(b, 600);
  ok(a.enemies.length === b.enemies.length && a.kills === b.kills && Math.abs(a.enemies[0].x - b.enemies[0].x) < 1e-9, 'same seed + same inputs + same time step reproduces spawns and combat exactly');
  var r = mkRun({ seed: 'RR' }); r.pending = 1; Up.offer(r); var before = r.offer.options.map(function (o) { return o.key; }), n0 = r.rerolls;
  Up.reroll(r); var after = r.offer.options.map(function (o) { return o.key; });
  ok(r.rerolls === n0 - 1 && after.every(function (k) { return before.indexOf(k) < 0; }), 'reroll spends one reroll and shows different options');
  r.rerolls = 0; ok(Up.reroll(r) === false, 'no reroll when none are left');
})();

console.log('Synergies and tech effects');
(function () {
  fresh();
  var R = mkRun(); stepN(R, 2);
  ok(Up.candidates(R).some(function (c) { return c.id === 'a_crit'; }), 'Keen Eye available once Sharpened is owned (Gunsmith start)');
  ok(!Up.candidates(R).some(function (c) { return c.id === 'a_volatile' || c.id === 'a_cap' || c.id === 's_mark'; }), 'deeper nodes hidden until prerequisites are owned');
  ok(!Up.candidates(R).some(function (c) { return c.type === 'syn' && c.id === 'x_signal'; }), 'Hunter\'s Signal not offered without a Crit source');
  R.tech.a_crit = 1; Sim.recalc(R);
  ok(Up.candidates(R).some(function (c) { return c.id === 'x_signal'; }), 'Hunter\'s Signal offered once Keen Eye is owned');
  ok(Math.abs(R.stats.critChance - 0.2) < 1e-9, 'Keen Eye sets crit chance to 20%');

  /* Pyro Salvo: burning enemy killed by a turret explodes */
  R = mkRun(); R.syn.x_pyro = true; var e = putEnemy(R, 'grub', 300, 0); Sim.burn(e, 5, 3);
  Sim.dmgEnemy(R, e, 999, 'turret', { weapon: true, kind: 'turret', noCrit: true });
  ok(e.dead && R.boomQ.some(function (b) { return b.src === 'pyro'; }), 'Pyro Salvo: burning enemy killed by a turret queues an explosion');
  var e2 = putEnemy(R, 'grub', 300, 0); Sim.burn(e2, 5, 3); R.boomQ.length = 0;
  Sim.dmgEnemy(R, e2, 999, 'bolt', { weapon: true, kind: 'bolt', noCrit: true });
  ok(!R.boomQ.some(function (b) { return b.src === 'pyro'; }), 'Pyro Salvo: does not trigger on a non-turret kill');

  /* Hunter's Signal: crit triggers pet strikes */
  R = mkRun(); R.syn.x_signal = true; R.stats.critChance = 1; e = putEnemy(R, 'brute', 200, 0);
  var z0 = R.dmgBy.zap || 0, em0 = R.dmgBy.ember || 0;
  Sim.dmgEnemy(R, e, 5, 'bolt', { weapon: true, kind: 'bolt' });
  R.pets.forEach(function (p) { p.cd = 99; });   // silence normal pet attacks so only the bonus strike can deal pet damage
  PSO.Pets.update(R, 1 / 60);
  ok((R.dmgBy.zap || 0) > z0 && (R.dmgBy.ember || 0) > em0, 'Hunter\'s Signal: a weapon crit makes both pets strike');

  /* Scrap Halo: pickups boost blades */
  R = mkRun(); R.syn.x_halo = true; Sim.collectGem(R, { v: 1 }); Sim.collectGem(R, { v: 1 });
  ok(R.haloStacks === 2 && R.haloT > 0, 'Scrap Halo: each gem adds a stack');

  /* Cryo Shatter: double explosion damage on slowed enemies */
  R = mkRun(); e = putEnemy(R, 'brute', 200, 0); e2 = putEnemy(R, 'brute', 200, 20); Sim.slow(e2, 0.5, 5); R.syn.x_cryo = true;
  var h1 = e.hp, h2 = e2.hp; Sim.explode(R, R.player.x + 200, R.player.y + 10, 80, 10, 'boom', {});
  ok(Math.abs((h2 - e2.hp) - 2 * (h1 - e.hp)) < 1e-6, 'Cryo Shatter: slowed enemy takes exactly double explosion damage');

  /* Live Wire */
  R = mkRun(); R.syn.x_wire = true; e = putEnemy(R, 'brute', 100, 0); R.turrets.push({ x: R.player.x + 120, y: R.player.y, life: 9, cd: 9, ang: 0, bonus: false, salv: 0 });
  Sim.chain(R, R.player.x, R.player.y, 10, 2, 'arc', { weapon: false });
  ok(Math.abs((R.dmgBy.wire || 0) - 3) < 1e-6, 'Live Wire: each turret copies chain lightning at 30% damage');

  /* Shared Target mark */
  R = mkRun(); R.tech.s_mark = 1; e = putEnemy(R, 'brute', 100, 0);
  Sim.dmgEnemy(R, e, 1, 'zap', { pet: true }); var hp0 = e.hp; Sim.dmgEnemy(R, e, 10, 'bolt', { noCrit: true });
  ok(Math.abs((hp0 - e.hp) - 12) < 1e-6, 'Shared Target: marked enemy takes +20% damage');

  /* Energy shield and barrier */
  R = mkRun({ pets: ['ember'] }); R.tech.e_shield = 1; Sim.recalc(R); R.player.shield = R.stats.shieldMax; hp0 = R.player.hp;
  Sim.hurtPlayer(R, 10, null); ok(R.player.hp === hp0 && R.player.shield === 15, 'Energy Shield absorbs damage before HP');
  R = mkRun({ pets: ['beetle'] }); R.barrierReady = true; hp0 = R.player.hp; Sim.hurtPlayer(R, 50, null);
  ok(R.player.hp === hp0 && !R.barrierReady, 'Bulwark Beetle barrier blocks a hit completely');

  /* Evolution gate */
  R = mkRun(); R.weapons[0].lvl = 5; Sim.recalc(R);
  ok(!Up.candidates(R).some(function (c) { return c.type === 'evolve'; }), 'no evolution offered without the key tech');
  R.tech.a_rapid = 1; Sim.recalc(R);
  ok(Up.candidates(R).some(function (c) { return c.type === 'evolve' && c.id === 'bolt'; }), 'evolution offered at level 5 with the key tech');
})();

console.log('Save validation and reward banking');
(function () {
  var s = fresh();
  ok(Save.importString('not json {').ok === false, 'invalid JSON is rejected');
  ok(Save.importString('[1,2,3]').ok === false, 'non-object JSON is rejected');
  ok(Save.importString(JSON.stringify({ game: 'other-game', version: 1 })).ok === false, 'a save from another game is rejected');
  ok(Save.importString(JSON.stringify({ game: 'pet-swarm-overdrive', version: 99 })).ok === false, 'a save from a newer version is rejected');
  ok(Save.data.sparks === 0 && Save.data === s, 'failed imports leave the current save untouched');
  var evil = { game: 'pet-swarm-overdrive', version: 1, sparks: -50, research: { r_vital: 999, hacked: 5 }, ach: { ach_win: true, fake: true }, settings: { master: 7, shake: 'yes' }, loadout: { char: 'nobody', pets: ['zap', 'zap', 'dragon'] }, bond: { zap: 'lots' } };
  var res = Save.importString(JSON.stringify(evil)), d = Save.data;
  ok(res.ok && d.sparks === 0 && d.research.r_vital === 3 && d.research.hacked === undefined && d.ach.fake === undefined && d.ach.ach_win === true && d.settings.master === 1 && d.settings.shake === true && d.loadout.char === 'rook' && d.loadout.pets.join() === 'zap' && d.bond.zap === 0,
    'out-of-range and unknown fields are clamped or dropped on import');
  var txt = Save.exportString(); Save.reset(); ok(Save.data.ach.ach_win === undefined && Save.data.sparks === 0, 'reset clears progress');
  ok(Save.importString(txt).ok && Save.data.ach.ach_win === true, 'export then import round-trips');

  fresh();
  var R = mkRun(); R.kills = 400; R.t = 300; R.level = 12; R.gemsGot = 260; R.maxTurrets = 0;
  var b1 = Save.bankRun(R), sp1 = Save.data.sparks;
  ok(b1.sparks === Math.floor(400 / D.BAL.sparks.perKills + 5 * D.BAL.sparks.perMin) && sp1 === b1.sparks, 'run banks Sparks from kills and minutes survived (' + b1.sparks + ')');
  var b2 = Save.bankRun(R);
  ok(b2.sparks === 0 && Save.data.sparks === sp1 && Save.data.life.runs === 1 && Save.data.life.kills === 400, 'banking the same run twice adds nothing');
  ok(b1.newAch.map(function (a) { return a.id; }).join() === 'ach_lvl10,ach_gems,ach_5min' && b2.newAch.length === 0, 'achievements unlock once: ' + b1.newAch.map(function (a) { return a.name; }).join(', '));
  R.kills = 800; R.t = 600; var b3 = Save.bankRun(R);
  ok(b3.sparks === Save.runSparks(R) - b1.sparks && Save.data.life.kills === 800, 'continuing the run (endless) banks only the difference');
  var stored = JSON.parse(localStorage.getItem('pso_save_v1')); Save.load();
  ok(stored.sparks === Save.data.sparks && Save.data.life.runs === 1, 'reload from storage gives identical totals');
  ok(Save.unlocked(D.CHARACTERS.vex) && !Save.unlocked(D.CHARACTERS.moss), 'unlocks follow achievements (Vex unlocked, Moss still locked)');
  var bond0 = Save.data.bond.zap; ok(bond0 === 1, 'pet bond equals pet level reached');
  var s0 = Save.data.sparks; ok(Save.buyResearch('r_magnet') && Save.data.sparks === s0 - 30 && Save.data.research.r_magnet === 1, 'research purchase spends Sparks once');
  Save.data.sparks = 1000;
  ok(Save.buyResearch('r_choice') === false && Save.buyResearch('r_reroll') === true && Save.buyResearch('r_choice') === true, 'research prerequisite enforced (Wider Horizons needs Second Guess)');
  Save.data.sparks = 0; ok(Save.buyResearch('r_vital') === false, 'cannot buy research without Sparks');
})();

console.log('Seeded replay');
(function () {
  function sig(seed) {
    fresh(); PSO.Bot.rng = PSO.makeRng(77); PSO.Bot.react = 0; PSO.Bot.noise = 0; PSO.Bot.hold = 0; PSO.Bot.last = { mx: 0, my: 0 };
    var R = h.runOnce({ char: 'rook', pets: ['zap', 'ember'], spec: 'arsenal', arena: 'meadow', diff: 'normal', seed: seed }, { maxMinutes: 3 }).R;
    return [R.t.toFixed(4), R.kills, R.level, R.gemsGot, R.enemies.length, R.player.x.toFixed(4), R.player.y.toFixed(4), Math.round(R.player.hp * 1000)].join('|');
  }
  var a = sig('REPLAY1'), b = sig('REPLAY1'), c = sig('REPLAY2');
  ok(a === b, 'same seed and same inputs give an identical run, whatever the cosmetic generator does (' + a + ')');
  ok(a !== c, 'a different seed gives a different run');
})();

console.log('Leaderboard score, boards, run summary');
(function () {
  fresh();
  var SC = D.BAL.score, En = PSO.Enemies;
  function at(t, kills, cfg) { var R = mkRun(cfg); R.t = t; R.kills = kills; return R; }
  function boss(R, type, hpMult, fight, killsDuring) { var e = En.spawnBoss(R, type, hpMult); R.t += fight; R.kills += killsDuring || 0; Sim.bossKilled(R, e); return e; }
  ok(D.gameVersion === '1.0.0' && typeof SC.perSecond === 'number', 'gameVersion and score weights live in data.js');
  ok(Sim.score(at(300, 5000)) === Math.round(300 * SC.perSecond + 5000 * SC.perKill), 'score = seconds and kills weighted, no bosses');
  ok(Sim.score(at(300, 5001)) > Sim.score(at(300, 5000)), 'same time, more kills scores higher');
  ok(Sim.score(at(301, 5000)) > Sim.score(at(300, 5000)), 'same kills, more time scores higher');
  var f = at(360, 8000), s = at(360, 8000); boss(f, 'gloop', 1, 20); boss(s, 'gloop', 1, 60); s.t = f.t = 500; 
  ok(Sim.score(f) > Sim.score(s) && f.bossFights[0] === 20, 'same time and kills, faster boss kill scores higher');
  var late = at(360, 8000); boss(late, 'gloop', 1, 500);
  ok(late.bossBonus === SC.bossBase, 'a boss kill slower than par still earns the base bonus, never less');
  var eb = En.spawnBoss(at(900, 1), 'gloop', 1 + D.BAL.endless.bossHpStep);
  ok(Math.abs(eb.par - SC.bossPar * 1.6) < 1e-9, 'endless boss par scales with its HP multiplier');

  /* Stalling the final boss: every extra second, with heavy farming, must never raise the score. */
  var prev = Infinity, mono = true, delays = [1, 5, 30, 60, 119, 120, 121, 300, 900];
  delays.forEach(function (d) { var R = at(720, 21000); boss(R, 'hex', 1, d, d * 500); var v = Sim.score(R); if (v > prev) mono = false; prev = v; });
  ok(mono, 'a faster final boss kill never scores lower, even farming 500 kills per second while stalling');
  var spawnOnly = at(720, 21000), stall = at(720, 21000); En.spawnBoss(spawnOnly, 'hex', 1); En.spawnBoss(stall, 'hex', 1); stall.t += 600; stall.kills += 99999;
  ok(Sim.score(stall) === Sim.score(spawnOnly), 'dying after stalling the final boss scores the same as at its spawn');
  var w = at(720, 21000); boss(w, 'hex', 1, 10, 300);
  ok(w.won && Sim.score(w) > Sim.score(stall), 'winning beats stalling and dying');
  var en = at(720, 21000); boss(en, 'hex', 1, 10, 300); var before = Sim.score(en); Sim.continueEndless(en); en.t += 60; en.kills += 1000;
  ok(Sim.score(en) === before + 60 * SC.perSecond + 1000 * SC.perKill, 'time and kills count again after continuing into endless');

  var hard = at(300, 5000, { diff: 'hard' }), old = SC.diffMult.hard; SC.diffMult.hard = 1.5;
  ok(Sim.score(hard) === Math.round((300 * SC.perSecond + 5000 * SC.perKill) * 1.5), 'difficulty multiplier scales the score');
  var ch = at(300, 5000, { challenge: 'ch_glass' }); SC.diffMult.normal = 3;
  ok(Sim.score(ch) === Math.round((300 * SC.perSecond + 5000 * SC.perKill) * SC.challengeMult), 'challenge runs ignore the difficulty multiplier');
  SC.diffMult.hard = old; SC.diffMult.normal = 1;

  ok(Sim.board(at(1, 1)) === 'std-normal' && Sim.board(at(1, 1, { diff: 'overdrive' })) === 'std-overdrive', 'standard runs go to std-<difficulty>');
  ok(Sim.board(w) === 'std-normal' && Sim.board(en) === 'endless-normal', 'a win stays on std; continuing past the win moves to endless');
  var chw = at(720, 100, { challenge: 'ch_horde' }); boss(chw, 'hex', 1, 10); Sim.continueEndless(chw);
  ok(Sim.board(chw) === 'chal-ch_horde', 'a challenge run stays on its challenge board either way');

  var sum = Sim.runSummary(en, 'dead'), rules = require('fs').readFileSync(require('path').join(__dirname, '..', 'firestore.rules'), 'utf8');
  var allowed = rules.slice(rules.indexOf('hasOnly('), rules.indexOf('hasAll(')).match(/'[A-Za-z]+'/g).map(function (x) { return x.replace(/'/g, ''); });
  ok(Object.keys(sum).every(function (k) { return allowed.indexOf(k) >= 0; }) && allowed.length === Object.keys(sum).length + 2, 'run summary fields match firestore.rules (uid and createdAt are added at send time)');
  ok(Number.isInteger(sum.score) && sum.mode === 'endless' && sum.ended === 'dead' && sum.won === true && sum.gameVersion === D.gameVersion && sum.seed === 'UNIT', 'run summary carries board, version, seed and an integer score');
  ok(JSON.stringify(sum).length < 1500 && Array.isArray(sum.build.weapons) && Array.isArray(sum.build.pets), 'run summary is small and lists the build by id');
})();

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
