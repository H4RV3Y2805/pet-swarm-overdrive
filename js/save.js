/* Pet Swarm: Overdrive - persistent save: localStorage, JSON export/import with validation,
   reset, and run-reward banking that cannot be applied twice. */
(function () {
  'use strict';
  var PSO = window.PSO, D = PSO.DATA;
  var KEY = 'pso_save_v1', GAME = 'pet-swarm-overdrive', VERSION = 1;
  var Save = PSO.Save = { data: null, storageOk: true, lastError: '' };

  function defaults() {
    return {
      game: GAME, version: VERSION,
      sparks: 0, sparksEarned: 0,
      research: {}, ach: {}, flags: {}, bond: {}, variant: {}, challenges: {},
      best: { level: 0, gems: 0, time: 0, turrets: 0 },
      life: { kills: 0, runs: 0, wins: 0, gems: 0, bosses: 0, time: 0 },
      settings: { master: 0.8, sfx: 0.8, music: 0.35, shake: true, numbers: true, lowFx: false, fps: false },
      tutorialDone: false,
      loadout: { char: 'rook', pets: ['zap', 'ember'], spec: 'arsenal', arena: 'meadow', diff: 'normal' }
    };
  }

  function num(v, def, lo, hi) {
    if (typeof v !== 'number' || !isFinite(v)) return def;
    if (lo !== undefined && v < lo) v = lo;
    if (hi !== undefined && v > hi) v = hi;
    return v;
  }
  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }

  /* Build a clean save from untrusted input. Throws Error with a readable message if it is not a save. */
  function sanitize(raw) {
    if (!isObj(raw)) throw new Error('This file is not a Pet Swarm save (expected a JSON object).');
    if (raw.game !== GAME) throw new Error('This file is not a Pet Swarm: Overdrive save.');
    if (typeof raw.version !== 'number' || raw.version < 1) throw new Error('The save has no valid version number.');
    if (raw.version > VERSION) throw new Error('This save comes from a newer version of the game.');
    var s = defaults(), k, i;
    s.sparks = Math.floor(num(raw.sparks, 0, 0, 1e9));
    s.sparksEarned = Math.floor(num(raw.sparksEarned, s.sparks, 0, 1e9));
    if (isObj(raw.research)) for (k in D.RESEARCH) s.research[k] = Math.floor(num(raw.research[k], 0, 0, D.RESEARCH[k].max));
    if (isObj(raw.ach)) for (i = 0; i < D.ACHIEVEMENTS.length; i++) { k = D.ACHIEVEMENTS[i].id; if (raw.ach[k] === true) s.ach[k] = true; }
    if (isObj(raw.flags)) for (k in raw.flags) if (/^[a-zA-Z_]{1,24}$/.test(k) && raw.flags[k] === true) s.flags[k] = true;
    if (isObj(raw.bond)) for (k in D.PETS) s.bond[k] = Math.floor(num(raw.bond[k], 0, 0, 1e6));
    if (isObj(raw.variant)) for (k in D.PETS) if (raw.variant[k] === 'A' || raw.variant[k] === 'B') s.variant[k] = raw.variant[k];
    if (isObj(raw.challenges)) for (k in D.CHALLENGES) if (raw.challenges[k] === true) s.challenges[k] = true;
    if (isObj(raw.best)) for (k in s.best) s.best[k] = num(raw.best[k], 0, 0, 1e9);
    if (isObj(raw.life)) for (k in s.life) s.life[k] = num(raw.life[k], 0, 0, 1e12);
    if (isObj(raw.settings)) {
      var st = raw.settings;
      s.settings.master = num(st.master, 0.8, 0, 1); s.settings.sfx = num(st.sfx, 0.8, 0, 1); s.settings.music = num(st.music, 0.35, 0, 1);
      ['shake', 'numbers', 'lowFx', 'fps'].forEach(function (b) { if (typeof st[b] === 'boolean') s.settings[b] = st[b]; });
    }
    s.tutorialDone = raw.tutorialDone === true;
    if (isObj(raw.loadout)) {
      var lo = raw.loadout;
      if (D.CHARACTERS[lo.char]) s.loadout.char = lo.char;
      if (Array.isArray(lo.pets)) s.loadout.pets = lo.pets.filter(function (p, idx) { return D.PETS[p] && lo.pets.indexOf(p) === idx; }).slice(0, 3);
      if (D.SPECS[lo.spec]) s.loadout.spec = lo.spec;
      if (D.ARENAS[lo.arena]) s.loadout.arena = lo.arena;
      if (D.DIFFS[lo.diff]) s.loadout.diff = lo.diff;
    }
    return s;
  }

  Save.load = function () {
    var raw = null;
    try { raw = window.localStorage.getItem(KEY); } catch (e) { Save.storageOk = false; }
    if (raw) {
      try { Save.data = sanitize(JSON.parse(raw)); return; }
      catch (e2) { Save.lastError = 'Stored save was unreadable and has been replaced: ' + e2.message; }
    }
    Save.data = defaults();
  };

  Save.persist = function () {
    try { window.localStorage.setItem(KEY, JSON.stringify(Save.data)); Save.storageOk = true; return true; }
    catch (e) { Save.storageOk = false; return false; }
  };

  Save.exportString = function () { return JSON.stringify(Save.data, null, 2); };

  /* Returns {ok:true} or {ok:false,error:'...'}; the current save is untouched on failure. */
  Save.importString = function (text) {
    var parsed;
    try { parsed = JSON.parse(text); } catch (e) { return { ok: false, error: 'That file is not valid JSON, so nothing was imported.' }; }
    try { Save.data = sanitize(parsed); } catch (e2) { return { ok: false, error: e2.message + ' Nothing was imported.' }; }
    Save.persist();
    return { ok: true };
  };

  Save.reset = function () { Save.data = defaults(); Save.persist(); };

  Save.unlocked = function (def) { return !def.unlock || Save.data.ach[def.unlock] === true; };
  Save.petSlots = function () { return 2 + (Save.data.research.r_slot ? 1 : 0); };
  Save.variantUnlocked = function (petId) { return (Save.data.bond[petId] || 0) >= D.BAL.bondForVariant; };

  Save.achProgress = function (a) {
    var s = Save.data, cur;
    if (a.scope === 'run') cur = s.best[a.stat === 'gems' ? 'gems' : a.stat] || 0;
    else if (a.scope === 'life') cur = s.life[a.stat] || 0;
    else cur = s.flags[a.stat] ? 1 : 0;
    return { cur: Math.min(cur, a.goal), goal: a.goal, done: s.ach[a.id] === true };
  };
  Save.nextGoal = function () {
    for (var i = 0; i < D.ACHIEVEMENTS.length; i++) if (!Save.data.ach[D.ACHIEVEMENTS[i].id]) return D.ACHIEVEMENTS[i];
    return null;
  };

  Save.buyResearch = function (id) {
    var def = D.RESEARCH[id], s = Save.data, rank = s.research[id] || 0;
    if (!def || rank >= def.max) return false;
    if (def.req && !(s.research[def.req] > 0)) return false;
    var cost = def.cost[rank];
    if (s.sparks < cost) return false;
    s.sparks -= cost; s.research[id] = rank + 1;
    Save.persist();
    return true;
  };

  /* Sparks a run is worth so far (deterministic from run stats). */
  Save.runSparks = function (R) {
    var B = D.BAL.sparks;
    var base = R.kills / B.perKills + (R.t / 60) * B.perMin + R.bossKills * B.perBoss + (R.won ? B.win : 0) + R.bonusSparks;
    return Math.floor(base * R.diff.sparks);
  };

  /* Bank the run's progress into the save. Safe to call repeatedly: only the difference since the
     previous bank of THIS run object is applied, and a run object never survives a page reload. */
  Save.bankRun = function (R) {
    var s = Save.data, b = R.bank, out = { sparks: 0, challenge: 0, newAch: [], newVariants: [] }, i, k;
    var total = Save.runSparks(R);
    out.sparks = Math.max(0, total - b.sparks); b.sparks = total;
    if (R.won && R.challenge && !b.challenge && !s.challenges[R.challenge]) {
      s.challenges[R.challenge] = true; out.challenge = D.CHALLENGES[R.challenge].reward;
    }
    if (R.won) b.challenge = true;
    s.sparks += out.sparks + out.challenge; s.sparksEarned += out.sparks + out.challenge;

    s.life.kills += R.kills - b.kills; b.kills = R.kills;
    s.life.gems += R.gemsGot - b.gems; b.gems = R.gemsGot;
    s.life.bosses += R.bossKills - b.bosses; b.bosses = R.bossKills;
    s.life.time += R.t - b.time; b.time = R.t;
    if (!b.run) { s.life.runs++; b.run = true; }
    if (R.won && !b.win) { s.life.wins++; b.win = true; }

    s.best.level = Math.max(s.best.level, R.level);
    s.best.gems = Math.max(s.best.gems, R.gemsGot);
    s.best.time = Math.max(s.best.time, Math.floor(R.t));
    s.best.turrets = Math.max(s.best.turrets, R.maxTurrets);

    for (i = 0; i < R.bossesDefeated.length; i++) s.flags['boss_' + R.bossesDefeated[i]] = true;
    if (R.synCount > 0) s.flags.synergy = true;
    if (R.evolved > 0) s.flags.evolve = true;
    if (R.won) { s.flags.win = true; if (R.diffId !== 'normal') s.flags.winHard = true; }

    /* Pet bond: each equipped pet earns its final level, once (plus later level gains in endless). */
    for (i = 0; i < R.pets.length; i++) {
      k = R.pets[i].id;
      var had = Save.variantUnlocked(k), prev = b.bond[k] || 0;
      s.bond[k] = (s.bond[k] || 0) + (R.pets[i].lvl - prev); b.bond[k] = R.pets[i].lvl;
      if (!had && Save.variantUnlocked(k)) out.newVariants.push(k);
    }

    for (i = 0; i < D.ACHIEVEMENTS.length; i++) {
      var a = D.ACHIEVEMENTS[i];
      if (s.ach[a.id]) continue;
      var p = Save.achProgress(a);
      if (p.cur >= a.goal) { s.ach[a.id] = true; out.newAch.push(a); }
    }
    Save.persist();
    return out;
  };

  Save._sanitize = sanitize;
  Save._defaults = defaults;
})();
