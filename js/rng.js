/* Pet Swarm: Overdrive - seeded random numbers.
   Gameplay randomness uses makeRng(seed) streams. Cosmetic randomness uses PSO.fxRng
   (seeded from Math.random) so particles never disturb a seeded run. */
(function () {
  'use strict';
  var PSO = window.PSO = window.PSO || {};

  function hashSeed(str) {
    str = String(str);
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }

  function makeRng(seed) {
    var a = seed >>> 0;
    var r = {
      next: function () {
        a = (a + 0x6D2B79F5) | 0;
        var t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      },
      range: function (lo, hi) { return lo + (hi - lo) * r.next(); },
      int: function (lo, hi) { return lo + Math.floor(r.next() * (hi - lo + 1)); },
      chance: function (p) { return r.next() < p; },
      pick: function (arr) { return arr[Math.floor(r.next() * arr.length)]; },
      /* weighted pick: items need a numeric .w; returns index */
      weighted: function (items) {
        var total = 0, i;
        for (i = 0; i < items.length; i++) total += items[i].w;
        var roll = r.next() * total;
        for (i = 0; i < items.length; i++) { roll -= items[i].w; if (roll <= 0) return i; }
        return items.length - 1;
      }
    };
    return r;
  }

  var ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function randomSeedString() {
    var s = '';
    for (var i = 0; i < 6; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
    return s;
  }

  PSO.hashSeed = hashSeed;
  PSO.makeRng = makeRng;
  PSO.randomSeedString = randomSeedString;
  PSO.fxRng = makeRng((Math.random() * 4294967296) >>> 0);
})();
