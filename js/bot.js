/* Pet Swarm: Overdrive - simple autoplayer used for automated testing and performance measurement.
   Not part of normal play. Enable in the browser by opening index.html#bot */
(function () {
  'use strict';
  var PSO = window.PSO;
  var Bot = PSO.Bot = { rng: PSO.makeRng(12345), smart: true, react: 0, noise: 0, hold: 0, last: { mx: 0, my: 0 } };
  var Q = [];

  Bot.think = function (R, out) {
    /* react > 0 makes the bot sloppy: it only re-decides every `react` seconds, with a noisy heading. */
    if (Bot.react > 0) {
      if (R.t < Bot.hold) { out.mx = Bot.last.mx; out.my = Bot.last.my; out.ability = false; return out; }
      Bot.hold = R.t + Bot.react;
    }
    var p = R.player, a = R.arena, vx = 0, vy = 0, i, dx, dy, d, near = 0;
    var list = R.grid.query(p.x, p.y, 230, Q);
    for (i = 0; i < list.length; i++) {
      var e = list[i]; dx = p.x - e.x; dy = p.y - e.y; d = Math.sqrt(dx * dx + dy * dy) || 1;
      var w = (260 - d) / 260 * (e.boss ? 6 : e.elite ? 3 : 1);
      vx += dx / d * w; vy += dy / d * w;
      if (d < 150) near++;
    }
    for (i = 0; i < R.eshots.length; i++) {
      var s = R.eshots[i]; dx = p.x - s.x; dy = p.y - s.y; d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d < 170) { /* sidestep: move perpendicular to the shot's travel direction */
        var sl = Math.sqrt(s.vx * s.vx + s.vy * s.vy) || 1, px = -s.vy / sl, py = s.vx / sl, side = (dx * px + dy * py) >= 0 ? 1 : -1;
        vx += px * side * 3 * (170 - d) / 170; vy += py * side * 3 * (170 - d) / 170;
      }
    }
    for (i = 0; i < R.zones.length; i++) {
      var z = R.zones[i];
      if (z.shape === 'circle') { dx = p.x - z.x; dy = p.y - z.y; d = Math.sqrt(dx * dx + dy * dy) || 1; if (d < z.r + 50) { vx += dx / d * 8; vy += dy / d * 8; } }
      else {
        var lx = z.x2 - z.x, ly = z.y2 - z.y, l2 = lx * lx + ly * ly || 1, t = Math.max(0, Math.min(1, ((p.x - z.x) * lx + (p.y - z.y) * ly) / l2));
        dx = p.x - (z.x + lx * t); dy = p.y - (z.y + ly * t); d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d < z.w + 50) { vx += dx / d * 8; vy += dy / d * 8; }
      }
    }
    for (i = 0; i < R.vents.length; i++) {
      var v = R.vents[i]; if (v.state === 'idle') continue;
      dx = p.x - v.x; dy = p.y - v.y; d = Math.sqrt(dx * dx + dy * dy) || 1; if (d < v.r + 50) { vx += dx / d * 8; vy += dy / d * 8; }
    }
    if (R.boss && (R.boss.state === 'laser' || R.boss.state === 'laserWind')) { /* orbit with the beams */
      dx = p.x - R.boss.x; dy = p.y - R.boss.y; d = Math.sqrt(dx * dx + dy * dy) || 1;
      vx += -dy / d * 4 * R.boss.ldir; vy += dx / d * 4 * R.boss.ldir;
    }
    var m = 220;
    if (p.x < m) vx += (m - p.x) / m * 5; if (p.x > a.w - m) vx -= (p.x - (a.w - m)) / m * 5;
    if (p.y < m) vy += (m - p.y) / m * 5; if (p.y > a.h - m) vy -= (p.y - (a.h - m)) / m * 5;
    if (near < 5) {
      var best = null, bd = 1e12;
      for (i = 0; i < R.gems.length; i += 2) { var g = R.gems[i]; dx = g.x - p.x; dy = g.y - p.y; d = dx * dx + dy * dy; if (d < bd) { bd = d; best = g; } }
      for (i = 0; i < R.pickups.length; i++) { dx = R.pickups[i].x - p.x; dy = R.pickups[i].y - p.y; d = (dx * dx + dy * dy) * 0.3; if (d < bd) { bd = d; best = R.pickups[i]; } }
      if (best) { dx = best.x - p.x; dy = best.y - p.y; d = Math.sqrt(dx * dx + dy * dy) || 1; vx += dx / d * 1.6; vy += dy / d * 1.6; }
    }
    var len = Math.sqrt(vx * vx + vy * vy);
    if (len > 0.05) {
      if (Bot.noise > 0) { var na = Math.atan2(vy, vx) + (Bot.rng.next() - 0.5) * 2 * Bot.noise; vx = Math.cos(na) * len; vy = Math.sin(na) * len; }
      out.mx = vx / len; out.my = vy / len;
    } else { out.mx = 0; out.my = 0; }
    Bot.last.mx = out.mx; Bot.last.my = out.my;
    out.ability = near >= 4 && p.abilityCd <= 0;
    return out;
  };

  /* Chooses an upgrade: evolutions, synergies and capstones first, otherwise random. */
  Bot.pick = function (R) {
    var o = R.offer.options, i;
    if (Bot.smart) {
      for (i = 0; i < o.length; i++) if (o[i].type === 'evolve') return o[i];
      for (i = 0; i < o.length; i++) if (o[i].type === 'syn') return o[i];
      for (i = 0; i < o.length; i++) if (o[i].type === 'tech' && PSO.DATA.TECH[o[i].id].capstone) return o[i];
    }
    return o[Math.floor(Bot.rng.next() * o.length)];
  };
})();
