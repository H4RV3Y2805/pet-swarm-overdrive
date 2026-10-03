/* Pet Swarm: Overdrive - every sprite and icon is drawn with Canvas 2D at start-up, then reused via drawImage.
   No image files are needed, so the game works offline from a double-click. */
(function () {
  'use strict';
  var PSO = window.PSO, D = PSO.DATA;
  var S = PSO.Sprites = { enemy: {}, pet: {}, player: {}, gem: [], misc: {} };
  var INK = '#1b1233';

  function mk(size, fn) {
    var c = document.createElement('canvas'); c.width = c.height = size;
    var x = c.getContext('2d'); x.translate(size / 2, size / 2); x.lineJoin = 'round'; x.lineCap = 'round';
    fn(x); return c;
  }
  function whiten(src) {   // white silhouette for hit flashes
    var c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    var x = c.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
    return c;
  }
  function circ(x, cx, cy, r, fill, stroke, lw) {
    x.beginPath(); x.arc(cx, cy, r, 0, 6.2832);
    if (fill) { x.fillStyle = fill; x.fill(); }
    if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw || 2.5; x.stroke(); }
  }
  function poly(x, pts, fill, stroke, lw) {
    x.beginPath(); x.moveTo(pts[0], pts[1]);
    for (var i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]);
    x.closePath();
    if (fill) { x.fillStyle = fill; x.fill(); }
    if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw || 2.5; x.stroke(); }
  }
  function eyes(x, cx, cy, gap, r, angry) {
    circ(x, cx - gap, cy, r, '#ffffff', INK, 1.5); circ(x, cx + gap, cy, r, '#ffffff', INK, 1.5);
    circ(x, cx - gap + 0.5, cy + 0.5, r * 0.45, INK); circ(x, cx + gap + 0.5, cy + 0.5, r * 0.45, INK);
    if (angry) { x.strokeStyle = INK; x.lineWidth = 2; x.beginPath(); x.moveTo(cx - gap - r, cy - r - 1); x.lineTo(cx - gap + r, cy - r + 2); x.moveTo(cx + gap + r, cy - r - 1); x.lineTo(cx + gap - r, cy - r + 2); x.stroke(); }
  }
  function star(x, cx, cy, n, r1, r2, rot) {
    var p = [];
    for (var i = 0; i < n * 2; i++) { var a = rot + i * Math.PI / n, r = i % 2 ? r2 : r1; p.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    return p;
  }

  var ENEMY_DRAW = {
    grub: function (x, r) {
      circ(x, 0, 0, r, '#b65cff', INK); circ(x, 0, r * 0.35, r * 0.55, '#9a3fe8');
      x.strokeStyle = INK; x.lineWidth = 2; x.beginPath(); x.moveTo(-4, -r + 1); x.lineTo(-7, -r - 4); x.moveTo(4, -r + 1); x.lineTo(7, -r - 4); x.stroke();
      eyes(x, 0, -2, 4, 3);
    },
    skitter: function (x, r) {
      x.strokeStyle = INK; x.lineWidth = 2; x.beginPath();
      for (var i = -1; i <= 1; i++) { x.moveTo(-r, i * 4); x.lineTo(-r - 4, i * 6); x.moveTo(r, i * 4); x.lineTo(r + 4, i * 6); }
      x.stroke();
      poly(x, [0, -r - 2, r, 0, r * 0.6, r, -r * 0.6, r, -r, 0], '#ff8a3d', INK, 2);
      eyes(x, 0, 0, 3, 2.2);
    },
    dasher: function (x, r) {   // points right; rotated at draw time
      poly(x, [r + 5, 0, -r * 0.4, -r, -r, -r * 0.5, -r * 0.5, 0, -r, r * 0.5, -r * 0.4, r], '#ff4d6d', INK);
      poly(x, [r + 5, 0, r - 3, -4, r - 3, 4], '#ffe9a8', INK, 1.5);
      circ(x, 1, -4, 3, '#ffffff', INK, 1.5); circ(x, 1, 4, 3, '#ffffff', INK, 1.5); circ(x, 2, -4, 1.3, INK); circ(x, 2, 4, 1.3, INK);
    },
    spitter: function (x, r) {
      poly(x, [0, -r - 3, r + 2, 0, 0, r + 3, -r - 2, 0], '#8f6bff', INK);
      circ(x, 0, -1, 6, '#ffffff', INK, 2); circ(x, 0, -1, 2.8, '#ff3b3b', INK, 1);
      circ(x, 0, r - 2, 2.5, INK);
    },
    puffer: function (x, r) {
      poly(x, star(x, 0, 0, 9, r + 5, r - 1, 0), '#ffb02e', INK, 2.5);
      circ(x, 0, 0, r - 3, '#ffd166');
      eyes(x, 0, -2, 4, 3, true);
      x.strokeStyle = INK; x.lineWidth = 2; x.beginPath(); x.moveTo(-3, 5); x.lineTo(3, 5); x.stroke();
    },
    brute: function (x, r) {
      poly(x, [-r + 4, -r - 8, -r + 10, -r + 2, -r - 2, -r + 4], '#f2e3c6', INK); poly(x, [r - 4, -r - 8, r - 10, -r + 2, r + 2, -r + 4], '#f2e3c6', INK);
      x.beginPath(); if (x.roundRect) x.roundRect(-r, -r, r * 2, r * 2, 9); else x.rect(-r, -r, r * 2, r * 2);
      x.fillStyle = '#c0394b'; x.fill(); x.strokeStyle = INK; x.lineWidth = 3; x.stroke();
      x.fillStyle = '#8f2636'; x.fillRect(-r + 4, 4, r * 2 - 8, r - 9);
      x.strokeStyle = '#f2e3c6'; x.lineWidth = 2; x.beginPath(); x.moveTo(-8, 13); x.lineTo(-4, 9); x.lineTo(0, 13); x.lineTo(4, 9); x.lineTo(8, 13); x.stroke();
      eyes(x, 0, -7, 8, 5, true);
    },
    gloop: function (x, r) {
      x.beginPath();
      for (var i = 0; i <= 24; i++) { var a = i / 24 * 6.2832, rr = r + Math.sin(i * 1.57) * 3; if (i) x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.94 + 2); else x.moveTo(rr, 2); }
      x.closePath(); x.fillStyle = '#6edb5a'; x.fill(); x.strokeStyle = INK; x.lineWidth = 4; x.stroke();
      circ(x, -18, 16, 9, '#4fb942'); circ(x, 20, 20, 6, '#4fb942'); circ(x, -8, -26, 5, '#a8f29a');
      poly(x, [-22, -r + 6, -22, -r - 14, -11, -r - 2, 0, -r - 18, 11, -r - 2, 22, -r - 14, 22, -r + 6], '#ffd23f', INK, 3);
      eyes(x, 0, -6, 14, 9, true);
      x.strokeStyle = INK; x.lineWidth = 3; x.beginPath(); x.arc(0, 12, 12, 0.2, Math.PI - 0.2); x.stroke();
    },
    hex: function (x, r) {
      poly(x, star(x, 0, 0, 3, r, r, 0), '#aab6c8', INK, 4);
      poly(x, star(x, 0, 0, 3, r - 12, r - 12, 0), '#5d6a80', INK, 2);
      for (var i = 0; i < 6; i++) { var a = i * 1.0472; circ(x, Math.cos(a) * (r - 6), Math.sin(a) * (r - 6), 3, '#e9eef5', INK, 1.5); }
      circ(x, 0, 0, 18, '#2a1020', INK, 3); circ(x, 0, 0, 11, '#ff3b3b'); circ(x, -3, -3, 4, '#ffd0d0');
    }
  };

  var PET_DRAW = {
    zap: function (x) {
      poly(x, [-11, -6, -13, -19, -4, -11], '#ffe14d', INK, 2); poly(x, [11, -6, 13, -19, 4, -11], '#ffe14d', INK, 2);
      circ(x, 0, 0, 12, '#ffe14d', INK); circ(x, 0, 5, 6, '#fff6c2');
      eyes(x, 0, -2, 5, 2.6);
      poly(x, [14, 2, 20, -2, 17, 4, 23, 3, 15, 12, 17, 6], '#ffffff', INK, 1.5);
    },
    ember: function (x) {
      poly(x, [-10, -2, -22, -10, -18, 4], '#ff5b2e', INK, 2); poly(x, [10, -2, 22, -10, 18, 4], '#ff5b2e', INK, 2);
      poly(x, [-7, -9, -9, -18, -2, -12], '#ffd166', INK, 1.5); poly(x, [7, -9, 9, -18, 2, -12], '#ffd166', INK, 1.5);
      circ(x, 0, 0, 12, '#ff7b3a', INK); circ(x, 0, 6, 6, '#ffd166');
      eyes(x, 0, -3, 5, 2.6); circ(x, -2, 5, 1, INK); circ(x, 2, 5, 1, INK);
    },
    beetle: function (x) {
      x.strokeStyle = INK; x.lineWidth = 2; x.beginPath();
      for (var i = -1; i <= 1; i++) { x.moveTo(-10, i * 6 + 2); x.lineTo(-17, i * 8 + 3); x.moveTo(10, i * 6 + 2); x.lineTo(17, i * 8 + 3); }
      x.stroke();
      circ(x, 0, -11, 6, '#2d4f8f', INK, 2);
      x.beginPath(); x.ellipse(0, 2, 12, 13, 0, 0, 6.2832); x.fillStyle = '#5aa9ff'; x.fill(); x.strokeStyle = INK; x.lineWidth = 2.5; x.stroke();
      x.beginPath(); x.moveTo(0, -10); x.lineTo(0, 15); x.stroke();
      circ(x, -5, -2, 3, '#bfe0ff'); eyes(x, 0, -12, 3, 1.8);
    },
    magpip: function (x) {
      poly(x, [-9, 4, -22, 0, -14, 10], '#59e0ff', INK, 2); poly(x, [9, 4, 22, 0, 14, 10], '#59e0ff', INK, 2);
      circ(x, 0, 0, 12, '#27304f', INK); circ(x, 0, 5, 7, '#ffffff');
      eyes(x, 0, -4, 5, 2.8);
      poly(x, [-3, 0, 3, 0, 0, 6], '#ffc145', INK, 1.5);
    },
    cog: function (x) {
      poly(x, star(x, 0, 0, 8, 17, 13, 0), '#8d99ae', INK, 2);
      circ(x, 0, 0, 12, '#d9a066', INK); circ(x, 0, 6, 4, '#ffb3c1', INK, 1.5);
      circ(x, -5, -3, 4.5, '#bff3ff', INK, 2); circ(x, 5, -3, 4.5, '#bff3ff', INK, 2);
      x.strokeStyle = INK; x.lineWidth = 2; x.beginPath(); x.moveTo(-1, -3); x.lineTo(1, -3); x.stroke();
    },
    frost: function (x) {
      poly(x, [-9, 3, -21, -3, -15, 9], '#e9fbff', INK, 2); poly(x, [9, 3, 21, -3, 15, 9], '#e9fbff', INK, 2);
      poly(x, [-3, -10, 0, -21, 3, -10], '#e9fbff', INK, 1.5);
      circ(x, 0, 0, 12, '#aeeaff', INK); circ(x, 0, 5, 7, '#ffffff');
      eyes(x, 0, -4, 5, 2.6);
      poly(x, [-3, 0, 3, 0, 0, 5], '#5aa9ff', INK, 1.5);
    }
  };

  function drawPlayer(x, id) {
    var col = D.CHARACTERS[id].color;
    x.fillStyle = '#4a3f6b'; x.strokeStyle = INK; x.lineWidth = 2.5;
    x.fillRect(-9, 5, 18, 10); x.strokeRect(-9, 5, 18, 10);
    circ(x, 0, 0, 14, col, INK, 3);
    x.beginPath(); if (x.roundRect) x.roundRect(-10, -6, 20, 9, 4); else x.rect(-10, -6, 20, 9);
    x.fillStyle = '#1b1233'; x.fill();
    x.fillStyle = '#7ef9ff'; x.fillRect(-7, -4, 5, 4); x.fillRect(2, -4, 5, 4);
    if (id === 'rook') { poly(x, [-14, -9, 14, -9, 10, -14, -10, -14], '#e63946', INK, 2); poly(x, [12, -11, 20, -15, 18, -8], '#e63946', INK, 2); }
    else if (id === 'vex') { x.strokeStyle = INK; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -14); x.lineTo(0, -20); x.stroke(); poly(x, star(x, 0, -22, 4, 5, 2, 0), '#ffe14d', INK, 1.5); }
    else { poly(x, star(x, 0, -15, 6, 7, 4.5, 0), '#ffd166', INK, 2); circ(x, 0, -15, 2, INK); }
  }

  var ICON_DRAW = {
    bolt: function (x) { x.rotate(-0.785); poly(x, [-14, -3, 6, -3, 6, -8, 16, 0, 6, 8, 6, 3, -14, 3], '#7ef9ff', INK, 2.5); },
    arc: function (x) { poly(x, [-3, -16, 9, -16, 2, -3, 10, -3, -7, 16, -2, 2, -10, 2], '#c9a7ff', INK, 2.5); },
    blades: function (x) {
      circ(x, 0, 0, 13, null, '#e8f1ff', 2);
      for (var i = 0; i < 3; i++) { x.save(); x.rotate(i * 2.094); poly(x, [0, -17, 6, -9, 0, -6, -6, -9], '#e8f1ff', INK, 2); x.restore(); }
      circ(x, 0, 0, 3, '#e8f1ff', INK, 1.5);
    },
    boom: function (x) { circ(x, -1, 3, 11, '#3a3355', INK, 2.5); x.strokeStyle = '#d9a066'; x.lineWidth = 3; x.beginPath(); x.moveTo(5, -6); x.lineTo(10, -12); x.stroke(); poly(x, star(x, 12, -14, 4, 5, 2, 0.4), '#ffd166', INK, 1.5); circ(x, -5, -1, 3, '#6b6291'); },
    sentry: function (x) { poly(x, [-12, 14, 12, 14, 7, 4, -7, 4], '#2a8c7f', INK, 2.5); circ(x, 0, 0, 8, '#3ddbc4', INK, 2.5); x.fillStyle = '#e8f1ff'; x.strokeStyle = INK; x.lineWidth = 2; x.fillRect(-3, -17, 6, 13); x.strokeRect(-3, -17, 6, 13); },
    swarm: function (x) { circ(x, 0, 5, 8, '#ff6f91', INK, 2.5); circ(x, -10, -4, 4.2, '#ff6f91', INK, 2); circ(x, 0, -9, 4.2, '#ff6f91', INK, 2); circ(x, 10, -4, 4.2, '#ff6f91', INK, 2); },
    arsenal: function (x) { poly(x, star(x, 0, 0, 8, 16, 7, 0), '#ffc145', INK, 2.5); circ(x, 0, 0, 3, '#fff6c2'); },
    engineering: function (x) { poly(x, star(x, 0, 0, 8, 16, 11.5, 0.2), '#3ddbc4', INK, 2.5); circ(x, 0, 0, 5, '#231942', INK, 2); },
    syn: function (x) { circ(x, -6, 0, 9, null, INK, 6); circ(x, 6, 0, 9, null, INK, 6); circ(x, -6, 0, 9, null, '#ffffff', 3); circ(x, 6, 0, 9, null, '#ffd166', 3); },
    heal: function (x) { poly(x, [-4, -13, 4, -13, 4, -4, 13, -4, 13, 4, 4, 4, 4, 13, -4, 13, -4, 4, -13, 4, -13, -4, -4, -4], '#7dff9b', INK, 2.5); },
    sparks: function (x) { poly(x, star(x, 0, 0, 4, 16, 5, 0.785), '#ffe14d', INK, 2.5); },
    dash: function (x) { poly(x, [-14, -6, 2, -6, 2, -12, 15, 0, 2, 12, 2, 6, -14, 6], '#ff9f43', INK, 2.5); },
    clap: function (x) { circ(x, 0, 0, 6, '#b388ff', INK, 2); circ(x, 0, 0, 11, null, '#b388ff', 2.5); circ(x, 0, 0, 16, null, '#e3d4ff', 2); },
    rally: function (x) { x.fillStyle = '#e8f1ff'; x.strokeStyle = INK; x.lineWidth = 2; x.fillRect(-9, -15, 3, 30); x.strokeRect(-9, -15, 3, 30); poly(x, [-6, -14, 12, -8, -6, -2], '#2ee6a6', INK, 2.5); },
    lock: function (x) { x.strokeStyle = '#b9b2d6'; x.lineWidth = 4; x.beginPath(); x.arc(0, -4, 7, Math.PI, 0); x.stroke(); x.beginPath(); if (x.roundRect) x.roundRect(-11, -4, 22, 17, 3); else x.rect(-11, -4, 22, 17); x.fillStyle = '#b9b2d6'; x.fill(); x.strokeStyle = INK; x.lineWidth = 2; x.stroke(); circ(x, 0, 4, 2.5, INK); }
  };

  S.init = function () {
    var k;
    for (k in ENEMY_DRAW) (function (type) {
      var r = (D.ENEMIES[type] || D.BOSSES[type]).r, size = Math.ceil(r * 2 + 34);
      var img = mk(size, function (x) { ENEMY_DRAW[type](x, r); });
      S.enemy[type] = { img: img, flash: whiten(img), half: size / 2 };
    })(k);
    for (k in PET_DRAW) (function (id) { S.pet[id] = mk(52, PET_DRAW[id]); })(k);
    for (k in D.CHARACTERS) (function (id) { S.player[id] = mk(56, function (x) { drawPlayer(x, id); }); })(k);
    S.gem = [
      mk(22, function (x) { poly(x, [0, -8, 6.5, 0, 0, 8, -6.5, 0], '#b8fbff', INK, 2); circ(x, -1.5, -2, 1.6, '#ffffff'); }),
      mk(24, function (x) { poly(x, [0, -10, 8, -2, 5, 9, -5, 9, -8, -2], '#4aa8ff', INK, 2); circ(x, -2, -2, 1.8, '#ffffff'); }),
      mk(32, function (x) { poly(x, star(x, 0, 0, 5, 13, 6, -1.57), '#ffd23f', INK, 2); circ(x, -2, -2, 2, '#ffffff'); })
    ];
    S.misc.eshot = mk(30, function (x) { poly(x, star(x, 0, 0, 4, 12, 6, 0), '#ff3b3b', INK, 2.5); circ(x, 0, 0, 3.5, '#ffe9a8'); });
    S.misc.blade = mk(48, function (x) { poly(x, star(x, 0, 0, 8, 19, 12, 0), '#e8f1ff', INK, 2.5); circ(x, 0, 0, 5, '#8d99ae', INK, 2); });
    S.misc.heal = mk(30, function (x) { circ(x, 0, 0, 12, '#1d3b2a', INK, 2); x.scale(0.6, 0.6); ICON_DRAW.heal(x); });
    S.misc.chest = mk(44, function (x) {
      x.beginPath(); if (x.roundRect) x.roundRect(-16, -11, 32, 24, 4); else x.rect(-16, -11, 32, 24);
      x.fillStyle = '#b5651d'; x.fill(); x.strokeStyle = INK; x.lineWidth = 3; x.stroke();
      x.fillStyle = '#ffd23f'; x.fillRect(-16, -3, 32, 5); x.strokeRect(-16, -3, 32, 5); circ(x, 0, 0, 4, '#ffd23f', INK, 2);
    });
    S.misc.turret = mk(40, function (x) { poly(x, star(x, 0, 0, 3, 16, 16, 0.52), '#2a8c7f', INK, 2.5); circ(x, 0, 0, 9, '#3ddbc4', INK, 2.5); });
    S.misc.trap = mk(34, function (x) { poly(x, star(x, 0, 0, 6, 14, 8, 0), '#3ddbc4', INK, 2); circ(x, 0, 0, 4, '#ffffff', INK, 1.5); });
    S.misc.mine = mk(34, function (x) { poly(x, star(x, 0, 0, 6, 14, 9, 0), '#d9a066', INK, 2); circ(x, 0, 0, 4, '#ff5a3c', INK, 1.5); });
    S.misc.swarmling = mk(26, function (x) { poly(x, [0, -9, 8, 6, 0, 3, -8, 6], '#ff6f91', INK, 2); circ(x, 0, -1, 2, '#ffffff'); });
    S.misc.rock = mk(200, function (x) {
      poly(x, [-70, 30, -52, -40, -8, -78, 46, -52, 76, 12, 40, 66, -30, 70], '#7a86d6', INK, 5);
      poly(x, [-8, -78, 46, -52, 20, -10, -20, -20], '#a9b4ff'); poly(x, [-52, -40, -8, -78, -20, -20, -40, 10], '#929ef0');
      x.strokeStyle = INK; x.lineWidth = 3; x.beginPath(); x.moveTo(-20, -20); x.lineTo(20, -10); x.lineTo(40, 66); x.moveTo(-20, -20); x.lineTo(-30, 70); x.stroke();
    });
    /* Striped pattern = hostile telegraph. Never used for friendly effects. */
    var st = document.createElement('canvas'); st.width = st.height = 24;
    var sx = st.getContext('2d'); sx.strokeStyle = 'rgba(255,60,60,0.55)'; sx.lineWidth = 6;
    sx.beginPath(); sx.moveTo(-6, 24); sx.lineTo(24, -6); sx.moveTo(6, 36); sx.lineTo(36, 6); sx.moveTo(-18, 12); sx.lineTo(12, -18); sx.stroke();
    S.misc.stripesSrc = st;
  };

  /* Returns a small canvas element with the requested icon, for DOM menus. */
  S.icon = function (kind, id, size) {
    size = size || 44;
    var c = document.createElement('canvas'); c.width = c.height = size; c.className = 'icon';
    var x = c.getContext('2d'); x.translate(size / 2, size / 2); x.lineJoin = 'round'; x.lineCap = 'round';
    var sc = size / 44; x.scale(sc, sc);
    if (kind === 'pet') { x.scale(0.82, 0.82); PET_DRAW[id](x); }
    else if (kind === 'char') { x.scale(1.15, 1.15); drawPlayer(x, id); }
    else if (kind === 'enemy') { var r = (D.ENEMIES[id] || D.BOSSES[id]).r; var k = Math.min(1, 15 / r); x.scale(k, k); ENEMY_DRAW[id](x, r); }
    else if (ICON_DRAW[id]) ICON_DRAW[id](x);
    return c;
  };
  S.drawIcon = function (ctx, id, cx, cy, scale) {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(scale, scale); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (ICON_DRAW[id]) ICON_DRAW[id](ctx); else if (PET_DRAW[id]) { ctx.scale(0.82, 0.82); PET_DRAW[id](ctx); }
    ctx.restore();
  };
  S.INK = INK;
})();
