/* Pet Swarm: Overdrive - all sound is synthesised with WebAudio (no audio files, works offline).
   Browsers only allow audio after a click or key press, so the context is created lazily. */
(function () {
  'use strict';
  var PSO = window.PSO;
  var A = PSO.Audio = { ctx: null, ok: false };
  var master, sfxGain, musicGain, noiseBuf, last = {}, vol = { master: 0.8, sfx: 0.8, music: 0.35 };
  var musicTimer = null, musicStep = 0, musicNext = 0, musicOn = false, intensity = 0;

  /* name: [type, freqStart, freqEnd, duration, gain, minGapSeconds, noiseMix] */
  var SFX = {
    shoot: ['square', 720, 420, 0.06, 0.10, 0.07, 0],
    hit: ['triangle', 300, 180, 0.04, 0.10, 0.05, 0],
    kill: ['triangle', 520, 140, 0.09, 0.14, 0.05, 0.3],
    zap: ['sawtooth', 1400, 300, 0.1, 0.10, 0.09, 0.2],
    boom: ['sine', 160, 40, 0.3, 0.38, 0.09, 1],
    pickup: ['sine', 880, 1320, 0.05, 0.08, 0.04, 0],
    levelup: ['square', 440, 1320, 0.35, 0.2, 0.2, 0],
    hurt: ['sawtooth', 220, 70, 0.22, 0.3, 0.15, 0.5],
    block: ['triangle', 980, 620, 0.16, 0.25, 0.1, 0.2],
    ability: ['sawtooth', 200, 900, 0.25, 0.22, 0.1, 0.3],
    boss: ['sawtooth', 110, 55, 0.9, 0.35, 0.5, 0.4],
    warn: ['square', 660, 660, 0.09, 0.12, 0.25, 0],
    win: ['square', 523, 1568, 0.8, 0.25, 0.5, 0],
    lose: ['sawtooth', 330, 60, 0.9, 0.3, 0.5, 0.2],
    click: ['square', 600, 760, 0.04, 0.1, 0.03, 0],
    evolve: ['square', 330, 1760, 0.6, 0.25, 0.3, 0.1],
    chest: ['triangle', 660, 1320, 0.3, 0.2, 0.2, 0],
    turret: ['square', 520, 360, 0.04, 0.05, 0.08, 0],
    deploy: ['triangle', 240, 520, 0.12, 0.14, 0.1, 0]
  };

  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      A.ctx = new AC();
      master = A.ctx.createGain(); master.connect(A.ctx.destination);
      sfxGain = A.ctx.createGain(); sfxGain.connect(master);
      musicGain = A.ctx.createGain(); musicGain.connect(master);
      var len = Math.floor(A.ctx.sampleRate * 0.5);
      noiseBuf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      A.ok = true;
      A.setVolumes(vol);
    } catch (e) { A.ok = false; }
  };

  A.setVolumes = function (v) {
    vol.master = v.master; vol.sfx = v.sfx; vol.music = v.music;
    if (!A.ok) return;
    master.gain.value = vol.master; sfxGain.gain.value = vol.sfx; musicGain.gain.value = vol.music * 0.5;
  };

  function tone(type, f0, f1, dur, gain, noise, dest, when) {
    var c = A.ctx, t = when || c.currentTime;
    var g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    g.connect(dest);
    var o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    o.connect(g); o.start(t); o.stop(t + dur + 0.02);
    if (noise > 0) {
      var n = c.createBufferSource(); n.buffer = noiseBuf;
      var ng = c.createGain();
      ng.gain.setValueAtTime(gain * noise, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + dur);
      n.connect(ng); ng.connect(dest); n.start(t); n.stop(t + dur + 0.02);
    }
  }

  A.play = function (name) {
    if (!A.ok || vol.master <= 0 || vol.sfx <= 0) return;
    var s = SFX[name]; if (!s) return;
    var now = A.ctx.currentTime;
    if (last[name] && now - last[name] < s[5]) return;   // rate limit so swarms never clip
    last[name] = now;
    tone(s[0], s[1], s[2], s[3], s[4], s[6], sfxGain);
  };

  /* Simple generated loop: bass + arpeggio in A minor pentatonic. */
  var BASS = [110, 110, 130.8, 110, 146.8, 146.8, 164.8, 130.8];
  var ARP = [440, 523.3, 659.3, 784, 659.3, 523.3, 587.3, 392];
  function schedule() {
    if (!A.ok || !musicOn) return;
    var c = A.ctx, stepLen = 0.2 - intensity * 0.04;
    while (musicNext < c.currentTime + 0.25) {
      var i = musicStep % 16, bar = Math.floor(musicStep / 16) % 4;
      var shift = bar === 2 ? 1.189 : bar === 3 ? 0.891 : 1;
      if (i % 2 === 0) tone('triangle', BASS[(i / 2) % 8] * shift, BASS[(i / 2) % 8] * shift, stepLen * 1.8, 0.22, 0, musicGain, musicNext);
      if (i % 4 !== 3) tone('square', ARP[i % 8] * shift, ARP[i % 8] * shift, stepLen * 0.8, 0.045 + intensity * 0.03, 0, musicGain, musicNext);
      if (i % 4 === 2) tone('sine', 90, 40, 0.08, 0.2, 1.2, musicGain, musicNext);
      musicNext += stepLen; musicStep++;
    }
  }
  A.musicStart = function () {
    if (!A.ok || musicOn) return;
    musicOn = true; musicNext = A.ctx.currentTime + 0.05; musicStep = 0;
    musicTimer = setInterval(schedule, 80);
  };
  A.musicStop = function () { musicOn = false; if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } };
  A.setIntensity = function (x) { intensity = Math.max(0, Math.min(1, x)); };
})();
