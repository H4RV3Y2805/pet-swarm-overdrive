/* Pet Swarm: Overdrive - pet behaviours (two variants each), bonus strikes and Swarmling allies. */
(function () {
  'use strict';
  var PSO = window.PSO, D = PSO.DATA, BAL = D.BAL, Sim = PSO.Sim, W = PSO.Weapons;
  var P = PSO.Pets = {};
  var QP = [], QA = [];

  function ready(pet, dt, rate) { pet.cd -= dt * rate; return pet.cd <= 0; }

  var ACT = {
    zapA: function (R, pet, dt, rate, V, s, p) {
      if (!ready(pet, dt, rate)) return;
      var n = Sim.chain(R, pet.x, pet.y, V.dmg(pet.lvl) * s.petDmg, V.jumps(pet.lvl), 'zap', { pet: true, kind: 'pet', color: '#ffe14d', range: 360 });
      pet.cd = n ? V.cd : 0.2; if (n) pet.act = 0.2;
    },
    zapB: function (R, pet, dt, rate, V, s, p) {
      if (!ready(pet, dt, rate)) return;
      var e = Sim.toughest(R, p.x, p.y, 440);
      if (!e) { pet.cd = 0.2; return; }
      Sim.beam(R, e.x, e.y - 420, e.x, e.y, '#ffe14d', 7, 0.22, 'zap');
      Sim.explode(R, e.x, e.y, V.radius, V.dmg(pet.lvl) * s.petDmg, 'zap', { pet: true, kind: 'pet', stun: V.stun, color: '#ffe14d' });
      pet.cd = V.cd; pet.act = 0.2;
    },
    emberA: function (R, pet, dt, rate, V, s, p) {
      if (!ready(pet, dt, rate)) return;
      var e = Sim.nearest(R, pet.x, pet.y, V.range + 20);
      if (!e) { pet.cd = 0.2; return; }
      var ang = Math.atan2(e.y - pet.y, e.x - pet.x), list = R.grid.query(pet.x, pet.y, V.range, QP), dmg = V.dmg(pet.lvl) * s.petDmg, burn = V.burn(pet.lvl) * s.petDmg;
      for (var i = 0; i < list.length; i++) {
        var t = list[i], d = Math.atan2(t.y - pet.y, t.x - pet.x) - ang;
        while (d > 3.1416) d -= 6.2832; while (d < -3.1416) d += 6.2832;
        if (Math.abs(d) > 0.6) continue;
        Sim.dmgEnemy(R, t, dmg, 'ember', W.OPT.pet);
        if (!t.dead) Sim.burn(t, burn, V.burnT);
      }
      R.rings.push({ x: pet.x, y: pet.y, r0: 20, r1: V.range, life: 0.3, max: 0.3, color: '#ff7b3a', fill: true, cone: ang });
      Sim.sfx('ability'); pet.cd = V.cd; pet.aim = ang; pet.act = 0.3;
    },
    emberB: function (R, pet, dt, rate, V, s, p) {
      if (!ready(pet, dt, rate)) return;
      var e = Sim.randomEnemy(R, p.x, p.y, 380);
      if (!e) { pet.cd = 0.2; return; }
      R.bombs.push({ x0: pet.x, y0: pet.y, x1: e.x, y1: e.y, t: 0, dur: 0.5, dmg: V.dmg(pet.lvl) * s.petDmg, radius: V.radius, life: V.life, dps: V.burn(pet.lvl) * s.petDmg, kind: 'fireball' });
      pet.cd = V.cd; pet.act = 0.2;
    },
    beetleA: function (R, pet, dt, rate) {
      if (R.barrierReady) return;
      R.barrierCd -= dt * rate;
      if (R.barrierCd <= 0) { R.barrierReady = true; Sim.ring(R, R.player.x, R.player.y, 30, 16, 0.3, '#5aa9ff'); }
    },
    beetleB: function () { /* passive: handled in Sim.recalc and Sim.hurtPlayer */ },
    magpipA: function (R, pet, dt, rate, V, s, p) {
      var gs = R.gems, i, g;
      pet.scan -= dt;
      if (!pet.tx || pet.tx.gone || pet.tx.mag) {
        pet.tx = null;
        if (pet.scan <= 0) {
          pet.scan = 0.2;
          var best = null, bd = V.range * V.range;
          for (i = 0; i < gs.length; i++) { g = gs[i]; if (g.mag) continue; var dx = g.x - p.x, dy = g.y - p.y, d = dx * dx + dy * dy; if (d < bd) { var px = g.x - pet.x, py = g.y - pet.y; d = px * px + py * py; if (!best || d < best.d) best = { g: g, d: d }; } }
          if (best) pet.tx = best.g;
        }
      }
      if (pet.tx) {
        g = pet.tx; var ex = g.x - pet.x, ey = g.y - pet.y, ed = Math.sqrt(ex * ex + ey * ey) || 1, sp = V.speed(pet.lvl) * (rate > 1.5 ? 1.5 : 1);
        if (ed < 18) {
          i = gs.indexOf(g);
          if (i >= 0) { Sim.collectGem(R, g); gs[i] = gs[gs.length - 1]; gs.pop(); }
          g.gone = true; pet.tx = null; pet.scan = 0;
        } else { pet.x += ex / ed * sp * dt; pet.y += ey / ed * sp * dt; pet.free = true; }
      }
    },
    magpipB: function (R, pet, dt, rate, V, s, p) {
      if (!ready(pet, dt, rate)) return;
      for (var i = 0; i < R.gems.length; i++) R.gems[i].mag = true;
      p.speedT = 2; pet.cd = V.cd(pet.lvl); pet.act = 0.3;
      Sim.ring(R, p.x, p.y, 30, 520, 0.5, '#59e0ff'); Sim.sfx('chest');
    },
    cogA: function () { /* passive: +1 turret and faster turrets, handled in Sim.recalc */ },
    cogB: function (R, pet, dt, rate, V, s, p) {
      if (!ready(pet, dt, rate)) return;
      var n = 0, i, tp = R.traps, rc = R.rngCombat;
      for (i = 0; i < tp.length; i++) if (tp[i].mine) n++;
      if (n >= V.max(pet.lvl)) for (i = 0; i < tp.length; i++) if (tp[i].mine) { tp.splice(i, 1); break; }
      var a = rc.next() * 6.283, dist = 60 + rc.next() * 110;
      var mx = Math.max(20, Math.min(R.arena.w - 20, p.x + Math.cos(a) * dist)), my = Math.max(20, Math.min(R.arena.h - 20, p.y + Math.sin(a) * dist));
      tp.push({ x: mx, y: my, arm: 0.5, dmg: V.dmg(pet.lvl) * s.petDmg, radius: V.radius, root: 0, mine: true });
      pet.cd = V.cd(pet.lvl); pet.act = 0.2;
    },
    frostA: function (R, pet, dt, rate, V, s, p) {
      pet.scan -= dt; if (pet.scan > 0) return;
      pet.scan = 0.2;
      var list = R.grid.query(p.x, p.y, V.radius(pet.lvl), QP), f = 1 - V.slow(pet.lvl);
      for (var i = 0; i < list.length; i++) Sim.slow(list[i], f, 0.45);
    },
    frostB: function (R, pet, dt, rate, V, s, p) {
      if (!ready(pet, dt, rate)) return;
      var list = R.grid.query(pet.x, pet.y, 420, QP), n = Math.min(V.count, list.length);
      if (!n) { pet.cd = 0.2; return; }
      list.sort(function (a, b) { return ((a.x - pet.x) * (a.x - pet.x) + (a.y - pet.y) * (a.y - pet.y)) - ((b.x - pet.x) * (b.x - pet.x) + (b.y - pet.y) * (b.y - pet.y)); });
      for (var i = 0; i < n; i++) W.shot(R, pet.x, pet.y, Math.atan2(list[i].y - pet.y, list[i].x - pet.x), 560, V.dmg(pet.lvl) * s.petDmg, 0, 'frost', 'pet', '#aeeaff', V.freeze);
      pet.cd = V.cd; pet.act = 0.2; Sim.sfx('shoot');
    }
  };

  /* Bonus strike used by Hunter's Signal and Stampede. Every pet has one, flavoured by its element. */
  P.strike = function (R, pet, e) {
    if (!e || e.dead) return;
    var s = R.stats, dmg = (8 + 4 * pet.lvl) * s.petDmg, col = D.PETS[pet.id].color;
    pet.act = 0.2;
    if (pet.id === 'zap') { Sim.chain(R, pet.x, pet.y, dmg, 2, 'zap', { pet: true, kind: 'pet', color: col, range: 700, noWire: true }); return; }
    if (pet.id === 'cog') {
      var a = Math.atan2(e.y - pet.y, e.x - pet.x);
      for (var i = -1; i <= 1; i++) W.shot(R, pet.x, pet.y, a + i * 0.12, 600, dmg * 0.6, 0, 'cog', 'petTurret', col);
      return;
    }
    Sim.beam(R, pet.x, pet.y, e.x, e.y, col, 4, 0.15, 'line');
    Sim.dmgEnemy(R, e, pet.id === 'magpip' ? dmg * 1.5 : dmg, pet.id, W.OPT.pet);
    if (e.dead) return;
    if (pet.id === 'ember') Sim.burn(e, (4 + 2 * pet.lvl) * s.petDmg, 3);
    else if (pet.id === 'beetle') { Sim.knock(e, R.player.x, R.player.y, 260); Sim.stun(e, 0.3); }
    else if (pet.id === 'frost') Sim.freeze(e, 0.6);
  };

  P.update = function (R, dt) {
    var s = R.stats, p = R.player, pets = R.pets, n = pets.length, i, pet;
    var frenzy = R.frenzyT > 0, rate = s.petRate * (frenzy ? 3 : 1) * (R.rallyT > 0 ? 2 : 1);
    for (i = 0; i < n; i++) {
      pet = pets[i]; pet.free = false;
      if (pet.act > 0) pet.act -= dt;
      if (pet.sigCd > 0) pet.sigCd -= dt;
      ACT[pet.id + pet.variant](R, pet, dt, rate, D.PETS[pet.id][pet.variant], s, p);
      if (frenzy) {
        pet.frenzyCd -= dt;
        if (pet.frenzyCd <= 0) { pet.frenzyCd = 0.5; P.strike(R, pet, Sim.randomEnemy(R, p.x, p.y, 360)); }
      }
      if (!pet.free) {   // hover around the player
        var ang = R.t * 1.3 + i * 6.283 / n, tx = p.x + Math.cos(ang) * 50, ty = p.y + Math.sin(ang) * 34 - 8, k = 1 - Math.exp(-9 * dt);
        pet.x += (tx - pet.x) * k; pet.y += (ty - pet.y) * k;
      }
    }
    /* Hunter's Signal: crits queued this frame trigger pet strikes. */
    var q = R.sigQ;
    if (q.length) {
      for (i = 0; i < q.length; i++) for (var j = 0; j < n; j++) if (pets[j].sigCd <= 0 && !q[i].dead) { pets[j].sigCd = 0.6; P.strike(R, pets[j], q[i]); }
      q.length = 0;
    }
    /* Swarmlings (Hatchlings tech). */
    var al = R.allies, SW = BAL.swarmling;
    for (i = al.length - 1; i >= 0; i--) {
      var a = al[i]; a.life -= dt;
      if (a.life <= 0) {
        if (R.tech.s_brood) Sim.explode(R, a.x, a.y, 70, 30 * s.petDmg, 'swarmling', { pet: true, kind: 'pet', color: '#ff6f91' });
        al.splice(i, 1); continue;
      }
      a.scan -= dt;
      if (a.scan <= 0 || !a.target || a.target.dead) { a.scan = 0.3; a.target = Sim.nearest(R, a.x, a.y, 420); }
      var tg = a.target, gx, gy;
      if (tg) { gx = tg.x; gy = tg.y; } else { gx = p.x + Math.cos(i * 2.1 + R.t) * 70; gy = p.y + Math.sin(i * 2.1 + R.t) * 70; }
      var dx = gx - a.x, dy = gy - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d > 14) { a.x += dx / d * SW.speed * dt; a.y += dy / d * SW.speed * dt; }
      a.cd -= dt;
      if (tg && d < tg.r + 18 && a.cd <= 0) { a.cd = SW.biteCd; Sim.dmgEnemy(R, tg, SW.dmg * s.petDmg, 'swarmling', W.OPT.pet); }
    }
  };
})();
