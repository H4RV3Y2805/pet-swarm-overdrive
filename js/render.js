/* Pet Swarm: Overdrive - Canvas 2D renderer (world + HUD). No DOM work happens during combat. */
(function () {
  'use strict';
  var PSO = window.PSO, D = PSO.DATA, BAL = D.BAL, S = PSO.Sprites, Sim = PSO.Sim;
  var Rn = PSO.Render = {};
  var cv, ctx, W = 1280, H = 720, scale = 1, camX = 0, camY = 0, vw = 1280, vh = 720;
  var decos = {}, stripes = null, icons = {}, fx = PSO.fxRng;
  var FONT = 'Bahnschrift, "Segoe UI", "Trebuchet MS", sans-serif', INK = '#1b1233';

  Rn.init = function (canvas) {
    cv = canvas; ctx = cv.getContext('2d', { alpha: false });
    S.init();
    stripes = ctx.createPattern(S.misc.stripesSrc, 'repeat');
    for (var k in D.ARENAS) decos[k] = deco(k);
    ['bolt', 'arc', 'blades', 'boom', 'sentry', 'dash', 'clap', 'rally'].forEach(function (id) { icons[id] = S.icon('ui', id, 44); });
    for (k in D.PETS) icons[k] = S.icon('pet', k, 44);
    Rn.resize();
  };

  /* Ground decoration: one tiny sprite per arena, stamped a few times per 160px cell.
     (A full-screen repeating pattern fill measured ~30% slower without GPU acceleration.) */
  var DECO_POS = [22, 30, 110, 48, 60, 118, 134, 130];
  function deco(id) {
    var c = document.createElement('canvas'); c.width = c.height = 20;
    var x = c.getContext('2d'); x.globalAlpha = 0.4; x.translate(10, 12);
    if (id === 'meadow') { x.strokeStyle = '#8fe3a8'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(-3, -8); x.moveTo(0, 0); x.lineTo(4, -7); x.stroke(); }
    else if (id === 'cavern') { x.fillStyle = '#a9b4ff'; x.beginPath(); x.moveTo(0, -7); x.lineTo(4, -2); x.lineTo(0, 3); x.lineTo(-4, -2); x.fill(); }
    else { x.strokeStyle = '#ff8a3d'; x.lineWidth = 2; x.beginPath(); x.moveTo(-7, -2); x.lineTo(0, -2); x.lineTo(4, 2); x.lineTo(8, 2); x.stroke(); }
    return c;
  }
  function ground(a, id, x0, y0, x1, y1, low) {
    var gx0 = Math.max(0, x0), gy0 = Math.max(0, y0), gx1 = Math.min(a.w, x1), gy1 = Math.min(a.h, y1), cx, cy, i;
    if (gx1 <= gx0 || gy1 <= gy0) return;
    ctx.fillStyle = a.ground; ctx.fillRect(gx0, gy0, gx1 - gx0, gy1 - gy0);
    ctx.fillStyle = a.ground2;
    for (cy = Math.floor(gy0 / 80); cy * 80 < gy1; cy++) for (cx = Math.floor(gx0 / 80); cx * 80 < gx1; cx++) {
      if ((cx + cy) & 1) continue;
      var rx = Math.max(gx0, cx * 80), ry = Math.max(gy0, cy * 80);
      ctx.fillRect(rx, ry, Math.min(gx1, cx * 80 + 80) - rx, Math.min(gy1, cy * 80 + 80) - ry);
    }
    if (low) return;
    var d = decos[id];
    for (cy = Math.floor(gy0 / 160); cy * 160 < gy1; cy++) for (cx = Math.floor(gx0 / 160); cx * 160 < gx1; cx++)
      for (i = 0; i < 8; i += 2) { var px = cx * 160 + DECO_POS[i], py = cy * 160 + DECO_POS[i + 1]; if (px > 10 && py > 12 && px < a.w - 10 && py < a.h - 8) ctx.drawImage(d, px - 10, py - 12); }
  }

  Rn.resize = function () {
    W = cv.width = Math.max(320, window.innerWidth); H = cv.height = Math.max(240, window.innerHeight);
    scale = H / BAL.viewH;
    if (W / scale < 980) scale = W / 980;       // narrow windows: keep a playable field of view
    vw = W / scale; vh = H / scale;
  };

  function txt(str, x, y, size, color, align, bold) {
    ctx.font = (bold === false ? '600 ' : '700 ') + size + 'px ' + FONT; ctx.textAlign = align || 'left';
    ctx.lineWidth = Math.max(3, size / 5); ctx.strokeStyle = INK; ctx.strokeText(str, x, y);
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  }
  function bar(x, y, w, h, f, color, back) {
    ctx.fillStyle = INK; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    ctx.fillStyle = back || '#3a2f5e'; ctx.fillRect(x, y, w, h);
    if (f > 0) { ctx.fillStyle = color; ctx.fillRect(x, y, w * Math.min(1, f), h); }
  }
  function mmss(t) { var m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + (s < 10 ? '0' : '') + s; }
  Rn.mmss = mmss;

  /* Hostile telegraph: red fill + stripes + bold outline + growing inner shape + "!" (never colour alone). */
  function hostileCircle(x, y, r, f) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832);
    ctx.fillStyle = 'rgba(255,40,40,0.16)'; ctx.fill(); ctx.fillStyle = stripes; ctx.fill();
    ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 4; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r * f, 0, 6.2832); ctx.fillStyle = 'rgba(255,60,60,0.3)'; ctx.fill();
    txt('!', x, y + 12, 34, '#ffffff', 'center');
  }
  function hostileLine(z, f) {
    var dx = z.x2 - z.x, dy = z.y2 - z.y, len = Math.sqrt(dx * dx + dy * dy);
    ctx.save(); ctx.translate(z.x, z.y); ctx.rotate(Math.atan2(dy, dx));
    ctx.fillStyle = 'rgba(255,40,40,0.16)'; ctx.fillRect(0, -z.w, len, z.w * 2);
    ctx.fillStyle = stripes; ctx.fillRect(0, -z.w, len, z.w * 2);
    ctx.fillStyle = 'rgba(255,60,60,0.3)'; ctx.fillRect(0, -z.w, len * f, z.w * 2);
    ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 4; ctx.strokeRect(0, -z.w, len, z.w * 2);
    ctx.restore();
    txt('!', z.x + dx * 0.5, z.y + dy * 0.5 + 12, 30, '#ffffff', 'center');
  }

  function zap(b, a) {
    var dx = b.x2 - b.x1, dy = b.y2 - b.y1, len = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / len, ny = dx / len, seg = Math.max(2, Math.min(7, Math.floor(len / 34)));
    ctx.beginPath(); ctx.moveTo(b.x1, b.y1);
    for (var i = 1; i < seg; i++) { var o = (fx.next() - 0.5) * 22; ctx.lineTo(b.x1 + dx * i / seg + nx * o, b.y1 + dy * i / seg + ny * o); }
    ctx.lineTo(b.x2, b.y2);
    ctx.globalAlpha = a; ctx.strokeStyle = b.color; ctx.lineWidth = b.w + 3; ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, b.w - 1.5); ctx.stroke();
  }

  Rn.draw = function (R, settings, perf) {
    var p = R.player, a = R.arena, i, e, low = settings.lowFx;
    R.viewW = vw; R.viewH = vh;
    /* The camera may look a little past the arena edge so the player never hides under the HUD corners. */
    var mgx = Math.min(340, vw * 0.3), mgy = Math.min(200, vh * 0.3);
    camX = Math.max(-mgx, Math.min(a.w - vw + mgx, p.x - vw / 2));
    camY = Math.max(-mgy, Math.min(a.h - vh + mgy, p.y - vh / 2));
    var shx = 0, shy = 0;
    if (settings.shake && R.shake > 0.5) { shx = (fx.next() - 0.5) * R.shake; shy = (fx.next() - 0.5) * R.shake; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = a.edge; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(scale, 0, 0, scale, (-camX + shx) * scale, (-camY + shy) * scale);
    var x0 = camX - 80, y0 = camY - 80, x1 = camX + vw + 80, y1 = camY + vh + 80;
    function vis(o) { return o.x > x0 && o.x < x1 && o.y > y0 && o.y < y1; }

    /* Ground */
    ground(a, R.arenaId, x0, y0, x1, y1, low);
    ctx.strokeStyle = INK; ctx.lineWidth = 10; ctx.strokeRect(0, 0, a.w, a.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3; ctx.strokeRect(6, 6, a.w - 12, a.h - 12);

    /* Crystal pillars (Caverns): solid obstacles */
    for (i = 0; i < R.obstacles.length; i++) { var ob = R.obstacles[i]; if (ob.x < x0 - 80 || ob.x > x1 + 80 || ob.y < y0 - 80 || ob.y > y1 + 80) continue; var os = ob.r * 2.6; ctx.drawImage(S.misc.rock, ob.x - os / 2, ob.y - os / 2, os, os); }
    /* Lava vents (Foundry) */
    for (i = 0; i < R.vents.length; i++) {
      var v = R.vents[i]; if (!vis(v) && Math.abs(v.x - p.x) > vw) continue;
      if (v.state === 'idle') { ctx.beginPath(); ctx.arc(v.x, v.y, v.r * 0.5, 0, 6.2832); ctx.fillStyle = '#2a1a17'; ctx.fill(); ctx.strokeStyle = '#ff8a3d'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.stroke(); ctx.setLineDash([]); }
      else if (v.state === 'warn') hostileCircle(v.x, v.y, v.r, 1 - v.t / a.vent.warn);
      else { ctx.beginPath(); ctx.arc(v.x, v.y, v.r, 0, 6.2832); ctx.fillStyle = 'rgba(255,120,30,0.75)'; ctx.fill(); ctx.fillStyle = stripes; ctx.fill(); ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 6; ctx.stroke(); ctx.beginPath(); ctx.arc(v.x, v.y, v.r * 0.55, 0, 6.2832); ctx.fillStyle = '#ffe9a8'; ctx.fill(); }
    }
    /* Friendly fire pools (dotted outline, no stripes) */
    for (i = 0; i < R.pools.length; i++) {
      var pl = R.pools[i]; ctx.beginPath(); ctx.arc(pl.x, pl.y, pl.r, 0, 6.2832);
      ctx.fillStyle = 'rgba(255,170,60,' + (0.22 + 0.08 * Math.sin(R.t * 9 + i)) + ')'; ctx.fill();
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2; ctx.setLineDash([4, 6]); ctx.stroke(); ctx.setLineDash([]);
    }
    /* Hostile telegraphs */
    for (i = 0; i < R.zones.length; i++) { var z = R.zones[i], f = Math.min(1, z.t / z.dur); if (z.shape === 'circle') hostileCircle(z.x, z.y, z.r, f); else hostileLine(z, f); }

    /* Traps, gems, pickups */
    for (i = 0; i < R.traps.length; i++) { var tp = R.traps[i]; ctx.globalAlpha = tp.arm > 0 ? 0.5 : 1; ctx.drawImage(tp.mine ? S.misc.mine : S.misc.trap, tp.x - 17, tp.y - 17); }
    ctx.globalAlpha = 1;
    var gs = R.gems;
    for (i = 0; i < gs.length; i++) { var g = gs[i]; if (g.x < x0 || g.x > x1 || g.y < y0 || g.y > y1) continue; var gi = g.v >= 25 ? 2 : g.v >= 5 ? 1 : 0, gim = S.gem[gi]; ctx.drawImage(gim, g.x - gim.width / 2, g.y - gim.height / 2); }
    for (i = 0; i < R.pickups.length; i++) { var pk = R.pickups[i], pim = pk.kind === 'chest' ? S.misc.chest : S.misc.heal, bob = Math.sin(pk.t * 5) * 3; ctx.drawImage(pim, pk.x - pim.width / 2, pk.y - pim.height / 2 + bob); }

    /* Turrets and Tesla fences */
    if (R.links && R.links.length) {
      ctx.strokeStyle = '#7ef9ff'; ctx.lineWidth = 5; ctx.globalAlpha = 0.55 + 0.3 * Math.sin(R.t * 30); ctx.beginPath();
      for (i = 0; i < R.links.length; i += 4) { ctx.moveTo(R.links[i], R.links[i + 1]); ctx.lineTo(R.links[i + 2], R.links[i + 3]); }
      ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;
    }
    for (i = 0; i < R.turrets.length; i++) {
      var t = R.turrets[i]; ctx.drawImage(S.misc.turret, t.x - 20, t.y - 20);
      ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x + Math.cos(t.ang) * 18, t.y + Math.sin(t.ang) * 18); ctx.stroke();
      ctx.strokeStyle = '#e8f1ff'; ctx.lineWidth = 4; ctx.stroke();
      if (!R.stats.tesla || t.bonus) { ctx.fillStyle = INK; ctx.fillRect(t.x - 14, t.y + 20, 28, 5); ctx.fillStyle = '#3ddbc4'; ctx.fillRect(t.x - 13, t.y + 21, 26 * Math.max(0, Math.min(1, t.life / R.stats.turretLife)), 3); }
    }

    /* Enemies */
    var es = R.enemies, drawn = 0;
    for (i = 0; i < es.length; i++) {
      e = es[i]; if (e.x < x0 || e.x > x1 || e.y < y0 || e.y > y1) continue;
      drawn++;
      var sp = S.enemy[e.type], img = e.flash > 0 ? sp.flash : sp.img, half = sp.half;
      if (e.spawnT > 0) ctx.globalAlpha = Math.max(0.15, 1 - e.spawnT / 0.35);
      if (e.type === 'dasher') { ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(Math.atan2(e.ay, e.ax)); ctx.drawImage(img, -half, -half); ctx.restore(); }
      else if (e.state === 'swell') { var k = 1 + (1 - e.st / e.def.wind) * 0.5; ctx.drawImage(img, e.x - half * k, e.y - half * k, half * 2 * k, half * 2 * k); }
      else ctx.drawImage(img, e.x - half, e.y - half);
      if (e.spawnT > 0) ctx.globalAlpha = 1;
      if (e.freezeT > 0) { ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 3, 0, 6.2832); ctx.fillStyle = 'rgba(174,234,255,0.55)'; ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke(); }
      else if (e.slowT > 0 && !low) { ctx.beginPath(); ctx.arc(e.x, e.y + e.r, 4, 0, 6.2832); ctx.fillStyle = '#aeeaff'; ctx.fill(); }
      if (e.burnT > 0 && !low) { ctx.beginPath(); ctx.moveTo(e.x, e.y - e.r - 10); ctx.lineTo(e.x + 4, e.y - e.r - 2); ctx.lineTo(e.x - 4, e.y - e.r - 2); ctx.fillStyle = '#ff9a3d'; ctx.fill(); }
      if (e.markT > 0) { ctx.strokeStyle = '#ff6f91'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 5, 0, 6.2832); ctx.moveTo(e.x - e.r - 9, e.y); ctx.lineTo(e.x - e.r - 2, e.y); ctx.moveTo(e.x + e.r + 2, e.y); ctx.lineTo(e.x + e.r + 9, e.y); ctx.stroke(); }
      if (e.type === 'spitter' && e.state === 'wind') txt('!', e.x, e.y - e.r - 8, 22, '#ff3b3b', 'center');
      if (e.elite && e.hp < e.maxHp) { ctx.fillStyle = INK; ctx.fillRect(e.x - 22, e.y - e.r - 14, 44, 6); ctx.fillStyle = '#ff4d6d'; ctx.fillRect(e.x - 21, e.y - e.r - 13, 42 * e.hp / e.maxHp, 4); }
    }
    /* Hex Engine lasers */
    var bs = R.boss;
    if (bs && (bs.state === 'laserWind' || bs.state === 'laser')) {
      var live = bs.state === 'laser', L = bs.def.laserLen;
      for (i = 0; i < 4; i++) {
        var la = bs.lang + i * 1.5708, lx = bs.x + Math.cos(la) * L, ly = bs.y + Math.sin(la) * L;
        ctx.beginPath(); ctx.moveTo(bs.x, bs.y); ctx.lineTo(lx, ly);
        if (live) { ctx.strokeStyle = INK; ctx.lineWidth = 34; ctx.stroke(); ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 26; ctx.stroke(); ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 8; ctx.stroke(); }
        else { ctx.strokeStyle = 'rgba(255,60,60,0.35)'; ctx.lineWidth = 30; ctx.stroke(); ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 3; ctx.setLineDash([14, 10]); ctx.stroke(); ctx.setLineDash([]); }
      }
      if (!live) txt('!', bs.x, bs.y - bs.r - 14, 36, '#ffffff', 'center');
    }

    /* Allies, pets, player */
    for (i = 0; i < R.allies.length; i++) ctx.drawImage(S.misc.swarmling, R.allies[i].x - 13, R.allies[i].y - 13);
    for (i = 0; i < R.pets.length; i++) {
      var pet = R.pets[i], bobp = Math.sin(R.t * 6 + i * 2) * 2, ps = pet.act > 0 ? 1.2 : 1;
      if (R.frenzyT > 0 || R.rallyT > 0) { ctx.beginPath(); ctx.arc(pet.x, pet.y + bobp, 22, 0, 6.2832); ctx.strokeStyle = D.PETS[pet.id].color; ctx.lineWidth = 3; ctx.stroke(); }
      ctx.drawImage(S.pet[pet.id], pet.x - 26 * ps, pet.y - 26 * ps + bobp, 52 * ps, 52 * ps);
    }
    if (R.barrierReady) { ctx.strokeStyle = '#5aa9ff'; ctx.lineWidth = 3; ctx.beginPath(); for (i = 0; i <= 6; i++) { var ha = i * 1.0472 + R.t; if (i) ctx.lineTo(p.x + Math.cos(ha) * 27, p.y + Math.sin(ha) * 27); else ctx.moveTo(p.x + Math.cos(ha) * 27, p.y + Math.sin(ha) * 27); } ctx.stroke(); }
    if (p.shield > 0) { ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, 6.2832); ctx.fillStyle = 'rgba(61,219,196,0.18)'; ctx.fill(); ctx.strokeStyle = '#3ddbc4'; ctx.lineWidth = 2.5; ctx.stroke(); }
    if (!(p.iframes > 0 && Math.floor(R.t * 20) % 2 === 0 && R.state !== 'dead')) ctx.drawImage(S.player[R.charId], p.x - 28, p.y - 28);
    if (p.hurtFlash > 0) { ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, 6.2832); ctx.fillStyle = 'rgba(255,60,60,0.45)'; ctx.fill(); }

    /* Blades */
    for (i = 0; i < R.weapons.length; i++) {
      var w = R.weapons[i];
      if (w.id !== 'blades' || !w.pts) continue;
      var bsz = 48 * (w.br / 15) * (w.evolved ? 1.2 : 1);
      for (var j = 0; j < w.pts.length; j += 2) { ctx.save(); ctx.translate(w.pts[j], w.pts[j + 1]); ctx.rotate(R.t * 14); ctx.drawImage(S.misc.blade, -bsz / 2, -bsz / 2, bsz, bsz); ctx.restore(); }
    }
    /* Friendly shots: short bright streaks */
    var sh = R.shots, lastCol = null;
    ctx.lineCap = 'round'; ctx.lineWidth = 5;
    for (i = 0; i < sh.length; i++) {
      var s = sh[i]; if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue;
      if (s.color !== lastCol) { if (lastCol) ctx.stroke(); ctx.beginPath(); ctx.strokeStyle = s.color; lastCol = s.color; }
      ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.022, s.y - s.vy * 0.022);
    }
    if (lastCol) ctx.stroke();
    ctx.lineCap = 'butt';
    /* Enemy shots: red spiky stars with dark outline */
    var esh = R.eshots;
    for (i = 0; i < esh.length; i++) { var q = esh[i]; if (q.x < x0 || q.x > x1 || q.y < y0 || q.y > y1) continue; ctx.drawImage(S.misc.eshot, q.x - 15, q.y - 15); }
    /* Bombs in flight (landing spot shown as thin friendly ring) */
    for (i = 0; i < R.bombs.length; i++) {
      var b = R.bombs[i], bf = b.t / b.dur, bx = b.x0 + (b.x1 - b.x0) * bf, by = b.y0 + (b.y1 - b.y0) * bf - Math.sin(bf * 3.1416) * 70;
      ctx.beginPath(); ctx.arc(b.x1, b.y1, 10, 0, 6.2832); ctx.strokeStyle = 'rgba(255,209,102,0.7)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(bx, by, b.mini ? 5 : 8, 0, 6.2832); ctx.fillStyle = b.kind === 'fireball' ? '#ff7b3a' : '#3a3355'; ctx.fill(); ctx.strokeStyle = b.kind === 'fireball' ? '#ffd166' : INK; ctx.lineWidth = 2.5; ctx.stroke();
    }
    /* Beams, rings, particles, numbers */
    for (i = 0; i < R.beams.length; i++) {
      var bm = R.beams[i], al = bm.life / bm.max;
      if (bm.kind === 'zap') zap(bm, al);
      else { ctx.globalAlpha = al; ctx.beginPath(); ctx.moveTo(bm.x1, bm.y1); ctx.lineTo(bm.x2, bm.y2); ctx.strokeStyle = bm.color; ctx.lineWidth = bm.w * (bm.kind === 'rail' ? 0.5 + al : 1); ctx.stroke(); if (bm.kind === 'rail') { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = bm.w * 0.3; ctx.stroke(); } }
    }
    for (i = 0; i < R.rings.length; i++) {
      var rg = R.rings[i], rf = 1 - rg.life / rg.max, rr = rg.r0 + (rg.r1 - rg.r0) * rf;
      ctx.globalAlpha = Math.max(0, 1 - rf); ctx.beginPath();
      if (rg.cone !== undefined) { ctx.moveTo(rg.x, rg.y); ctx.arc(rg.x, rg.y, rr, rg.cone - 0.6, rg.cone + 0.6); ctx.closePath(); }
      else ctx.arc(rg.x, rg.y, rr, 0, 6.2832);
      if (rg.fill) { ctx.fillStyle = rg.color; ctx.globalAlpha *= 0.35; ctx.fill(); ctx.globalAlpha = Math.max(0, 1 - rf); }
      ctx.strokeStyle = rg.color; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.globalAlpha = 1;
    var pr = R.parts;
    for (i = 0; i < pr.length; i++) { var pt = pr[i]; ctx.globalAlpha = pt.life / pt.max; ctx.fillStyle = pt.color; ctx.fillRect(pt.x - pt.size, pt.y - pt.size, pt.size * 2, pt.size * 2); }
    ctx.globalAlpha = 1;
    for (i = 0; i < R.texts.length; i++) { var tx = R.texts[i]; ctx.globalAlpha = Math.min(1, tx.life * 3); txt(tx.str, tx.x, tx.y, tx.size, tx.color, 'center'); }
    ctx.globalAlpha = 1;

    hud(R, settings, perf, drawn);
  };

  function chip(label, x, y, color) {
    ctx.font = '700 ' + 15 + 'px ' + FONT; var w = ctx.measureText(label).width + 16;
    ctx.fillStyle = INK; ctx.fillRect(x, y, w, 24); ctx.fillStyle = color; ctx.fillRect(x, y + 20, w, 4);
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.fillText(label, x + 8, y + 17);
    return w + 6;
  }

  function hud(R, settings, perf, drawn) {
    var u = Math.max(0.8, Math.min(1.5, H / 760)), p = R.player, s = R.stats, i;
    ctx.setTransform(u, 0, 0, u, 0, 0);
    var w = W / u, h = H / u;
    /* XP bar across the top */
    bar(8, 8, w - 16, 14, R.xp / R.xpNext, '#59e0ff');
    txt('Level ' + R.level, 14, 44, 20, '#ffffff');
    /* HP */
    bar(14, 56, 260, 22, p.hp / s.maxHp, p.hp / s.maxHp < 0.3 ? '#ff3b3b' : '#ff5d73');
    if (s.shieldMax > 0) { ctx.fillStyle = '#3ddbc4'; ctx.fillRect(14, 78 - 5, 260 * (p.shield / s.shieldMax), 5); }
    txt('HP ' + Math.ceil(p.hp) + ' / ' + s.maxHp + (s.shieldMax > 0 ? '   Shield ' + Math.ceil(p.shield) : ''), 22, 73, 15, '#ffffff');
    /* Weapons and pets */
    var x = 14, y = 92;
    for (i = 0; i < R.weapons.length; i++) {
      var wp = R.weapons[i]; ctx.fillStyle = 'rgba(27,18,51,0.75)'; ctx.fillRect(x, y, 46, 58); ctx.drawImage(icons[wp.id], x + 1, y + 1);
      txt(wp.evolved ? 'EVO' : 'Lv' + wp.lvl, x + 23, y + 55, 13, wp.evolved ? '#ffd23f' : '#ffffff', 'center'); x += 50;
    }
    x += 8;
    for (i = 0; i < R.pets.length; i++) {
      var pt = R.pets[i]; ctx.fillStyle = 'rgba(27,18,51,0.75)'; ctx.fillRect(x, y, 46, 58); ctx.drawImage(icons[pt.id], x + 1, y + 1);
      txt('Lv' + pt.lvl, x + 23, y + 55, 13, '#ffffff', 'center'); x += 50;
    }
    /* Timer, boss */
    txt(mmss(R.t), w / 2, 56, 34, '#ffffff', 'center');
    var bs = R.boss;
    if (bs) {
      bar(w / 2 - 230, 70, 460, 18, bs.hp / bs.maxHp, '#ff3b3b');
      txt('BOSS  ' + bs.name, w / 2, 85, 15, '#ffffff', 'center');
    } else if (!R.endless && R.bossIdx < BAL.bossTimes.length) txt('Boss in ' + mmss(Math.max(0, BAL.bossTimes[R.bossIdx] - R.t)), w / 2, 80, 16, '#ffd166', 'center');
    else if (R.endless) txt('Endless   next boss ' + mmss(Math.max(0, R.nextEndlessBoss - R.t)), w / 2, 80, 16, '#ffd166', 'center');
    /* Right side info */
    txt('Kills ' + R.kills, w - 14, 46, 20, '#ffffff', 'right');
    txt(R.diff.name + '   Seed ' + R.seedStr, w - 14, 68, 14, '#cfc8ea', 'right', false);
    if (settings.fps && perf) txt(perf.fps.toFixed(0) + ' fps   ' + R.enemies.length + ' enemies (' + drawn + ' on screen)', w - 14, 88, 13, '#cfc8ea', 'right', false);
    /* Status chips */
    x = 14; y = 158;
    if (R.barrierReady) x += chip('Barrier ready', x, y, '#5aa9ff');
    if (R.frenzyT > 0) x += chip('Stampede ' + R.frenzyT.toFixed(0) + 's', x, y, '#ff6f91');
    if (R.rallyT > 0) x += chip('Rally ' + R.rallyT.toFixed(0) + 's', x, y, '#2ee6a6');
    if (R.haloStacks > 0) x += chip('Halo +' + R.haloStacks * 3 + '%', x, y, '#ffc145');
    if (R.revives > 0) x += chip('Second Wind ready', x, y, '#ffffff');
    /* Ability */
    var ab = R.char.ability, ay = h - 84, cdf = Math.max(0, p.abilityCd / ab.cd);
    ctx.fillStyle = 'rgba(27,18,51,0.85)'; ctx.fillRect(14, ay, 250, 70);
    ctx.drawImage(icons[ab.id], 22, ay + 12);
    if (cdf > 0) { ctx.fillStyle = 'rgba(27,18,51,0.7)'; ctx.fillRect(22, ay + 12, 44, 44 * cdf); }
    txt(ab.name, 76, ay + 28, 17, '#ffffff');
    txt(p.abilityCd > 0.05 ? 'Ready in ' + p.abilityCd.toFixed(1) + 's' : 'Press SPACE', 76, ay + 52, 15, p.abilityCd > 0.05 ? '#cfc8ea' : '#ffd23f');
    ctx.fillStyle = cdf > 0 ? '#6b6291' : '#ffd23f'; ctx.fillRect(14, ay + 66, 250 * (1 - cdf), 4);
    /* Banner */
    if (R.banner) {
      var bcol = R.banner.kind === 'boss' ? '#ff3b3b' : R.banner.kind === 'warn' ? '#ffb02e' : R.banner.kind === 'good' ? '#7dffb0' : '#ffffff';
      ctx.globalAlpha = Math.min(1, R.banner.t * 2);
      txt(R.banner.text, w / 2, h * 0.24, 34, bcol, 'center'); ctx.globalAlpha = 1;
    }
    /* Tutorial and controls */
    var tt = Sim.tutText(R);
    if (tt) {
      ctx.font = '700 20px ' + FONT; var tw = ctx.measureText(tt).width + 40;
      ctx.fillStyle = 'rgba(27,18,51,0.9)'; ctx.fillRect(w / 2 - tw / 2, h - 150, tw, 44); ctx.fillStyle = '#ffd23f'; ctx.fillRect(w / 2 - tw / 2, h - 110, tw, 4);
      txt(tt, w / 2, h - 121, 20, '#ffffff', 'center');
    }
    if (R.t < 40 || R.tut) txt('Move: W A S D or arrows      Ability: Space      Pause: Esc or P', w / 2, h - 22, 16, '#ffffff', 'center', false);
    /* Low health vignette edge */
    if (p.hp / s.maxHp < 0.3 && R.state === 'play') { ctx.strokeStyle = 'rgba(255,40,40,' + (0.35 + 0.2 * Math.sin(R.t * 8)) + ')'; ctx.lineWidth = 14; ctx.strokeRect(0, 0, w, h); txt('LOW HP', 290, 73, 15, '#ff3b3b'); }
  }

  /* Calm animated backdrop behind the menus. */
  Rn.drawMenu = function (t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#231942'; ctx.fillRect(0, 0, W, H);
    var ox = (t * 12) % 160, oy = (t * 7) % 160, mx, my;
    ctx.fillStyle = '#2b2050';
    for (my = -1; my * 80 < H + 160; my++) for (mx = -1; mx * 80 < W + 160; mx++) if ((mx + my) & 1) ctx.fillRect(mx * 80 - ox, my * 80 - oy, 80, 80);
    var ids = Object.keys(S.pet), cx = W * 0.5, cy = H * 0.5, rx = Math.min(W * 0.44, 760), ry = Math.min(H * 0.42, 380);
    for (var i = 0; i < ids.length; i++) {
      var a = t * 0.25 + i / ids.length * 6.2832;
      ctx.globalAlpha = 0.9; ctx.drawImage(S.pet[ids[i]], cx + Math.cos(a) * rx - 39, cy + Math.sin(a) * ry - 39 + Math.sin(t * 2 + i) * 6, 78, 78);
    }
    ctx.globalAlpha = 1;
  };
})();
