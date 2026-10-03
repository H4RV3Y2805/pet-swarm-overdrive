/* Pet Swarm: Overdrive - enemies, spawn director, bosses, telegraphed attacks and arena hazards. */
(function () {
  'use strict';
  var PSO = window.PSO, D = PSO.DATA, BAL = D.BAL, Sim = PSO.Sim;
  var En = PSO.Enemies = {};
  var QV = [];
  var COLORS = { grub: '#b65cff', skitter: '#ff8a3d', dasher: '#ff4d6d', spitter: '#8f6bff', puffer: '#ffb02e', brute: '#c0394b', gloop: '#6edb5a', hex: '#aab6c8' };
  En.COLORS = COLORS;

  /* Pre-build weighted mix lists once. */
  var MIX = D.WAVES.map(function (w) { var a = []; for (var k in w.mix) a.push({ type: k, w: w.mix[k] }); return a; });

  function dmgScale(R) { return R.diff.dmg * (1 + Math.min(R.t / 60, 25) * BAL.dmgScalePerMin); }
  function hpScale(R) { var m = R.t / 60; return R.diff.hp * (1 + m * BAL.hpScalePerMin + m * m * BAL.hpScaleQuad); }

  En.spawn = function (R, type, x, y) {
    var def = D.ENEMIES[type], a = R.arena;
    x = Math.max(20, Math.min(a.w - 20, x)); y = Math.max(20, Math.min(a.h - 20, y));
    var e = {
      uid: R.uid++, type: type, def: def, x: x, y: y, r: def.r, color: COLORS[type],
      hp: def.hp * hpScale(R), maxHp: 0, speed: def.speed * R.diff.speed, dmg: def.dmg * dmgScale(R), xp: def.xp,
      touch: (type === 'puffer' ? 0.3 : 1) * def.dmg * dmgScale(R),
      elite: !!def.elite, boss: false, dead: false, flash: 0, spawnT: 0.35,
      burnT: 0, burnDps: 0, burnAcc: 0, slowT: 0, slowF: 1, freezeT: 0, stunT: 0, markT: 0,
      kx: 0, ky: 0, state: 'chase', st: 0, cd: R.rngSpawn.range(0.5, 2), ax: 1, ay: 0, bladeT: -9, cs: 0, ds: 0, wob: R.uid * 1.7
    };
    e.maxHp = e.hp;
    R.enemies.push(e);
    return e;
  };

  /* A point just outside the camera, inside the arena. */
  function spawnPoint(R, out) {
    var p = R.player, a = R.arena, rng = R.rngSpawn, hw = R.viewW / 2 + 40, hh = R.viewH / 2 + 40;
    var dist = Math.sqrt(hw * hw + hh * hh) + 30, x = p.x, y = p.y;
    for (var i = 0; i < 8; i++) {
      var ang = rng.next() * 6.283;
      x = Math.max(30, Math.min(a.w - 30, p.x + Math.cos(ang) * dist));
      y = Math.max(30, Math.min(a.h - 30, p.y + Math.sin(ang) * dist));
      if (Math.abs(x - p.x) > hw - 60 || Math.abs(y - p.y) > hh - 60) break;
    }
    out.x = x; out.y = y;
  }
  var PT = { x: 0, y: 0 };

  function spawnGroup(R, type, n) {
    var rng = R.rngSpawn;
    spawnPoint(R, PT);
    for (var i = 0; i < n; i++) En.spawn(R, type, PT.x + rng.range(-45, 45), PT.y + rng.range(-45, 45));
  }

  function encounter(R) {
    var rng = R.rngSpawn, p = R.player, t = R.t, ok = D.ENCOUNTERS.filter(function (e) { return e.minT <= t; }), i, n, ang;
    if (!ok.length) return;
    var enc = rng.pick(ok), room = BAL.enemyCap - R.enemies.length;
    Sim.banner(R, enc.name, 'warn'); Sim.sfx('warn');
    if (enc.id === 'ring') {
      n = Math.min(48, 26 + Math.floor(t / 60) * 3, room);
      for (i = 0; i < n; i++) { ang = i / n * 6.283; En.spawn(R, 'grub', p.x + Math.cos(ang) * 480, p.y + Math.sin(ang) * 480); }
    } else if (enc.id === 'rush') {
      n = Math.min(12, 5 + Math.floor(t / 90)); ang = rng.next() * 6.283;
      for (i = 0; i < n; i++) En.spawn(R, 'dasher', p.x + Math.cos(ang) * 560 - Math.sin(ang) * (i - n / 2) * 55, p.y + Math.sin(ang) * 560 + Math.cos(ang) * (i - n / 2) * 55);
    } else if (enc.id === 'flood') {
      n = Math.min(45, 22 + Math.floor(t / 45) * 3, room); spawnPoint(R, PT);
      for (i = 0; i < n; i++) En.spawn(R, 'skitter', PT.x + rng.range(-130, 130), PT.y + rng.range(-130, 130));
    } else if (enc.id === 'elite') {
      n = Math.min(4, 1 + Math.floor(t / 240)); spawnPoint(R, PT);
      for (i = 0; i < n; i++) En.spawn(R, 'brute', PT.x + rng.range(-90, 90), PT.y + rng.range(-90, 90));
      for (i = 0; i < 8 && i < room; i++) En.spawn(R, 'grub', PT.x + rng.range(-120, 120), PT.y + rng.range(-120, 120));
    } else if (enc.id === 'bombers') {
      n = Math.min(14, 6 + Math.floor(t / 180));
      for (i = 0; i < n; i++) { ang = rng.next() * 6.283; En.spawn(R, 'puffer', p.x + Math.cos(ang) * 620, p.y + Math.sin(ang) * 620); }
    }
  }

  En.spawnBoss = function (R, type, hpMult) {
    var B = D.BOSSES[type];
    spawnPoint(R, PT);
    var e = En.spawn(R, 'brute', PT.x, PT.y);
    e.type = type; e.def = B; e.boss = true; e.elite = false; e.name = B.name; e.color = COLORS[type]; e.r = B.r;
    e.hp = e.maxHp = B.hp * R.diff.hp * (hpMult || 1) * (R.mods.rate > 1 ? 1.2 : 1);
    e.speed = B.speed; e.dmg = e.touch = B.dmg * dmgScale(R); e.xp = B.xp;
    e.state = 'move'; e.st = 2; e.seq = 0; e.ang = 0; e.lang = 0; e.acc = 0; e.charges = 0; e.spawnT = 0.8;
    e.final = (type === 'hex' && !R.won);
    R.boss = e;
    Sim.banner(R, 'BOSS: ' + B.name, 'boss'); Sim.sfx('boss'); Sim.shake(R, 10);
    return e;
  };

  /* ---------- Director: decides what spawns and when ---------- */
  En.director = function (R, dt) {
    var W = D.WAVES, t = R.t, i = W.length - 1, rate;
    while (i > 0 && W[i].t > t) i--;
    if (W[i + 1]) rate = W[i].rate + (W[i + 1].rate - W[i].rate) * (t - W[i].t) / (W[i + 1].t - W[i].t);
    else rate = W[i].rate + (t - W[i].t) / 60 * D.WAVE_ENDLESS_RATE_PER_MIN;
    rate *= R.diff.rate * R.mods.rate;
    if (R.boss) rate *= D.BOSS_SPAWN_SLOWDOWN;
    if (R.tut && R.tut.step === 0) rate *= 0.5;
    R.spawnAcc += rate * dt;
    var guard = 0;
    while (R.spawnAcc >= 1 && guard++ < 6) {
      if (R.enemies.length >= BAL.enemyCap) { R.spawnAcc = Math.min(R.spawnAcc, 6); break; }
      var m = MIX[i], type = m[R.rngSpawn.weighted(m)].type, def = D.ENEMIES[type];
      var n = R.rngSpawn.int(def.group[0], def.group[1]);
      spawnGroup(R, type, n);
      R.spawnAcc -= n;
    }
    if (t >= R.nextEnc) { R.nextEnc = t + R.rngSpawn.range(D.ENCOUNTER_GAP[0], D.ENCOUNTER_GAP[1]); if (!R.boss) encounter(R); }
    if (R.bossIdx < BAL.bossTimes.length && t >= BAL.bossTimes[R.bossIdx]) {
      En.spawnBoss(R, R.bossIdx === 0 ? 'gloop' : 'hex', 1); R.bossIdx++;
    }
    if (R.endless && !R.boss && t >= R.nextEndlessBoss) {
      R.endlessLoops++;
      En.spawnBoss(R, R.endlessLoops % 2 === 1 ? 'gloop' : 'hex', 1 + R.endlessLoops * BAL.endless.bossHpStep);
      R.nextEndlessBoss = t + BAL.endless.bossEvery;
    }
  };

  /* ---------- Telegraph zones (always hostile, drawn red + striped + "!") ---------- */
  En.zone = function (R, z) { z.t = 0; R.zones.push(z); return z; };
  function inCircle(R, z, pad) { var p = R.player, dx = p.x - z.x, dy = p.y - z.y, rr = z.r + (pad || 0); return dx * dx + dy * dy < rr * rr; }

  function eshot(R, x, y, ang, speed, dmg, r) {
    if (R.eshots.length > 400) return;
    R.eshots.push({ x: x, y: y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, dmg: dmg, r: r || 7, life: 6 });
  }

  function chase(e, tx, ty, spd, dt) {
    var dx = tx - e.x, dy = ty - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    e.x += dx / d * spd * dt; e.y += dy / d * spd * dt;
    e.ax = dx / d; e.ay = dy / d;
    return d;
  }

  /* ---------- Regular enemy AI ---------- */
  function ai(R, e, dt, slow) {
    var p = R.player, def = e.def, dx = p.x - e.x, dy = p.y - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1, spd = e.speed * slow;
    switch (e.type) {
      case 'grub': case 'skitter':
        e.x += dx / d * spd * dt; e.y += dy / d * spd * dt; break;
      case 'dasher':
        if (e.state === 'chase') {
          e.x += dx / d * spd * dt; e.y += dy / d * spd * dt; e.ax = dx / d; e.ay = dy / d;
          e.cd -= dt;
          if (d < def.trigger && e.cd <= 0) {
            e.state = 'wind'; e.st = def.wind;
            var len = def.dashSpeed * def.dashTime;
            En.zone(R, { shape: 'line', x: e.x, y: e.y, x2: e.x + e.ax * len, y2: e.y + e.ay * len, w: e.r + 4, dur: def.wind, owner: e });
          }
        } else if (e.state === 'wind') { e.st -= dt; if (e.st <= 0) { e.state = 'dash'; e.st = def.dashTime; } }
        else { e.st -= dt; e.x += e.ax * def.dashSpeed * slow * dt; e.y += e.ay * def.dashSpeed * slow * dt; if (e.st <= 0) { e.state = 'chase'; e.cd = def.rest; } }
        break;
      case 'spitter':
        if (e.state === 'wind') {
          e.st -= dt;
          if (e.st <= 0) { eshot(R, e.x, e.y, Math.atan2(dy, dx), def.shotSpeed, e.dmg); e.state = 'chase'; e.cd = def.rest; }
        } else {
          if (d > def.far) { e.x += dx / d * spd * dt; e.y += dy / d * spd * dt; }
          else if (d < def.near) { e.x -= dx / d * spd * 0.8 * dt; e.y -= dy / d * spd * 0.8 * dt; }
          else { e.x += -dy / d * spd * 0.5 * dt; e.y += dx / d * spd * 0.5 * dt; }
          e.cd -= dt;
          if (e.cd <= 0 && d < 480) { e.state = 'wind'; e.st = def.wind; }
        }
        break;
      case 'puffer':
        if (e.state === 'chase') {
          e.x += dx / d * spd * dt; e.y += dy / d * spd * dt;
          if (d < def.trigger) {
            e.state = 'swell'; e.st = def.wind;
            En.zone(R, { shape: 'circle', x: e.x, y: e.y, r: def.radius, dur: def.wind, owner: e, fire: pufferPop });
          }
        } else e.st -= dt;
        break;
      case 'brute':
        if (e.state === 'chase') {
          e.x += dx / d * spd * dt; e.y += dy / d * spd * dt; e.cd -= dt;
          if (d < def.trigger && e.cd <= 0) {
            e.state = 'slam'; e.st = def.wind;
            En.zone(R, { shape: 'circle', x: e.x, y: e.y, r: def.radius, dur: def.wind, owner: e, fire: bruteSlam });
          }
        } else { e.st -= dt; if (e.st <= -0.3) { e.state = 'chase'; e.cd = def.rest; } }
        break;
    }
  }
  function pufferPop(R, z) {
    var e = z.owner, def = e.def;
    if (inCircle(R, z, 4)) Sim.hurtPlayer(R, e.dmg, null);
    var list = R.grid.query(z.x, z.y, z.r, QV);
    for (var i = 0; i < list.length; i++) if (list[i] !== e) Sim.dmgEnemy(R, list[i], def.allyDmg, 'hazard', { kind: 'hazard' });
    Sim.ring(R, z.x, z.y, 20, z.r, 0.3, '#ff5a3c', true); Sim.burst(R, z.x, z.y, '#ffb02e', 14, 260, 4); Sim.sfx('boom');
    if (!e.dead) { e.dead = true; Sim.addGem(R, e.x, e.y, e.xp); }
  }
  function bruteSlam(R, z) {
    var e = z.owner;
    if (inCircle(R, z, 4)) Sim.hurtPlayer(R, e.def.slamDmg * dmgScale(R), null);
    Sim.ring(R, z.x, z.y, 20, z.r, 0.3, '#ff5a3c', true); Sim.shake(R, 5); Sim.sfx('boom');
  }

  /* ---------- Boss 1: Gloop King - leaps, charges, slime rings ---------- */
  function gloop(R, e, dt, slow) {
    var B = e.def, p = R.player, i;
    e.st -= dt;
    if (e.state === 'move') {
      chase(e, p.x, p.y, e.speed * slow, dt);
      if (e.st <= 0) {
        e.seq++;
        if (e.seq % 2 === 1) {
          e.state = 'slamWind'; e.st = B.slamWind + 0.2;
          En.zone(R, { shape: 'circle', x: p.x, y: p.y, r: B.slamRadius, dur: B.slamWind, owner: e, fire: gloopLand });
          Sim.sfx('warn');
        } else { e.charges = e.hp < e.maxHp * 0.5 ? 3 : 2; startCharge(R, e); }
      }
    } else if (e.state === 'slamWind') { if (e.st <= 0) { e.state = 'move'; e.st = 1.8; } }
    else if (e.state === 'chargeWind') { if (e.st <= 0) { e.state = 'charge'; e.st = B.chargeTime; } }
    else if (e.state === 'charge') {
      e.x += e.ax * B.chargeSpeed * dt; e.y += e.ay * B.chargeSpeed * dt;
      if (e.st <= 0) { if (--e.charges > 0) startCharge(R, e); else { e.state = 'move'; e.st = 2.2; } }
    }
  }
  function startCharge(R, e) {
    var B = e.def, p = R.player, dx = p.x - e.x, dy = p.y - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1, len = B.chargeSpeed * B.chargeTime;
    e.ax = dx / d; e.ay = dy / d; e.state = 'chargeWind'; e.st = B.chargeWind;
    En.zone(R, { shape: 'line', x: e.x, y: e.y, x2: e.x + e.ax * len, y2: e.y + e.ay * len, w: e.r, dur: B.chargeWind, owner: e });
    Sim.sfx('warn');
  }
  function gloopLand(R, z) {
    var e = z.owner, B = e.def, i, ds = dmgScale(R);
    e.x = z.x; e.y = z.y;
    if (inCircle(R, z, 4)) Sim.hurtPlayer(R, B.slamDmg * ds, null);
    for (i = 0; i < 6 && R.enemies.length < BAL.enemyCap; i++) { var a = i / 6 * 6.283; En.spawn(R, 'grub', z.x + Math.cos(a) * 90, z.y + Math.sin(a) * 90); }
    if (e.hp < e.maxHp * 0.5) for (i = 0; i < B.ringShots; i++) eshot(R, z.x, z.y, i / B.ringShots * 6.283, B.shotSpeed, B.shotDmg * ds, 8);
    Sim.ring(R, z.x, z.y, 30, z.r, 0.35, '#ff5a3c', true); Sim.shake(R, 9); Sim.sfx('boom');
  }

  /* ---------- Boss 2: Hex Engine - bullet spirals, mortars, rotating lasers, summons ---------- */
  function hex(R, e, dt, slow) {
    var B = e.def, p = R.player, i, ds = dmgScale(R), rng = R.rngSpawn;
    e.st -= dt;
    if (e.state !== 'laser' && e.state !== 'laserWind') chase(e, p.x, p.y, e.speed * slow, dt);
    if (e.state === 'move') {
      if (e.st <= 0) {
        e.seq++;
        var pick = e.seq % 4;
        if (pick === 1) { e.state = 'spiral'; e.st = 3.4; e.acc = 0; Sim.ring(R, e.x, e.y, e.r, e.r + 60, 0.4, '#ff5a3c'); Sim.sfx('warn'); }
        else if (pick === 2) {
          for (i = 0; i < B.mortars; i++)
            En.zone(R, { shape: 'circle', x: p.x + rng.range(-230, 230), y: p.y + rng.range(-230, 230), r: B.mortarRadius, dur: B.mortarWind + i * 0.16, owner: e, fire: mortarHit });
          e.state = 'move'; e.st = 3; Sim.sfx('warn');
        } else if (pick === 3) { e.state = 'laserWind'; e.st = B.laserWind; e.lang = Math.atan2(p.y - e.y, p.x - e.x) + 0.785; e.ldir = rng.chance(0.5) ? 1 : -1; Sim.sfx('warn'); }
        else {
          if (e.hp < e.maxHp * 0.6 && R.enemies.length < BAL.enemyCap - 12) {
            En.spawn(R, 'brute', e.x + 80, e.y);
            for (i = 0; i < 10; i++) En.spawn(R, 'skitter', e.x + rng.range(-100, 100), e.y + rng.range(-100, 100));
            Sim.banner(R, 'Reinforcements!', 'warn');
          }
          e.state = 'move'; e.st = 1.6;
        }
      }
    } else if (e.state === 'spiral') {
      e.acc += dt;
      while (e.acc >= 0.14) {
        e.acc -= 0.14; e.ang += 0.26;
        for (i = 0; i < 3; i++) eshot(R, e.x, e.y, e.ang + i * 2.094, B.shotSpeed, B.shotDmg * ds, 7);
      }
      if (e.st <= 0) { e.state = 'move'; e.st = 2; }
    } else if (e.state === 'laserWind') { if (e.st <= 0) { e.state = 'laser'; e.st = B.laserTime; Sim.sfx('zap'); } }
    else if (e.state === 'laser') {
      e.lang += B.laserSpin * e.ldir * dt;
      for (i = 0; i < 4; i++) {
        var a = e.lang + i * 1.5708, ux = Math.cos(a), uy = Math.sin(a);
        var t = (p.x - e.x) * ux + (p.y - e.y) * uy;
        if (t > 0 && t < B.laserLen) { var cx = e.x + ux * t - p.x, cy = e.y + uy * t - p.y; if (cx * cx + cy * cy < 20 * 20) Sim.hurtPlayer(R, B.laserDmg * ds, null); }
      }
      if (e.st <= 0) { e.state = 'move'; e.st = 2.2; }
    }
  }
  function mortarHit(R, z) {
    if (inCircle(R, z, 4)) Sim.hurtPlayer(R, z.owner.def.mortarDmg * dmgScale(R), null);
    Sim.ring(R, z.x, z.y, 16, z.r, 0.3, '#ff5a3c', true); Sim.sfx('boom');
  }

  /* ---------- Per-frame update ---------- */
  En.update = function (R, dt) {
    var es = R.enemies, p = R.player, g = R.grid, a = R.arena, obs = R.obstacles, i, j, e;
    for (i = 0; i < es.length; i++) {
      e = es[i];
      if (e.dead) continue;
      if (e.flash > 0) e.flash -= dt;
      if (e.spawnT > 0) { e.spawnT -= dt; continue; }
      if (e.burnT > 0) {
        e.burnT -= dt; e.burnAcc += dt;
        if (e.burnAcc >= 0.25) { e.burnAcc -= 0.25; Sim.dmgEnemy(R, e, e.burnDps * 0.25, 'burn', { quiet: true, kind: 'burn' }); if (e.dead) continue; }
      }
      if (e.markT > 0) e.markT -= dt;
      var slow = 1;
      if (e.slowT > 0) { e.slowT -= dt; slow = e.slowF; }
      if (e.kx !== 0 || e.ky !== 0) {
        e.x += e.kx * dt; e.y += e.ky * dt; e.kx *= 0.86; e.ky *= 0.86;
        if (Math.abs(e.kx) < 4 && Math.abs(e.ky) < 4) { e.kx = 0; e.ky = 0; }
      }
      if (e.freezeT > 0) e.freezeT -= dt;
      else if (e.stunT > 0) e.stunT -= dt;
      else if (e.boss) { if (e.type === 'gloop') gloop(R, e, dt, slow); else hex(R, e, dt, slow); }
      else ai(R, e, dt, slow);

      /* Soft separation from neighbours in the same grid cell keeps swarms readable. */
      if (!e.boss && e.cell !== undefined) {
        var c = g.cells[e.cell];
        for (j = 0; j < c.length; j++) {
          var o = c[j];
          if (o === e || o.dead || o.boss) continue;
          var sx = e.x - o.x, sy = e.y - o.y, min = (e.r + o.r) * 0.9, d2 = sx * sx + sy * sy;
          if (d2 < min * min && d2 > 0.01) { var sd = Math.sqrt(d2), push = (min - sd) * 0.35; e.x += sx / sd * push; e.y += sy / sd * push; }
        }
      }
      if (obs.length) Sim.pushOut(e, obs);
      if (e.x < e.r) e.x = e.r; else if (e.x > a.w - e.r) e.x = a.w - e.r;
      if (e.y < e.r) e.y = e.r; else if (e.y > a.h - e.r) e.y = a.h - e.r;

      /* Contact damage. */
      var dx = p.x - e.x, dy = p.y - e.y, rr = e.r + p.r - 3;
      if (dx * dx + dy * dy < rr * rr && e.freezeT <= 0) Sim.hurtPlayer(R, e.touch, e);
    }
    /* Remove the dead (swap-remove keeps this O(n)). */
    for (i = es.length - 1; i >= 0; i--) if (es[i].dead) { es[i] = es[es.length - 1]; es.pop(); }

    /* Enemy shots. */
    var sh = R.eshots;
    for (i = sh.length - 1; i >= 0; i--) {
      var s = sh[i], gone = false;
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      var ex = p.x - s.x, ey = p.y - s.y, sr = s.r + p.r - 4;
      if (ex * ex + ey * ey < sr * sr) { Sim.hurtPlayer(R, s.dmg, null); gone = true; }
      else if (s.life <= 0 || s.x < 0 || s.y < 0 || s.x > a.w || s.y > a.h) gone = true;
      else for (j = 0; j < obs.length; j++) { var ox = obs[j].x - s.x, oy = obs[j].y - s.y; if (ox * ox + oy * oy < obs[j].r * obs[j].r) { gone = true; Sim.burst(R, s.x, s.y, '#ff5a3c', 3, 90, 3); break; } }
      if (gone) { sh[i] = sh[sh.length - 1]; sh.pop(); }
    }

    /* Telegraph zones. */
    var zs = R.zones;
    for (i = zs.length - 1; i >= 0; i--) {
      var z = zs[i]; z.t += dt;
      if (z.owner && z.owner.dead) { zs.splice(i, 1); continue; }
      if (z.t >= z.dur) { zs.splice(i, 1); if (z.fire) z.fire(R, z); }
    }

    /* Foundry lava vents: warn, then burn player and enemies alike. */
    var vs = R.vents;
    if (vs.length) {
      var V = a.vent;
      for (i = 0; i < vs.length; i++) {
        var v = vs[i]; v.t -= dt;
        if (v.state === 'idle') { if (v.t <= 0) { v.state = 'warn'; v.t = V.warn; } }
        else if (v.state === 'warn') { if (v.t <= 0) { v.state = 'burn'; v.t = V.burn; v.tick = 0; Sim.sfx('boom'); } }
        else {
          v.tick -= dt;
          if (v.tick <= 0) {
            v.tick = 0.3;
            if (inCircle(R, v, 0)) Sim.hurtPlayer(R, V.dmg * R.diff.dmg, null);
            var list = g.query(v.x, v.y, v.r, QV);
            for (j = 0; j < list.length; j++) Sim.dmgEnemy(R, list[j], V.enemyDmg / 3, 'hazard', { kind: 'hazard', quiet: true });
            Sim.burst(R, v.x, v.y, '#ff8a3d', 10, 240, 5);
          }
          if (v.t <= 0) { v.state = 'idle'; v.t = R.rngSpawn.range(V.idle[0], V.idle[1]); }
        }
      }
    }
  };
})();
