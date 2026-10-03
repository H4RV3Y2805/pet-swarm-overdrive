/* Pet Swarm: Overdrive - game loop, input, pause handling and run flow. */
(function () {
  'use strict';
  var PSO = window.PSO, Sim = PSO.Sim, Save = PSO.Save, UI = PSO.UI, Rn = PSO.Render, Up = PSO.Upgrades, A = PSO.Audio;
  var Game = PSO.Game = { R: null, paused: false, bot: false };
  var keys = {}, inp = { mx: 0, my: 0, ability: false }, last = 0, menuT = 0, fpsAcc = 0, fpsN = 0, tapSpace = false;
  var perf = PSO.Perf = { fps: 60, simMs: 0, drawMs: 0, rec: null };

  /* ---------- Run flow ---------- */
  Game.startRun = function (cfg) {
    A.init();
    Game.R = Sim.newRun(cfg, Save.data); Game.paused = false; keys = {};
    UI.hide(); A.musicStart(); last = performance.now();
  };
  Game.pause = function () {
    var R = Game.R;
    if (R && R.state === 'play' && !Game.paused) { Game.paused = true; keys = {}; A.musicStop(); UI.showPause(R); }
  };
  Game.resume = function () {
    if (Game.R && Game.paused) { Game.paused = false; keys = {}; UI.hide(); A.musicStart(); last = performance.now(); }
  };
  Game.pickUpgrade = function (i) {
    var R = Game.R;
    if (!R || R.state !== 'levelup' || !R.offer || !R.offer.options[i]) return;
    Up.apply(R, R.offer.options[i]);
    if (R.pending > 0) { Up.offer(R); UI.showLevelUp(R); botPick(); }
    else { R.state = 'play'; keys = {}; UI.hide(); last = performance.now(); }
  };
  Game.reroll = function () { var R = Game.R; if (R && R.state === 'levelup' && Up.reroll(R)) UI.showLevelUp(R); };
  function finish(reason) {
    var R = Game.R, bank = Save.bankRun(R);
    A.musicStop(); Game.paused = false;
    UI.showSummary(R, bank, reason);
  }
  Game.endRun = function () { var R = Game.R; if (!R) return; R.state = 'quit'; finish('quit'); };
  Game.continueEndless = function () {
    var R = Game.R; if (!R || R.state !== 'won') return;
    Sim.continueEndless(R); R.shown = false; keys = {}; UI.hide(); A.musicStart(); last = performance.now();
  };
  Game.toMenu = function () { Game.R = null; Game.paused = false; A.musicStop(); UI.showMenu(); };

  function botPick() {
    if (!Game.bot) return;
    setTimeout(function () { var R = Game.R; if (R && R.state === 'levelup' && R.offer) Game.pickUpgrade(R.offer.options.indexOf(PSO.Bot.pick(R))); }, 120);
  }

  /* ---------- Input ---------- */
  var MOVE = { KeyW: 1, KeyA: 1, KeyS: 1, KeyD: 1, ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Space: 1 };
  window.addEventListener('keydown', function (ev) {
    var R = Game.R, c = ev.code;
    if (ev.target && ev.target.tagName === 'INPUT' && ev.target.type === 'text') return;
    if (!R) return;
    if (MOVE[c]) ev.preventDefault();
    if (c === 'Escape' || c === 'KeyP') {
      ev.preventDefault();
      if (R.state === 'play' && !Game.paused) Game.pause();
      else if (Game.paused) { if (UI.current === 'pause') Game.resume(); else UI.showPause(R); }
      return;
    }
    if (R.state === 'levelup') {
      if (c === 'KeyR') Game.reroll();
      else if (/^(Digit|Numpad)[1-4]$/.test(c)) Game.pickUpgrade(Number(c.slice(-1)) - 1);
      return;
    }
    keys[c] = true;
    if (c === 'Space') tapSpace = true;   // latch so even a very quick tap registers
  });
  window.addEventListener('keyup', function (ev) { keys[ev.code] = false; });
  /* Automatic pause when the page loses focus or is hidden. */
  window.addEventListener('blur', function () { keys = {}; Game.pause(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) { keys = {}; Game.pause(); } });
  window.addEventListener('resize', function () { Rn.resize(); });

  function readInput(R) {
    if (Game.bot) { PSO.Bot.think(R, inp); return; }
    inp.mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    inp.my = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
    inp.ability = !!keys.Space || tapSpace; tapSpace = false;
  }

  /* ---------- Main loop (delta-time based) ---------- */
  function frame(now) {
    window.requestAnimationFrame(frame);
    var ms = now - last, dt = ms / 1000; last = now;
    if (dt > 0.1) dt = 0.1; if (dt < 0) dt = 0;
    fpsAcc += ms; fpsN++;
    if (fpsAcc >= 500) { perf.fps = fpsN * 1000 / fpsAcc; fpsAcc = 0; fpsN = 0; }
    var R = Game.R;
    if (!R) { menuT += dt; Rn.drawMenu(menuT); return; }
    var t0 = performance.now();
    if (R.state === 'play' && !Game.paused) {
      readInput(R);
      var steps = dt > 1 / 20 ? 3 : dt > 1 / 40 ? 2 : 1, sdt = dt / steps;   // sub-step slow frames so nothing tunnels
      for (var i = 0; i < steps && R.state === 'play'; i++) Sim.step(R, sdt, inp);
      if (R.tutDone) { R.tutDone = false; Save.data.tutorialDone = true; Save.persist(); }
      if (R.state === 'play' && R.pending > 0) { Up.offer(R); R.state = 'levelup'; A.play(R.offer.chest ? 'chest' : 'levelup'); UI.showLevelUp(R); botPick(); }
      A.setIntensity(R.enemies.length / 300);
    }
    if (!R.shown && (R.state === 'dead' || R.state === 'won')) { R.shown = true; finish(R.state); }
    var t1 = performance.now();
    Rn.draw(R, PSO.settings, perf);
    var t2 = performance.now();
    perf.simMs = t1 - t0; perf.drawMs = t2 - t1;
    if (perf.rec && R.state === 'play' && !Game.paused) perf.rec.push([ms, t1 - t0, t2 - t1, R.enemies.length, R.shots.length + R.parts.length]);
  }

  /* ---------- Test and measurement hooks (not used in normal play) ---------- */
  /* Advance the simulation quickly without drawing, using the autoplayer. */
  Game.debugFastForward = function (seconds) {
    var R = Game.R, end = R.t + seconds, bi = { mx: 0, my: 0, ability: false }, guard = 0;
    while (R.t < end && guard++ < 1e6) {
      if (R.state === 'levelup') { Up.apply(R, PSO.Bot.pick(R)); if (R.pending > 0) Up.offer(R); else R.state = 'play'; continue; }
      if (R.state !== 'play') break;
      PSO.Bot.think(R, bi); Sim.step(R, 1 / 60, bi);
      if (R.state === 'play' && R.pending > 0) { Up.offer(R); R.state = 'levelup'; }
    }
    UI.hide(); if (R.state === 'levelup') UI.showLevelUp(R);
    last = performance.now();
    return { t: R.t, state: R.state, level: R.level, enemies: R.enemies.length };
  };
  perf.start = function () { perf.rec = []; };
  perf.stop = function () {
    var r = perf.rec || []; perf.rec = null;
    if (!r.length) return null;
    var fr = r.map(function (x) { return x[0]; }).sort(function (a, b) { return a - b; }), sum = function (k) { return r.reduce(function (s, x) { return s + x[k]; }, 0); };
    return { frames: r.length, avgFps: 1000 / (sum(0) / r.length), medianMs: fr[Math.floor(fr.length / 2)], p95Ms: fr[Math.floor(fr.length * 0.95)], p99Ms: fr[Math.floor(fr.length * 0.99)], worstMs: fr[fr.length - 1],
      avgSimMs: sum(1) / r.length, avgDrawMs: sum(2) / r.length, avgEnemies: sum(3) / r.length, maxEnemies: Math.max.apply(null, r.map(function (x) { return x[3]; })), avgShotsParticles: sum(4) / r.length };
  };

  /* ---------- Boot ---------- */
  function boot() {
    Save.load();
    PSO.settings = Save.data.settings;
    A.setVolumes(Save.data.settings);
    Rn.init(document.getElementById('game'));
    UI.init(Game);
    Game.bot = /bot/.test(window.location.hash);
    UI.showMenu();
    last = performance.now();
    window.requestAnimationFrame(frame);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
