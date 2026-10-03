/* Pet Swarm: Overdrive - core simulation (no DOM access, so it also runs headless for tests).
   A run is a plain object R. Everything is delta-time based. */
(function () {
  'use strict';
  var PSO = window.PSO, D = PSO.DATA, BAL = D.BAL;
  var Sim = PSO.Sim = {};
  var fx = PSO.fxRng;
  var QX = [], QN = [], QC = [], QD = [];
  var NOOPT = {};

  function sfx(n) { if (PSO.Audio) PSO.Audio.play(n); }
  function lowFx() { return PSO.settings && PSO.settings.lowFx; }
  Sim.sfx = sfx;

  /* ---------- Spatial hash grid for "who is near this point" queries ---------- */
  var PAD = 56;   // largest enemy radius, so centre-based buckets still find big enemies
  function Grid(w, h, cs) {
    this.cs = cs; this.cols = Math.ceil(w / cs) + 1; this.rows = Math.ceil(h / cs) + 1;
    this.cells = [];
    for (var i = 0; i < this.cols * this.rows; i++) this.cells.push([]);
  }
  Grid.prototype.clear = function () { for (var i = 0; i < this.cells.length; i++) this.cells[i].length = 0; };
  Grid.prototype.insert = function (e) {
    var cx = (e.x / this.cs) | 0, cy = (e.y / this.cs) | 0;
    if (cx < 0) cx = 0; else if (cx >= this.cols) cx = this.cols - 1;
    if (cy < 0) cy = 0; else if (cy >= this.rows) cy = this.rows - 1;
    e.cell = cy * this.cols + cx;
    this.cells[e.cell].push(e);
  };
  /* Fills out[] with live enemies whose body overlaps the circle (x,y,r). */
  Grid.prototype.query = function (x, y, r, out) {
    out.length = 0;
    var cs = this.cs, x0 = ((x - r - PAD) / cs) | 0, x1 = ((x + r + PAD) / cs) | 0, y0 = ((y - r - PAD) / cs) | 0, y1 = ((y + r + PAD) / cs) | 0;
    if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 >= this.cols) x1 = this.cols - 1; if (y1 >= this.rows) y1 = this.rows - 1;
    for (var cy = y0; cy <= y1; cy++) for (var cx = x0; cx <= x1; cx++) {
      var c = this.cells[cy * this.cols + cx];
      for (var i = 0; i < c.length; i++) {
        var e = c[i];
        if (e.dead) continue;
        var dx = e.x - x, dy = e.y - y, rr = r + e.r;
        if (dx * dx + dy * dy <= rr * rr) out.push(e);
      }
    }
    return out;
  };
  Sim.Grid = Grid;

  function xpFor(level) { return Math.floor(BAL.xp.base + BAL.xp.lin * level + BAL.xp.powMul * Math.pow(level, BAL.xp.pow)); }
  Sim.xpFor = xpFor;
  function tr(R, id) { return R.tech[id] || 0; }

  /* ---------- Run creation ---------- */
  Sim.newRun = function (cfg, save) {
    var chal = cfg.challenge ? D.CHALLENGES[cfg.challenge] : null;
    var seedStr = String(chal ? chal.seed : (cfg.seed || PSO.randomSeedString())).slice(0, 24);
    var arenaId = chal ? chal.arena : cfg.arena, diffId = chal ? chal.diff : cfg.diff;
    var base = PSO.hashSeed(seedStr + '|' + arenaId + '|' + diffId);
    var arena = D.ARENAS[arenaId], ch = D.CHARACTERS[cfg.char], spec = D.SPECS[cfg.spec];
    var mods = { dmgMult: 1, hpMult: 1, petDmgMult: 1, petRate: 1, rate: 1, xpMult: 1, noWeapons: false }, k, i;
    if (chal) for (k in chal.mods) mods[k] = chal.mods[k];
    var res = {};
    for (k in D.RESEARCH) res[k] = (save.research && save.research[k]) || 0;
    var ach = save.ach || {};
    var R = {
      id: Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
      cfg: cfg, seedStr: seedStr, challenge: cfg.challenge || null,
      rngSpawn: PSO.makeRng(base ^ 0x9e3779b9), rngOffer: PSO.makeRng(base ^ 0x85ebca6b), rngCombat: PSO.makeRng(base ^ 0xc2b2ae35),
      arena: arena, arenaId: arenaId, diff: D.DIFFS[diffId], diffId: diffId, char: ch, charId: cfg.char, spec: spec, specId: cfg.spec,
      mods: mods, res: res,
      t: 0, state: 'play', won: false, endless: false,
      player: { x: arena.w / 2, y: arena.h / 2, r: BAL.player.radius, hp: 1, fx: 1, fy: 0, iframes: 0, shield: 0, shieldDelay: 0,
                abilityCd: 0, dashT: 0, dx: 1, dy: 0, moved: 0, moving: false, speedT: 0, dashStamp: 0 },
      stats: {}, weapons: [], pets: [], tech: {}, syn: {}, tags: {}, picks: [],
      enemies: [], grid: new Grid(arena.w, arena.h, 64),
      shots: [], eshots: [], gems: [], pickups: [], turrets: [], traps: [], allies: [], zones: [], bombs: [], pools: [],
      parts: [], texts: [], beams: [], rings: [], boomQ: [], sigQ: [],
      obstacles: arena.obstacles || [], vents: [],
      level: 1, xp: 0, xpNext: xpFor(1), pending: 0, chests: 0,
      rerolls: BAL.rerolls + res.r_reroll + (ach.ach_evolve ? 1 : 0) + (cfg.spec === 'hybrid' ? 1 : 0),
      choices: BAL.choices + res.r_choice, revives: res.r_revive,
      kills: 0, gemsGot: 0, dmgBy: {}, dmgTaken: 0, bossKills: 0, bossesDefeated: [], maxTurrets: 0, turretsDeployed: 0,
      evolved: 0, synCount: 0, abilityUses: 0, bonusSparks: 0,
      spawnAcc: 0, nextEnc: 0, bossIdx: 0, boss: null, nextEndlessBoss: 0, endlessLoops: 0,
      hatchKills: 0, frenzyCd: 20, frenzyT: 0, rallyT: 0, haloStacks: 0, haloT: 0, barrierCd: 0, barrierReady: false,
      turretT: 1.5, trapT: 1, teslaT: 0, uid: 1, chainStamp: 1, shake: 0, banner: null, offer: null,
      viewW: 1350, viewH: BAL.viewH,
      bank: { sparks: 0, kills: 0, gems: 0, bosses: 0, time: 0, run: false, win: false, challenge: false, bond: {} },
      tut: save.tutorialDone ? null : { step: 0, kills0: 0, gems0: 0, uses0: 0 }
    };
    R.nextEnc = R.rngSpawn.range(55, 75);
    if (arena.vents) for (i = 0; i < arena.vents.length; i++)
      R.vents.push({ x: arena.vents[i].x, y: arena.vents[i].y, r: arena.vents[i].r, state: 'idle', t: R.rngSpawn.range(3, 10), tick: 0 });
    if (!mods.noWeapons) R.weapons.push(Sim.mkWeapon(ch.weapon));
    var slots = 2 + (res.r_slot ? 1 : 0), petList = (cfg.pets || []).slice(0, slots);
    for (i = 0; i < petList.length; i++) {
      var pid = petList[i];
      var v = (save.variant && save.variant[pid] === 'B' && (save.bond[pid] || 0) >= BAL.bondForVariant) ? 'B' : 'A';
      R.pets.push({ id: pid, variant: v, lvl: ach.ach_endless ? 2 : 1, cd: 0.6 + i * 0.4, x: R.player.x, y: R.player.y, slot: i, sigCd: 0, frenzyCd: 0, tx: null, scan: 0, aim: 0, act: 0 });
    }
    if (spec.grant) R.tech[spec.grant] = 1;
    Sim.recalc(R);
    R.player.hp = R.stats.maxHp;
    if (res.r_start) R.pending = 1;
    return R;
  };

  Sim.mkWeapon = function (id) { return { id: id, lvl: 1, evolved: false, cd: 0.4, ang: 0, t: 0 }; };
  Sim.getWeapon = function (R, id) { for (var i = 0; i < R.weapons.length; i++) if (R.weapons[i].id === id) return R.weapons[i]; return null; };
  Sim.getPet = function (R, id, variant) {
    for (var i = 0; i < R.pets.length; i++) if (R.pets[i].id === id && (!variant || R.pets[i].variant === variant)) return R.pets[i];
    return null;
  };

  /* ---------- Derived stats: recomputed whenever the build changes ---------- */
  Sim.recalc = function (R) {
    var s = R.stats, ch = R.char, res = R.res, m = R.mods, p = R.player, i, k, j;
    var oldMax = s.maxHp || 0;
    var magA = Sim.getPet(R, 'magpip', 'A'), mag = Sim.getPet(R, 'magpip'), cogA = Sim.getPet(R, 'cog', 'A'), thorn = Sim.getPet(R, 'beetle', 'B');
    var sentry = Sim.getWeapon(R, 'sentry');
    s.maxHp = Math.round(ch.hp * (1 + 0.06 * res.r_vital) * m.hpMult);
    s.speed = BAL.player.speed * ch.speed * (1 + 0.03 * res.r_swift);
    s.pickup = BAL.player.pickup * (1 + 0.1 * res.r_magnet) * (1 + 0.35 * tr(R, 'e_magnet')) * (1 + (magA ? D.PETS.magpip.A.pickup(magA.lvl) : 0));
    s.xpMult = (1 + 0.04 * res.r_insight) * (1 + 0.08 * tr(R, 'e_magnet')) * m.xpMult * (1 + (mag ? D.PETS.magpip[mag.variant].xp(mag.lvl) : 0));
    s.dmgMult = (1 + 0.2 * tr(R, 'a_sharp')) * ch.dmgMult * m.dmgMult;
    s.cdMult = 1 / (1 + 0.12 * tr(R, 'a_rapid'));
    s.critChance = tr(R, 'a_crit') ? 0.2 : BAL.player.critChance;
    s.critMult = tr(R, 'a_cap') ? 3 : BAL.player.critMult;
    s.multi = tr(R, 'a_multi') ? 1 : 0;
    s.explMult = tr(R, 'a_scorch') ? 1.3 : 1;
    s.petRate = (1 + 0.2 * tr(R, 's_pack')) * ch.petRate * m.petRate;
    s.petDmg = (1 + 0.25 * tr(R, 's_bond')) * m.petDmgMult;
    s.turretCap = (sentry ? D.WEAPONS.sentry.lv[sentry.lvl - 1].cap : 0) + tr(R, 'e_sentry') + (tr(R, 'e_cap') ? 2 : 0) + ch.turretCap + (cogA ? 1 : 0);
    s.turretInterval = sentry ? D.WEAPONS.sentry.lv[sentry.lvl - 1].interval : BAL.turret.interval;
    s.turretDmg = sentry ? (sentry.evolved ? D.WEAPONS.sentry.evo.dmg : D.WEAPONS.sentry.lv[sentry.lvl - 1].dmg) : BAL.turret.dmg;
    s.turretCd = sentry ? D.WEAPONS.sentry.lv[sentry.lvl - 1].cd : BAL.turret.cd;
    s.turretLife = BAL.turret.life * (tr(R, 'e_sentry') ? 1.3 : 1);
    s.turretRate = (tr(R, 'e_cap') ? 1.6 : 1) * (1 + (cogA ? D.PETS.cog.A.rate(cogA.lvl) : 0));
    s.turretPierce = tr(R, 'e_cap') ? 2 : 0;
    s.tesla = !!(sentry && sentry.evolved);
    s.shieldMax = tr(R, 'e_shield') ? BAL.shield.amount : 0;
    s.dmgTaken = thorn ? 1 - D.PETS.beetle.B.reduce(thorn.lvl) : 1;
    s.swarmMax = tr(R, 's_hatch') ? BAL.swarmling.max + (tr(R, 's_brood') ? 3 : 0) : 0;
    if (oldMax && s.maxHp > oldMax) p.hp += s.maxHp - oldMax;
    if (p.hp > s.maxHp) p.hp = s.maxHp;

    /* Build tags drive synergy availability and are shown in the UI. */
    var tags = R.tags = {};
    for (i = 0; i < R.weapons.length; i++) { var wt = D.WEAPONS[R.weapons[i].id].tags; for (j = 0; j < wt.length; j++) tags[wt[j]] = true; }
    if (Sim.getWeapon(R, 'arc') && Sim.getWeapon(R, 'arc').evolved) tags.Explosion = true;
    for (i = 0; i < R.pets.length; i++) { var pt = D.PETS[R.pets[i].id][R.pets[i].variant].tags; for (j = 0; j < pt.length; j++) tags[pt[j]] = true; tags.PetOwned = true; }
    for (k in R.tech) if (R.tech[k] > 0) { var tt = D.TECH[k].tags; for (j = 0; j < tt.length; j++) tags[tt[j]] = true; }
    if (R.syn.x_pyro) tags.Explosion = true;
    if (s.turretCap > 0) tags.Turret = true;
  };

  /* ---------- Effects helpers (cosmetic only) ---------- */
  Sim.burst = function (R, x, y, color, n, speed, size) {
    if (lowFx()) n = Math.ceil(n / 3);
    for (var i = 0; i < n && R.parts.length < BAL.particleCap; i++) {
      var a = fx.next() * 6.283, sp = speed * (0.35 + fx.next() * 0.65), life = 0.25 + fx.next() * 0.3;
      R.parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: life, max: life, color: color, size: (size || 3) * (0.6 + fx.next() * 0.8) });
    }
  };
  Sim.ring = function (R, x, y, r0, r1, life, color, fill) {
    if (R.rings.length < 80) R.rings.push({ x: x, y: y, r0: r0, r1: r1, life: life, max: life, color: color, fill: !!fill });
  };
  Sim.beam = function (R, x1, y1, x2, y2, color, w, life, kind) {
    if (R.beams.length < 140) R.beams.push({ x1: x1, y1: y1, x2: x2, y2: y2, color: color, w: w, life: life, max: life, kind: kind || 'line', seed: fx.next() });
  };
  Sim.text = function (R, x, y, str, color, size) {
    if (R.texts.length >= BAL.textCap) return;
    R.texts.push({ x: x + (fx.next() - 0.5) * 14, y: y - 8, str: str, life: 0.6, color: color || '#ffffff', size: size || 15 });
  };
  Sim.banner = function (R, text, kind) { R.banner = { text: text, t: 2.6, kind: kind || 'info' }; };
  Sim.shake = function (R, amt) { if (amt > R.shake) R.shake = amt; };

  /* ---------- Targeting ---------- */
  Sim.nearest = function (R, x, y, range, skipStamp) {
    var list = R.grid.query(x, y, range, QN), best = null, bd = 1e18;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (skipStamp && e.cs === skipStamp) continue;
      var dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  };
  Sim.toughest = function (R, x, y, range) {
    var list = R.grid.query(x, y, range, QN), best = null, bh = -1;
    for (var i = 0; i < list.length; i++) if (list[i].hp > bh) { bh = list[i].hp; best = list[i]; }
    return best;
  };
  Sim.randomEnemy = function (R, x, y, range) {
    var list = R.grid.query(x, y, range, QN);
    return list.length ? list[Math.floor(R.rngCombat.next() * list.length)] : null;
  };

  /* ---------- Status effects ---------- */
  Sim.burn = function (e, dps, time) { if (dps >= e.burnDps || e.burnT <= 0) e.burnDps = dps; if (time > e.burnT) e.burnT = time; };
  Sim.slow = function (e, factor, time) {
    if (e.boss) factor = 1 - (1 - factor) * 0.5;
    if (e.slowT <= 0 || factor < e.slowF) e.slowF = factor;
    if (time > e.slowT) e.slowT = time;
  };
  Sim.freeze = function (e, time) { if (e.boss) Sim.slow(e, 0.6, time * 2); else if (time > e.freezeT) e.freezeT = time; };
  Sim.stun = function (e, time) { if (e.boss) time *= 0.33; if (time > e.stunT) e.stunT = time; };
  Sim.knock = function (e, fromX, fromY, force) {
    if (e.boss) return;
    var dx = e.x - fromX, dy = e.y - fromY, d = Math.sqrt(dx * dx + dy * dy) || 1;
    if (e.elite) force *= 0.4;
    e.kx += dx / d * force; e.ky += dy / d * force;
  };

  /* ---------- Damage ----------
     o.weapon: can crit. o.pet: applies Mark. o.kind: 'turret' | 'trap' | 'explosion' | 'pet' | ... */
  Sim.dmgEnemy = function (R, e, amt, src, o) {
    if (e.dead) return 0;
    o = o || NOOPT;
    var s = R.stats, crit = false;
    if (o.weapon && !o.noCrit && R.rngCombat.next() < s.critChance) { crit = true; amt *= s.critMult; }
    if (e.markT > 0) amt *= 1 + BAL.markBonus;
    if (o.pet && R.tech.s_mark) e.markT = 3;
    var dealt = amt < e.hp ? amt : e.hp;
    e.hp -= amt; e.flash = 0.09;
    R.dmgBy[src] = (R.dmgBy[src] || 0) + dealt;
    if (!o.quiet && PSO.settings && PSO.settings.numbers && !lowFx()) Sim.text(R, e.x, e.y - e.r, String(Math.round(amt)) + (crit ? '!' : ''), crit ? '#ffe14d' : '#ffffff', crit ? 20 : 14);
    if (crit) {
      if (R.tech.a_volatile) R.boomQ.push({ x: e.x, y: e.y, r: 55, dmg: amt * 0.5, src: 'volatile' });
      if (R.syn.x_signal && R.sigQ.length < 8) R.sigQ.push(e);
    }
    if (e.hp <= 0) kill(R, e, src, o.kind, crit);
    else if (!o.quiet) sfx('hit');
    return dealt;
  };

  function kill(R, e, src, kind, crit) {
    e.dead = true; R.kills++;
    var rc = R.rngCombat;
    Sim.addGem(R, e.x, e.y, e.xp);
    if (e.boss) Sim.bossKilled(R, e);
    else if (e.elite) { if (rc.next() < BAL.chestChanceElite) R.pickups.push({ kind: 'chest', x: e.x, y: e.y, t: 0 }); }
    else if (rc.next() < BAL.healOrb.chance && R.pickups.length < 25) R.pickups.push({ kind: 'heal', x: e.x, y: e.y, t: 0 });
    if (R.syn.x_pyro && e.burnT > 0 && (kind === 'turret' || kind === 'trap')) R.boomQ.push({ x: e.x, y: e.y, r: 75, dmg: 40, src: 'pyro', burn: true });
    if (crit && R.tech.a_cap) R.boomQ.push({ x: e.x, y: e.y, r: 80, dmg: Math.min(e.maxHp * 0.6, 150 * R.stats.dmgMult), src: 'overkill' });
    if (R.tech.e_salvage && (kind === 'turret' || kind === 'trap') && rc.next() < 0.12 && R.pickups.length < 25) R.pickups.push({ kind: 'heal', x: e.x, y: e.y, t: 0 });
    if (R.stats.swarmMax > 0 && ++R.hatchKills >= BAL.swarmling.everyKills) {
      R.hatchKills = 0;
      if (R.allies.length < R.stats.swarmMax) { R.allies.push({ x: e.x, y: e.y, life: BAL.swarmling.life, cd: 0, target: null, scan: 0 }); Sim.ring(R, e.x, e.y, 4, 26, 0.3, '#ff6f91'); }
    }
    Sim.burst(R, e.x, e.y, e.color, e.elite || e.boss ? 18 : 5, e.boss ? 320 : 150, e.boss ? 6 : 3);
    sfx('kill');
  }

  /* Friendly explosion. Radius grows with Scorch Shells; Cryo Shatter doubles damage on chilled targets. */
  Sim.explode = function (R, x, y, radius, dmg, src, o) {
    o = o || NOOPT;
    var s = R.stats, r = radius * s.explMult, list = R.grid.query(x, y, r, QX), kind = o.kind || 'explosion';
    var opt = { kind: kind, weapon: !!o.weapon, noCrit: !o.weapon, pet: !!o.pet };
    for (var i = 0; i < list.length; i++) {
      var e = list[i], d = dmg;
      if (R.syn.x_cryo && (e.slowT > 0 || e.freezeT > 0)) d *= 2;
      Sim.dmgEnemy(R, e, d, src, opt);
      if (e.dead) continue;
      if (R.tech.a_scorch || o.burn) Sim.burn(e, 8, 3);
      if (o.root) Sim.stun(e, o.root);
      if (o.stun) Sim.stun(e, o.stun);
      if (o.knock) Sim.knock(e, x, y, o.knock);
    }
    Sim.ring(R, x, y, r * 0.25, r, 0.28, o.color || '#ffd166', true);
    Sim.burst(R, x, y, o.color || '#ffd166', 8, 220, 4);
    if (r > 60) Sim.shake(R, 3);
    sfx('boom');
  };

  /* Chain lightning starting near (x,y). Returns number of enemies hit. */
  Sim.chain = function (R, x, y, dmg, jumps, src, o) {
    o = o || NOOPT;
    var stamp = ++R.chainStamp, cur = Sim.nearest(R, x, y, o.range || 380), px = x, py = y, n = 0, hits = QC;
    hits.length = 0;
    while (cur && n <= jumps) {
      cur.cs = stamp; hits.push(cur);
      Sim.beam(R, px, py, cur.x, cur.y, o.color || '#c9a7ff', o.w || 3, 0.16, 'zap');
      px = cur.x; py = cur.y; n++;
      cur = Sim.nearest(R, px, py, 175, stamp);
    }
    var opt = { weapon: !!o.weapon, pet: !!o.pet, kind: o.kind };
    for (var i = 0; i < hits.length; i++) {
      var e = hits[i];
      Sim.dmgEnemy(R, e, dmg, src, opt);
      if (o.stun && !e.dead) Sim.stun(e, o.stun);
    }
    if (n) sfx('zap');
    if (o.blast) for (i = 0; i < hits.length; i++) R.boomQ.push({ x: hits[i].x, y: hits[i].y, r: o.blast, dmg: dmg * 0.6, src: src, color: '#c9a7ff' });
    /* Live Wire: every turret copies the cast at 30% damage. */
    if (R.syn.x_wire && !o.noWire) for (i = 0; i < R.turrets.length; i++)
      Sim.chain(R, R.turrets[i].x, R.turrets[i].y, dmg * 0.3, Math.max(2, Math.floor(jumps / 2)), 'wire', { noWire: true, kind: 'turret', weapon: false, range: 300, color: '#3ddbc4' });
    return n;
  };

  /* Damage every enemy along a line segment. */
  Sim.lineHit = function (R, x1, y1, x2, y2, width, dmg, src, o) {
    var es = R.enemies, dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy || 1, n = 0;
    for (var i = 0; i < es.length; i++) {
      var e = es[i]; if (e.dead) continue;
      var t = ((e.x - x1) * dx + (e.y - y1) * dy) / len2;
      if (t < 0) t = 0; else if (t > 1) t = 1;
      var cx = x1 + dx * t - e.x, cy = y1 + dy * t - e.y, rr = width + e.r;
      if (cx * cx + cy * cy <= rr * rr) { Sim.dmgEnemy(R, e, dmg, src, o); n++; }
    }
    return n;
  };

  /* ---------- Player ---------- */
  Sim.hurtPlayer = function (R, dmg, e) {
    var p = R.player, s = R.stats;
    if (p.iframes > 0 || R.state !== 'play') return false;
    var beetleA = Sim.getPet(R, 'beetle', 'A'), beetleB = Sim.getPet(R, 'beetle', 'B');
    if (beetleA && R.barrierReady) {
      R.barrierReady = false; R.barrierCd = D.PETS.beetle.A.cd(beetleA.lvl);
      p.iframes = 0.5;
      Sim.explode(R, p.x, p.y, D.PETS.beetle.A.radius / s.explMult, D.PETS.beetle.A.dmg(beetleA.lvl) * s.petDmg, 'beetle', { pet: true, kind: 'pet', knock: 420, color: '#5aa9ff' });
      Sim.text(R, p.x, p.y - 30, 'BLOCKED', '#5aa9ff', 18);
      sfx('block');
      return false;
    }
    dmg *= s.dmgTaken;
    if (beetleB && e && !e.dead) Sim.dmgEnemy(R, e, D.PETS.beetle.B.dmg(beetleB.lvl) * s.petDmg, 'beetle', { pet: true, kind: 'pet' });
    if (s.shieldMax > 0) {
      p.shieldDelay = BAL.shield.delay;
      if (p.shield > 0) {
        var ab = Math.min(p.shield, dmg); p.shield -= ab; dmg -= ab;
        if (dmg <= 0.01) { p.iframes = 0.3; sfx('block'); Sim.ring(R, p.x, p.y, 18, 34, 0.2, '#3ddbc4'); return false; }
      }
    }
    p.hp -= dmg; R.dmgTaken += dmg; p.iframes = BAL.player.iframes; p.hurtFlash = 0.25;
    Sim.shake(R, 7); sfx('hurt');
    Sim.burst(R, p.x, p.y, '#ff4d4d', 8, 200, 4);
    if (p.hp <= 0) {
      if (R.revives > 0) {
        R.revives--; p.hp = s.maxHp * 0.5; p.iframes = 2.5;
        Sim.explode(R, p.x, p.y, 260, 60, 'revive', { knock: 700, stun: 1.5, color: '#ffffff' });
        Sim.banner(R, 'Second Wind!', 'good');
      } else { p.hp = 0; R.state = 'dead'; sfx('lose'); }
    }
    return true;
  };

  Sim.heal = function (R, amt) {
    var p = R.player; p.hp = Math.min(R.stats.maxHp, p.hp + amt);
    Sim.text(R, p.x, p.y - 26, '+' + Math.round(amt), '#7dff9b', 16);
  };

  Sim.gainXp = function (R, v) {
    R.xp += v * R.stats.xpMult;
    while (R.xp >= R.xpNext) {
      R.xp -= R.xpNext; R.level++; R.xpNext = xpFor(R.level); R.pending++;
      Sim.heal(R, R.stats.maxHp * BAL.levelHeal);
    }
  };

  function pushOut(o, obstacles, pad) {
    for (var i = 0; i < obstacles.length; i++) {
      var ob = obstacles[i], dx = o.x - ob.x, dy = o.y - ob.y, min = ob.r + o.r + (pad || 0), d2 = dx * dx + dy * dy;
      if (d2 < min * min) { var d = Math.sqrt(d2) || 1; o.x = ob.x + dx / d * min; o.y = ob.y + dy / d * min; }
    }
  }
  Sim.pushOut = pushOut;

  function useAbility(R) {
    var p = R.player, ab = R.char.ability, scale = 1 + 0.08 * R.level, s = R.stats, i, list;
    p.abilityCd = ab.cd; R.abilityUses++;
    sfx('ability');
    if (ab.id === 'dash') {
      p.dashT = 0.18; p.dx = p.fx; p.dy = p.fy; p.iframes = Math.max(p.iframes, 0.4); p.dashStamp = ++R.chainStamp;
    } else if (ab.id === 'clap') {
      list = R.grid.query(p.x, p.y, ab.radius, QD);
      for (i = 0; i < list.length; i++) { Sim.dmgEnemy(R, list[i], ab.dmg * scale * s.dmgMult, 'ability', { kind: 'ability' }); if (!list[i].dead) { Sim.stun(list[i], ab.stun); Sim.knock(list[i], p.x, p.y, 160); } }
      Sim.ring(R, p.x, p.y, 20, ab.radius, 0.35, '#b388ff', true); Sim.shake(R, 8);
      for (i = 0; i < 8; i++) { var a = i / 8 * 6.283; Sim.beam(R, p.x, p.y, p.x + Math.cos(a) * ab.radius, p.y + Math.sin(a) * ab.radius, '#e3d4ff', 3, 0.25, 'zap'); }
    } else if (ab.id === 'rally') {
      R.rallyT = ab.dur;
      R.turrets.push({ x: p.x, y: p.y, life: 9, cd: 0, ang: 0, bonus: true, salv: 0 });
      Sim.ring(R, p.x, p.y, 20, 180, 0.4, '#2ee6a6', true);
      Sim.banner(R, 'Rally! Turrets and pets x2 speed', 'good');
    }
  }

  function updPlayer(R, dt, inp) {
    var p = R.player, s = R.stats, a = R.arena;
    var mx = inp.mx, my = inp.my, len = Math.sqrt(mx * mx + my * my), i, list;
    if (len > 1) { mx /= len; my /= len; len = 1; }
    if (len > 0.01) { var l2 = Math.sqrt(mx * mx + my * my); p.fx = mx / l2; p.fy = my / l2; }
    p.moving = len > 0.01;
    if (p.dashT > 0) {
      p.dashT -= dt; p.x += p.dx * 1400 * dt; p.y += p.dy * 1400 * dt;
      var dd = R.char.ability.dmg * (1 + 0.08 * R.level) * s.dmgMult;
      list = R.grid.query(p.x, p.y, 44, QD);
      for (i = 0; i < list.length; i++) if (list[i].ds !== p.dashStamp) { list[i].ds = p.dashStamp; Sim.dmgEnemy(R, list[i], dd, 'ability', { kind: 'ability' }); Sim.knock(list[i], p.x, p.y, 200); }
      Sim.burst(R, p.x, p.y, R.char.color, 2, 60, 5);
    } else {
      var spd = s.speed * (p.speedT > 0 ? 1.25 : 1);
      p.x += mx * spd * dt; p.y += my * spd * dt; p.moved += len * spd * dt;
    }
    if (p.x < p.r) p.x = p.r; else if (p.x > a.w - p.r) p.x = a.w - p.r;
    if (p.y < p.r) p.y = p.r; else if (p.y > a.h - p.r) p.y = a.h - p.r;
    if (R.obstacles.length) pushOut(p, R.obstacles);
    if (p.iframes > 0) p.iframes -= dt;
    if (p.hurtFlash > 0) p.hurtFlash -= dt;
    if (p.speedT > 0) p.speedT -= dt;
    if (p.abilityCd > 0) p.abilityCd -= dt;
    if (inp.ability && p.abilityCd <= 0) useAbility(R);

    /* Energy Shield recharge (and Fortress Protocol EMP). */
    if (s.shieldMax > 0 && p.shieldDelay > 0) {
      p.shieldDelay -= dt;
      if (p.shieldDelay <= 0) {
        p.shield = s.shieldMax; Sim.ring(R, p.x, p.y, 10, 40, 0.3, '#3ddbc4');
        if (R.tech.e_cap) {
          list = R.grid.query(p.x, p.y, 210, QD);
          for (i = 0; i < list.length; i++) { Sim.dmgEnemy(R, list[i], 20, 'emp', { kind: 'ability' }); if (!list[i].dead) Sim.stun(list[i], 1.5); }
          Sim.ring(R, p.x, p.y, 20, 210, 0.4, '#3ddbc4', true); sfx('zap');
        }
      }
    }
    if (R.rallyT > 0) R.rallyT -= dt;
    if (R.tech.s_cap) {
      if (R.frenzyT > 0) R.frenzyT -= dt;
      else { R.frenzyCd -= dt; if (R.frenzyCd <= 0) { R.frenzyCd = 20; R.frenzyT = 6; Sim.banner(R, 'STAMPEDE!', 'good'); sfx('evolve'); } }
    }
    if (R.haloT > 0) { R.haloT -= dt; if (R.haloT <= 0) R.haloStacks = 0; }
  }

  /* ---------- Pickups ---------- */
  Sim.addGem = function (R, x, y, v) {
    if (R.gems.length >= BAL.gemCap) {       // merge instead of dropping: value is never lost
      var g = R.gems[Math.floor(fx.next() * R.gems.length)]; g.v += v; return;
    }
    R.gems.push({ x: x + (fx.next() - 0.5) * 10, y: y + (fx.next() - 0.5) * 10, v: v, mag: false, sp: 240 });
  };
  Sim.collectGem = function (R, g) {
    Sim.gainXp(R, g.v); R.gemsGot++;
    if (R.syn.x_halo) { R.haloStacks = Math.min(20, R.haloStacks + 1); R.haloT = 5; }
    sfx('pickup');
  };

  function updPickups(R, dt) {
    var p = R.player, pr = R.stats.pickup, pr2 = pr * pr, gs = R.gems, i, g, dx, dy, d2, d;
    for (i = gs.length - 1; i >= 0; i--) {
      g = gs[i]; dx = p.x - g.x; dy = p.y - g.y; d2 = dx * dx + dy * dy;
      if (!g.mag && d2 < pr2) g.mag = true;
      if (g.mag) {
        d = Math.sqrt(d2) || 1; g.sp = Math.min(1000, g.sp + 1600 * dt);
        g.x += dx / d * g.sp * dt; g.y += dy / d * g.sp * dt;
        if (d < 24) { Sim.collectGem(R, g); gs[i] = gs[gs.length - 1]; gs.pop(); }
      }
    }
    var ps = R.pickups;
    for (i = ps.length - 1; i >= 0; i--) {
      var k = ps[i]; k.t += dt; dx = p.x - k.x; dy = p.y - k.y; d2 = dx * dx + dy * dy;
      if (k.kind === 'heal' && d2 < pr2) { d = Math.sqrt(d2) || 1; k.x += dx / d * 420 * dt; k.y += dy / d * 420 * dt; }
      if (d2 < 34 * 34) {
        if (k.kind === 'heal') Sim.heal(R, BAL.healOrb.amount);
        else { R.pending++; R.chests++; sfx('chest'); Sim.banner(R, 'Chest! Free upgrade', 'good'); }
        ps[i] = ps[ps.length - 1]; ps.pop();
      }
    }
  }

  function updFx(R, dt) {
    var i, a;
    a = R.parts; for (i = a.length - 1; i >= 0; i--) { var q = a[i]; q.life -= dt; if (q.life <= 0) { a[i] = a[a.length - 1]; a.pop(); continue; } q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.94; q.vy *= 0.94; }
    a = R.texts; for (i = a.length - 1; i >= 0; i--) { a[i].life -= dt; a[i].y -= 40 * dt; if (a[i].life <= 0) { a[i] = a[a.length - 1]; a.pop(); } }
    a = R.beams; for (i = a.length - 1; i >= 0; i--) { a[i].life -= dt; if (a[i].life <= 0) { a[i] = a[a.length - 1]; a.pop(); } }
    a = R.rings; for (i = a.length - 1; i >= 0; i--) { a[i].life -= dt; if (a[i].life <= 0) { a[i] = a[a.length - 1]; a.pop(); } }
    if (R.shake > 0) R.shake = Math.max(0, R.shake - 40 * dt);
    if (R.banner) { R.banner.t -= dt; if (R.banner.t <= 0) R.banner = null; }
  }

  /* Short interactive introduction: each step completes by doing the thing. */
  var TUT = [
    'Move with W A S D or the arrow keys.',
    'Your weapon and pets attack on their own. Defeat 5 enemies!',
    'Walk over the glowing gems to gain XP.',
    null,   // filled with ability text
    'Fill the XP bar to pick an upgrade. Red striped zones mean danger: step out of them!'
  ];
  Sim.tutText = function (R) {
    if (!R.tut) return null;
    if (R.tut.step === 3) return 'Press SPACE to use ' + R.char.ability.name + '.';
    return TUT[R.tut.step] || null;
  };
  function updTut(R, dt) {
    var t = R.tut, was = t.step;
    t.timer = (t.timer || 0) + dt;
    var skip = t.timer > 25;   // never get stuck on a hint
    if (t.step === 0 && (R.player.moved > 160 || skip)) { t.step = 1; t.kills0 = R.kills; }
    else if (t.step === 1 && (R.kills - t.kills0 >= 5 || skip)) { t.step = 2; t.gems0 = R.gemsGot; }
    else if (t.step === 2 && (R.gemsGot - t.gems0 >= 3 || skip)) { t.step = 3; t.uses0 = R.abilityUses; }
    else if (t.step === 3 && (R.abilityUses > t.uses0 || skip)) t.step = 4;
    else if (t.step === 4 && (R.picks.length > 0 || skip)) { R.tut = null; R.tutDone = true; return; }
    if (t.step !== was) t.timer = 0;
  }

  /* ---------- One simulation step ---------- */
  Sim.step = function (R, dt, inp) {
    if (R.state !== 'play') return;
    R.t += dt;
    updPlayer(R, dt, inp);
    var g = R.grid, es = R.enemies, i;
    g.clear();
    for (i = 0; i < es.length; i++) g.insert(es[i]);
    PSO.Enemies.director(R, dt);
    PSO.Weapons.update(R, dt);
    PSO.Pets.update(R, dt);
    PSO.Enemies.update(R, dt);
    /* Deferred explosions (from crits, kills, synergies): processed once per frame, cannot recurse. */
    var q = R.boomQ, n = Math.min(q.length, 40);
    for (i = 0; i < n; i++) Sim.explode(R, q[i].x, q[i].y, q[i].r, q[i].dmg, q[i].src, { burn: q[i].burn, color: q[i].color });
    q.splice(0, n); if (q.length > 80) q.length = 80;
    updPickups(R, dt);
    updFx(R, dt);
    if (R.tut) updTut(R, dt);
  };

  /* Called when the final boss dies. */
  Sim.bossKilled = function (R, e) {
    R.bossKills++; R.boss = null;
    if (R.bossesDefeated.indexOf(e.type) < 0) R.bossesDefeated.push(e.type);
    R.pickups.push({ kind: 'chest', x: e.x, y: e.y, t: 0 });
    for (var i = 0; i < 24; i++) Sim.addGem(R, e.x + (fx.next() - 0.5) * 160, e.y + (fx.next() - 0.5) * 160, Math.ceil(e.xp / 24));
    R.eshots.length = 0; R.zones.length = 0;
    Sim.shake(R, 14); Sim.ring(R, e.x, e.y, 30, 320, 0.6, '#ffffff', true);
    Sim.banner(R, e.name + ' defeated!', 'good');
    if (e.final && !R.won) { R.won = true; R.state = 'won'; sfx('win'); }
  };

  Sim.continueEndless = function (R) {
    R.endless = true; R.state = 'play';
    R.nextEndlessBoss = R.t + BAL.endless.bossEvery;
    Sim.banner(R, 'Endless mode: how long can you last?', 'info');
  };
})();
