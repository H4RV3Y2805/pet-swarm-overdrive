/* Pet Swarm: Overdrive - weapons and everything they create (shots, bombs, turrets, traps, pools). */
(function () {
  'use strict';
  var PSO = window.PSO, D = PSO.DATA, BAL = D.BAL, Sim = PSO.Sim;
  var W = PSO.Weapons = {};
  var QS = [], QB = [], QT = [], FREE = [];
  var OPT = {
    bolt: { weapon: true, kind: 'bolt' }, turret: { weapon: true, kind: 'turret' }, pet: { pet: true, kind: 'pet' },
    petTurret: { pet: true, kind: 'turret' }, blade: { weapon: true, kind: 'blade' }, beam: { weapon: true, kind: 'beam' },
    tesla: { weapon: true, kind: 'turret', quiet: true }, pool: { pet: true, kind: 'pet', quiet: true }
  };
  W.OPT = OPT;

  /* Pooled friendly projectile. */
  W.shot = function (R, x, y, ang, speed, dmg, pierce, src, optName, color, fz) {
    if (R.shots.length > 500) return;
    var s = FREE.pop() || { hit: [] };
    s.x = x; s.y = y; s.vx = Math.cos(ang) * speed; s.vy = Math.sin(ang) * speed; s.r = 6; s.dmg = dmg; s.pierce = pierce;
    s.life = 1.3; s.src = src; s.opt = OPT[optName]; s.color = color; s.fz = fz || 0; s.hit.length = 0; s.ang = ang;
    R.shots.push(s);
  };

  var FIRE = {
    bolt: function (R, w, dt, L, s, p) {
      w.cd -= dt; if (w.cd > 0) return;
      var t = Sim.nearest(R, p.x, p.y, 410);
      if (!t) { w.cd = 0.12; return; }
      var ang = Math.atan2(t.y - p.y, t.x - p.x), n = L.count + s.multi, i, a, evo = D.WEAPONS.bolt.evo;
      if (w.evolved) {
        for (i = 0; i < n; i++) {
          a = ang + (i - (n - 1) / 2) * 0.2;
          var x2 = p.x + Math.cos(a) * evo.len, y2 = p.y + Math.sin(a) * evo.len;
          Sim.lineHit(R, p.x, p.y, x2, y2, evo.width, evo.dmg * s.dmgMult, 'bolt', OPT.beam);
          Sim.beam(R, p.x, p.y, x2, y2, '#7ef9ff', 12, 0.2, 'rail');
        }
        w.cd = evo.cd * s.cdMult; Sim.sfx('zap');
      } else {
        for (i = 0; i < n; i++) W.shot(R, p.x, p.y, ang + (i - (n - 1) / 2) * 0.13, 660, L.dmg * s.dmgMult, L.pierce, 'bolt', 'bolt', '#7ef9ff');
        w.cd = L.cd * s.cdMult; Sim.sfx('shoot');
      }
    },
    arc: function (R, w, dt, L, s, p) {
      w.cd -= dt; if (w.cd > 0) return;
      var evo = D.WEAPONS.arc.evo, n;
      if (w.evolved) n = Sim.chain(R, p.x, p.y, evo.dmg * s.dmgMult, evo.jumps + 2 * s.multi, 'arc', { weapon: true, blast: evo.blast, stun: evo.stun, w: 5, color: '#efe4ff' });
      else n = Sim.chain(R, p.x, p.y, L.dmg * s.dmgMult, L.jumps + 2 * s.multi, 'arc', { weapon: true });
      w.cd = n ? (w.evolved ? evo.cd : L.cd) * s.cdMult : 0.15;
    },
    blades: function (R, w, dt, L, s, p) {
      var def = D.WEAPONS.blades, evo = def.evo, boost = 1 + (R.syn.x_halo ? R.haloStacks * 0.03 : 0);
      var n = L.count + s.multi, dmg = (w.evolved ? evo.dmg : L.dmg) * s.dmgMult, br = 15 * boost, pts = w.pts || (w.pts = []), k = 0, i, j;
      w.ang += L.spin * boost * dt; w.br = br;
      var rings = w.evolved ? 2 : 1;
      for (var ring = 0; ring < rings; ring++) {
        var rad = !w.evolved ? L.radius * (0.9 + 0.1 * boost) : ring === 0 ? evo.inner : evo.outerMin + (evo.outerMax - evo.outerMin) * (0.5 + 0.5 * Math.sin(R.t * 1.7));
        var dir = ring === 0 ? 1 : -0.7;
        for (i = 0; i < n; i++) {
          var a = w.ang * dir + i / n * 6.283, bx = p.x + Math.cos(a) * rad, by = p.y + Math.sin(a) * rad;
          pts[k++] = bx; pts[k++] = by;
          var list = R.grid.query(bx, by, br, QB);
          for (j = 0; j < list.length; j++) {
            var e = list[j];
            if (R.t - e.bladeT < def.hitCd) continue;
            e.bladeT = R.t; Sim.dmgEnemy(R, e, dmg, 'blades', OPT.blade); Sim.knock(e, p.x, p.y, 70);
          }
        }
      }
      pts.length = k;
    },
    boom: function (R, w, dt, L, s, p) {
      w.cd -= dt; if (w.cd > 0) return;
      var n = L.count + s.multi, dmg = (w.evolved ? D.WEAPONS.boom.evo.dmg : L.dmg) * s.dmgMult, any = false;
      for (var i = 0; i < n; i++) {
        var t = Sim.randomEnemy(R, p.x, p.y, 480);
        if (!t) break;
        any = true;
        R.bombs.push({ x0: p.x, y0: p.y, x1: t.x, y1: t.y, t: 0, dur: 0.55, dmg: dmg, radius: L.radius, src: 'boom', mini: false, evo: w.evolved, kind: 'bomb' });
      }
      w.cd = any ? L.cd * s.cdMult : 0.2;
      if (any) Sim.sfx('shoot');
    },
    sentry: function () { /* turrets are handled by the shared turret system below */ }
  };

  function updTurrets(R, dt) {
    var s = R.stats, p = R.player, ts = R.turrets, i, t, n = 0;
    for (i = 0; i < ts.length; i++) if (!ts[i].bonus) n++;
    if (s.turretCap > 0) {
      R.turretT -= dt;
      if (R.turretT <= 0) {
        R.turretT = s.turretInterval;
        if (n >= s.turretCap) for (i = 0; i < ts.length; i++) if (!ts[i].bonus) { ts.splice(i, 1); break; }   // oldest moves to you
        ts.push({ x: p.x, y: p.y, life: s.turretLife, cd: 0.2, ang: 0, bonus: false, salv: 0 });
        R.turretsDeployed++; Sim.ring(R, p.x, p.y, 6, 30, 0.25, '#3ddbc4'); Sim.sfx('deploy');
      }
    }
    if (ts.length > R.maxTurrets) R.maxTurrets = ts.length;
    var rate = s.turretRate * (R.rallyT > 0 ? 2 : 1), dmg = s.turretDmg * s.dmgMult;
    for (i = ts.length - 1; i >= 0; i--) {
      t = ts[i];
      if (!s.tesla || t.bonus) { t.life -= dt; if (t.life <= 0) { ts.splice(i, 1); continue; } }
      t.cd -= dt * rate;
      if (t.cd <= 0) {
        var e = Sim.nearest(R, t.x, t.y, BAL.turret.range);
        if (e) {
          t.ang = Math.atan2(e.y - t.y, e.x - t.x); t.cd = s.turretCd;
          if (s.multi) { W.shot(R, t.x, t.y, t.ang - 0.09, BAL.turret.shotSpeed, dmg, s.turretPierce, 'turret', 'turret', '#3ddbc4'); W.shot(R, t.x, t.y, t.ang + 0.09, BAL.turret.shotSpeed, dmg, s.turretPierce, 'turret', 'turret', '#3ddbc4'); }
          else W.shot(R, t.x, t.y, t.ang, BAL.turret.shotSpeed, dmg, s.turretPierce, 'turret', 'turret', '#3ddbc4');
          Sim.sfx('turret');
        } else t.cd = 0.15;
      }
      if (R.tech.e_salvage) {
        t.salv -= dt;
        if (t.salv <= 0) { t.salv = 0.4; for (var g = 0; g < R.gems.length; g++) { var gm = R.gems[g]; if (!gm.mag) { var gx = gm.x - t.x, gy = gm.y - t.y; if (gx * gx + gy * gy < 150 * 150) gm.mag = true; } } }
      }
    }
    /* Tesla Bastion: lightning fences between turrets and the player. */
    var links = R.links || (R.links = []); links.length = 0;
    if (s.tesla && ts.length) {
      var evo = D.WEAPONS.sentry.evo, lr2 = evo.linkRange * evo.linkRange, a, b, j;
      for (i = 0; i <= ts.length; i++) for (j = i + 1; j <= ts.length; j++) {
        a = i === ts.length ? p : ts[i]; b = j === ts.length ? p : ts[j];
        var lx = a.x - b.x, ly = a.y - b.y;
        if (lx * lx + ly * ly < lr2) links.push(a.x, a.y, b.x, b.y);
      }
      R.teslaT -= dt;
      if (R.teslaT <= 0) {
        R.teslaT = 0.2;
        for (i = 0; i < links.length; i += 4) Sim.lineHit(R, links[i], links[i + 1], links[i + 2], links[i + 3], 12, evo.linkDps * 0.2 * s.dmgMult, 'turret', OPT.tesla);
      }
    }
  }

  function updTraps(R, dt) {
    var p = R.player, tp = R.traps, i, n = 0;
    if (R.tech.e_trap) {
      R.trapT -= dt;
      if (R.trapT <= 0) {
        R.trapT = BAL.trap.interval;
        for (i = 0; i < tp.length; i++) if (!tp[i].mine) n++;
        if (n >= BAL.trap.max) for (i = 0; i < tp.length; i++) if (!tp[i].mine) { tp.splice(i, 1); break; }
        tp.push({ x: p.x, y: p.y, arm: 0.4, dmg: BAL.trap.dmg * (1 + 0.06 * R.level), radius: BAL.trap.radius, root: BAL.trap.root, mine: false });
      }
    }
    for (i = tp.length - 1; i >= 0; i--) {
      var t = tp[i];
      if (t.arm > 0) { t.arm -= dt; continue; }
      if (R.grid.query(t.x, t.y, 20, QT).length) {
        tp.splice(i, 1);
        if (t.mine) Sim.explode(R, t.x, t.y, t.radius, t.dmg, 'cog', { kind: 'trap', pet: true, color: '#d9a066' });
        else Sim.explode(R, t.x, t.y, t.radius, t.dmg, 'trap', { kind: 'trap', root: t.root, color: '#3ddbc4' });
      }
    }
  }

  function updBombs(R, dt) {
    var bs = R.bombs, rc = R.rngCombat, i, k;
    for (i = bs.length - 1; i >= 0; i--) {
      var b = bs[i]; b.t += dt;
      if (b.t < b.dur) continue;
      bs.splice(i, 1);
      if (b.kind === 'fireball') {
        Sim.explode(R, b.x1, b.y1, 55, b.dmg, 'ember', { pet: true, kind: 'pet', burn: true, color: '#ff7b3a' });
        R.pools.push({ x: b.x1, y: b.y1, r: b.radius, life: b.life, dps: b.dps, tick: 0 });
        continue;
      }
      Sim.explode(R, b.x1, b.y1, b.radius, b.dmg, b.src, { weapon: true });
      if (b.evo && !b.mini) {
        var n = D.WEAPONS.boom.evo.minis, a0 = rc.next() * 6.283;
        for (k = 0; k < n; k++) {
          var a = a0 + k / n * 6.283, dist = 75 + rc.next() * 40;
          bs.push({ x0: b.x1, y0: b.y1, x1: b.x1 + Math.cos(a) * dist, y1: b.y1 + Math.sin(a) * dist, t: 0, dur: 0.32, dmg: b.dmg * 0.5, radius: b.radius * 0.62, src: 'boom', mini: true, evo: false, kind: 'bomb' });
        }
      }
    }
    var ps = R.pools;
    for (i = ps.length - 1; i >= 0; i--) {
      var pl = ps[i]; pl.life -= dt; pl.tick -= dt;
      if (pl.life <= 0) { ps.splice(i, 1); continue; }
      if (pl.tick <= 0) {
        pl.tick = 0.5;
        var list = R.grid.query(pl.x, pl.y, pl.r, QT);
        for (k = 0; k < list.length; k++) { Sim.dmgEnemy(R, list[k], pl.dps * 0.5, 'ember', OPT.pool); if (!list[k].dead) Sim.burn(list[k], pl.dps * 0.6, 2); }
      }
    }
  }

  function updShots(R, dt) {
    var sh = R.shots, a = R.arena, i, j;
    for (i = sh.length - 1; i >= 0; i--) {
      var s = sh[i]; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      var gone = s.life <= 0 || s.x < -20 || s.y < -20 || s.x > a.w + 20 || s.y > a.h + 20;
      if (!gone) {
        var list = R.grid.query(s.x, s.y, s.r, QS);
        for (j = 0; j < list.length; j++) {
          var e = list[j];
          if (s.hit.indexOf(e.uid) >= 0) continue;
          s.hit.push(e.uid);
          Sim.dmgEnemy(R, e, s.dmg, s.src, s.opt);
          if (s.fz && !e.dead) Sim.freeze(e, s.fz);
          if (--s.pierce < 0) { gone = true; break; }
        }
      }
      if (gone) { FREE.push(s); sh[i] = sh[sh.length - 1]; sh.pop(); }
    }
  }

  W.update = function (R, dt) {
    var s = R.stats, p = R.player;
    for (var i = 0; i < R.weapons.length; i++) {
      var w = R.weapons[i];
      FIRE[w.id](R, w, dt, D.WEAPONS[w.id].lv[w.lvl - 1], s, p);
    }
    updTurrets(R, dt);
    updTraps(R, dt);
    updBombs(R, dt);
    updShots(R, dt);
  };
})();
