/* Pet Swarm: Overdrive - level-up offers: which upgrades can appear, how they are described, what they do. */
(function () {
  'use strict';
  var PSO = window.PSO, D = PSO.DATA, BAL = D.BAL, Sim = PSO.Sim;
  var Up = PSO.Upgrades = {};

  Up.reqMet = function (R, n) {
    var i;
    if (n.req) for (i = 0; i < n.req.length; i++) if (!(R.tech[n.req[i]] > 0)) return false;
    if (n.reqAny) { var any = false; for (i = 0; i < n.reqAny.length; i++) if (R.tech[n.reqAny[i]] > 0) any = true; if (!any) return false; }
    if (n.needsTag && !R.tags[n.needsTag]) return false;
    if (n.branch === 'swarm' && n.tags.indexOf('Pet') >= 0 && !R.pets.length) return false;
    if (n.branch === 'arsenal' && R.mods.noWeapons && !R.tags.Turret) return false;
    return true;
  };
  Up.synMet = function (R, sdef) {
    for (var i = 0; i < sdef.tags.length; i++) {
      var ok = false;
      for (var j = 0; j < sdef.tags[i].length; j++) if (R.tags[sdef.tags[i][j]]) ok = true;
      if (!ok) return false;
    }
    return true;
  };
  function evoKeyFor(R, techId) {
    for (var i = 0; i < R.weapons.length; i++) { var w = R.weapons[i]; if (!w.evolved && D.WEAPONS[w.id].evo.needs === techId) return D.WEAPONS[w.id]; }
    return null;
  }

  /* Every upgrade that is legal AND useful right now. */
  Up.candidates = function (R) {
    var c = [], T = R.tech, id, i;
    if (!R.mods.noWeapons) {
      for (i = 0; i < R.weapons.length; i++) {
        var w = R.weapons[i], def = D.WEAPONS[w.id];
        if (w.lvl < BAL.weaponMaxLvl) c.push({ type: 'weapon', id: w.id, w: 10 });
        else if (!w.evolved && T[def.evo.needs] > 0) c.push({ type: 'evolve', id: w.id, w: 45 });
      }
      if (R.weapons.length < BAL.weaponSlots) for (id in D.WEAPONS) if (!Sim.getWeapon(R, id)) c.push({ type: 'newweapon', id: id, w: R.weapons.length < 2 ? 9 : 5 });
    }
    for (i = 0; i < R.pets.length; i++) if (R.pets[i].lvl < BAL.petMaxLvl) c.push({ type: 'pet', id: R.pets[i].id, w: 9 });
    for (id in D.TECH) {
      var n = D.TECH[id], rank = T[id] || 0;
      if (rank >= n.max || !Up.reqMet(R, n)) continue;
      var wt = 8;
      if (R.spec.branch === n.branch) wt *= 1.6;
      if (n.capstone) wt *= 1.6;
      if (rank === 0 && evoKeyFor(R, id)) wt *= 1.7;
      c.push({ type: 'tech', id: id, w: wt });
    }
    for (id in D.SYNERGIES) if (!R.syn[id] && Up.synMet(R, D.SYNERGIES[id])) c.push({ type: 'syn', id: id, w: R.specId === 'hybrid' ? 28 : 14 });
    return c;
  };

  function take(R, pool, out, filter) {
    var sub = filter ? pool.filter(filter) : pool;
    if (!sub.length) return false;
    var pick = sub[R.rngOffer.weighted(sub)];
    pool.splice(pool.indexOf(pick), 1); out.push(pick);
    return true;
  }

  /* Build an offer of R.choices distinct options. exclude: keys shown before a reroll. */
  Up.offer = function (R, exclude) {
    var pool = Up.candidates(R), out = [], n = R.choices;
    if (exclude && pool.length - exclude.length >= n) pool = pool.filter(function (o) { return exclude.indexOf(o.type + ':' + o.id) < 0; });
    if (R.picks.length === 0) {   // first choice of the run is always interesting
      take(R, pool, out, function (o) { return o.type === 'newweapon'; });
      take(R, pool, out, function (o) { return o.type === 'tech'; });
    }
    while (out.length < n && pool.length) take(R, pool, out);
    if (out.length < n) out.push({ type: 'heal', id: 'heal' });
    if (out.length < n) out.push({ type: 'sparks', id: 'sparks' });
    for (var i = 0; i < out.length; i++) out[i].key = out[i].type + ':' + out[i].id;
    R.offer = { options: out, chest: R.chests > 0 };
    return R.offer;
  };

  Up.reroll = function (R) {
    if (R.rerolls <= 0 || !R.offer) return false;
    R.rerolls--;
    Up.offer(R, R.offer.options.map(function (o) { return o.key; }));
    return true;
  };

  Up.apply = function (R, opt) {
    var w, p;
    if (opt.type === 'newweapon') R.weapons.push(Sim.mkWeapon(opt.id));
    else if (opt.type === 'weapon') Sim.getWeapon(R, opt.id).lvl++;
    else if (opt.type === 'evolve') { w = Sim.getWeapon(R, opt.id); w.evolved = true; R.evolved++; Sim.banner(R, 'EVOLVED: ' + D.WEAPONS[opt.id].evo.name + '!', 'good'); Sim.sfx('evolve'); }
    else if (opt.type === 'pet') Sim.getPet(R, opt.id).lvl++;
    else if (opt.type === 'tech') R.tech[opt.id] = (R.tech[opt.id] || 0) + 1;
    else if (opt.type === 'syn') { R.syn[opt.id] = true; R.synCount++; Sim.banner(R, 'SYNERGY: ' + D.SYNERGIES[opt.id].name + '!', 'good'); Sim.sfx('evolve'); }
    else if (opt.type === 'heal') Sim.heal(R, R.stats.maxHp * 0.3);
    else if (opt.type === 'sparks') R.bonusSparks += 15;
    Sim.recalc(R);
    if (opt.type === 'tech' && opt.id === 'e_shield') R.player.shield = R.stats.shieldMax;
    R.picks.push({ type: opt.type, id: opt.id, t: R.t });
    R.pending--; if (R.chests > 0) R.chests--;
    R.offer = null;
  };

  function fmt(v) { return Math.round(v * 100) / 100; }

  /* Human-readable card for an option: exact effects, prerequisites, synergy tags. */
  Up.describe = function (R, opt) {
    var d = { kind: '', title: '', branch: null, lines: [], tags: [], note: '' }, def, i, f, a, b;
    if (opt.type === 'newweapon') {
      def = D.WEAPONS[opt.id]; d.kind = 'New weapon'; d.title = def.name; d.tags = def.tags.slice();
      d.lines.push(def.desc);
      d.lines.push(def.fields.map(function (fl) { return fl[1] + ' ' + fmt(def.lv[0][fl[0]]); }).join(', ') + '.');
      d.note = 'Evolves into ' + def.evo.name + ' at level 5 if you own ' + D.TECH[def.evo.needs].name + '.';
    } else if (opt.type === 'weapon') {
      def = D.WEAPONS[opt.id]; var wl = Sim.getWeapon(R, opt.id).lvl; a = def.lv[wl - 1]; b = def.lv[wl];
      d.kind = 'Weapon level ' + wl + ' to ' + (wl + 1); d.title = def.name; d.tags = def.tags.slice();
      for (i = 0; i < def.fields.length; i++) { f = def.fields[i]; if (a[f[0]] !== b[f[0]]) d.lines.push(f[1] + ': ' + fmt(a[f[0]]) + ' to ' + fmt(b[f[0]])); }
      d.note = wl + 1 === BAL.weaponMaxLvl ? 'Max level. Evolves into ' + def.evo.name + ' if you own ' + D.TECH[def.evo.needs].name + (R.tech[def.evo.needs] ? ' (owned).' : ' (not owned yet).') : '';
    } else if (opt.type === 'evolve') {
      def = D.WEAPONS[opt.id]; d.kind = 'Weapon evolution'; d.title = def.name + ' becomes ' + def.evo.name; d.tags = def.tags.slice();
      d.lines.push(def.evo.desc);
    } else if (opt.type === 'pet') {
      def = D.PETS[opt.id]; var pet = Sim.getPet(R, opt.id), V = def[pet.variant];
      d.kind = 'Pet level ' + pet.lvl + ' to ' + (pet.lvl + 1); d.title = def.name + ' (' + V.name + ')'; d.tags = V.tags.slice(); d.branch = 'swarm';
      d.lines.push('Now: ' + V.desc(pet.lvl)); d.lines.push('Next: ' + V.desc(pet.lvl + 1));
    } else if (opt.type === 'tech') {
      def = D.TECH[opt.id]; var rank = R.tech[opt.id] || 0;
      d.kind = D.BRANCHES[def.branch].name + ' tech' + (def.max > 1 ? ', rank ' + (rank + 1) + ' of ' + def.max : ''); d.title = def.name; d.branch = def.branch; d.tags = def.tags.slice();
      d.lines.push(def.desc); if (def.detail) d.lines.push('Example: ' + def.detail);
      var req = (def.req || []).concat(def.reqAny || []);
      if (req.length) d.note = 'Requires ' + req.map(function (r) { return D.TECH[r].name; }).join(def.reqAny ? ' / ' : ' + ') + ' (owned).';
      var ev = evoKeyFor(R, opt.id); if (ev && rank === 0) d.note += (d.note ? ' ' : '') + 'Unlocks the ' + ev.name + ' evolution (' + ev.evo.name + ').';
    } else if (opt.type === 'syn') {
      def = D.SYNERGIES[opt.id]; d.kind = 'Synergy: ' + def.branches.map(function (x) { return D.BRANCHES[x].name; }).join(' + '); d.title = def.name; d.branch = 'syn';
      d.lines.push(def.desc);
      d.tags = def.tags.map(function (g) { return g.join(' or '); });
      d.note = 'Available because your build has: ' + def.tags.map(function (g) { return g.filter(function (t) { return R.tags[t]; })[0]; }).join(' + ').replace('PetOwned', 'a pet') + '.';
    } else if (opt.type === 'heal') { d.kind = 'Supplies'; d.title = 'Patch Up'; d.lines.push('Heal 30% of your max HP right now.'); }
    else { d.kind = 'Supplies'; d.title = 'Spark Cache'; d.lines.push('+15 Sparks for permanent research.'); }
    for (i = 0; i < d.tags.length; i++) if (d.tags[i] === 'PetOwned') d.tags[i] = 'Any pet';
    return d;
  };

  /* Status of every tech node, for the tech tree screen. */
  Up.nodeState = function (R, id) {
    var n = D.TECH[id], rank = R.tech[id] || 0;
    if (rank >= n.max) return 'max';
    if (rank > 0) return 'owned';
    return Up.reqMet(R, n) ? 'open' : 'locked';
  };
})();
