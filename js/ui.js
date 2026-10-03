/* Pet Swarm: Overdrive - menus (DOM). All menus work with the mouse; gameplay uses the keyboard.
   Menus are only built while the game is paused or between runs, never during combat. */
(function () {
  'use strict';
  var PSO = window.PSO, D = PSO.DATA, Save = PSO.Save, S = PSO.Sprites, Up = PSO.Upgrades, Sim = PSO.Sim;
  var UI = PSO.UI = { current: null };
  var root, toastEl, game, toastTimer = null, lo = null;

  /* ---------- tiny DOM helpers ---------- */
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; }
  function add(parent) { for (var i = 1; i < arguments.length; i++) if (arguments[i]) parent.appendChild(arguments[i]); return parent; }
  function click() { if (PSO.Audio) { PSO.Audio.init(); PSO.Audio.play('click'); } }
  function button(label, cls, fn) {
    var b = el('button', 'btn ' + (cls || ''), label); b.type = 'button';
    b.addEventListener('click', function () { click(); fn(b); });
    return b;
  }
  function screen(cls) { root.innerHTML = ''; var s = el('div', 'screen ' + cls); root.appendChild(s); root.className = 'open'; UI.current = cls.split(' ')[0]; return s; }
  UI.hide = function () { root.innerHTML = ''; root.className = ''; UI.current = null; };
  UI.toast = function (msg, bad) {
    toastEl.textContent = msg; toastEl.className = 'show' + (bad ? ' bad' : '');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = ''; }, 3200);
  };
  function mmss(t) { var m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + (s < 10 ? '0' : '') + s; }
  function ach(id) { for (var i = 0; i < D.ACHIEVEMENTS.length; i++) if (D.ACHIEVEMENTS[i].id === id) return D.ACHIEVEMENTS[i]; return null; }
  function lockText(def) { var a = ach(def.unlock); return a ? a.desc : ''; }
  function progressBar(cur, goal, label) {
    var w = el('div', 'bar'); var f = el('div', 'bar-fill'); f.style.width = Math.min(100, Math.round(cur / goal * 100)) + '%';
    add(w, f, el('span', 'bar-label', label)); return w;
  }
  function tagChips(tags) { var w = el('div', 'tags'); tags.forEach(function (t) { w.appendChild(el('span', 'tag', t)); }); return w; }
  function header(title, backFn, extra) {
    var h = el('div', 'head');
    add(h, el('h2', '', title), extra, backFn ? button('Back', 'ghost', backFn) : null);
    return h;
  }
  function card(o) {
    var c = el('div', 'card' + (o.cls ? ' ' + o.cls : '') + (o.selected ? ' selected' : '') + (o.locked ? ' locked' : ''));
    if (o.icon) c.appendChild(o.icon);
    var body = el('div', 'card-body');
    if (o.kind) body.appendChild(el('div', 'card-kind', o.kind));
    body.appendChild(el('div', 'card-title', o.title));
    if (o.sub) body.appendChild(el('div', 'card-sub', o.sub));
    (o.lines || []).forEach(function (l) { body.appendChild(el('div', 'card-text', l)); });
    if (o.extra) body.appendChild(o.extra);
    if (o.locked) body.appendChild(el('div', 'card-lock', 'Locked. ' + o.lockText));
    if (o.selected) body.appendChild(el('div', 'card-check', 'Selected'));
    c.appendChild(body);
    if (o.onClick) {
      c.tabIndex = 0; c.setAttribute('role', 'button');
      var go = function () { click(); if (o.locked) UI.toast('Locked. ' + o.lockText, true); else o.onClick(); };
      c.addEventListener('click', go);
      c.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); go(); } });
    }
    return c;
  }

  UI.init = function (g) {
    game = g; root = document.getElementById('ui'); toastEl = document.getElementById('toast');
  };

  /* ---------- Main menu ---------- */
  UI.showMenu = function () {
    var s = screen('menu'), sv = Save.data;
    var logo = el('h1', 'logo'); add(logo, el('span', 'logo-a', 'Pet Swarm'), el('span', 'logo-b', 'Overdrive'));
    add(s, logo, el('p', 'tagline', 'Pick a team of pets, build something ridiculous, outlast the swarm.'));
    var m = el('div', 'menu-buttons');
    add(m, button('Play', 'primary big', UI.showLoadout),
      button('Research  (' + sv.sparks + ' Sparks)', '', UI.showResearch),
      button('Pets', '', UI.showPets), button('Achievements', '', UI.showAchievements),
      button('How to play', '', UI.showHelp), button('Settings', '', function () { UI.showSettings(false); }));
    s.appendChild(m);
    var goal = Save.nextGoal(), box = el('div', 'panel goal');
    if (goal) {
      var p = Save.achProgress(goal), fmt = goal.fmt === 'time' ? mmss(p.cur) + ' / ' + mmss(p.goal) : Math.floor(p.cur) + ' / ' + p.goal;
      add(box, el('div', 'card-kind', 'Next unlock goal'), el('div', 'card-title', goal.name + ': ' + goal.desc), progressBar(p.cur, p.goal, fmt), el('div', 'card-text', 'Reward: ' + goal.reward));
    } else add(box, el('div', 'card-title', 'Every achievement is done. Try Overdrive difficulty or a seed challenge with a friend!'));
    s.appendChild(box);
    if (!Save.storageOk) s.appendChild(el('div', 'error', 'This browser is blocking local storage for local files, so progress cannot be saved automatically. Use Settings, Export save to keep your progress.'));
    if (Save.lastError) { s.appendChild(el('div', 'error', Save.lastError)); Save.lastError = ''; }
    s.appendChild(el('div', 'foot', 'Runs: ' + sv.life.runs + '   Wins: ' + sv.life.wins + '   Enemies defeated: ' + sv.life.kills));
  };

  /* ---------- Loadout ---------- */
  UI.showLoadout = function () {
    var sv = Save.data, slots = Save.petSlots(), k;
    if (!lo) lo = { char: sv.loadout.char, pets: sv.loadout.pets.slice(), spec: sv.loadout.spec, arena: sv.loadout.arena, diff: sv.loadout.diff, seed: '', challenge: null };
    /* Drop anything no longer valid (for example after a save reset). */
    if (!Save.unlocked(D.CHARACTERS[lo.char])) lo.char = 'rook';
    lo.pets = lo.pets.filter(function (p) { return Save.unlocked(D.PETS[p]); }).slice(0, slots);
    if (!lo.pets.length) lo.pets = ['zap'];
    if (!Save.unlocked(D.SPECS[lo.spec])) lo.spec = 'arsenal';
    if (!Save.unlocked(D.ARENAS[lo.arena])) lo.arena = 'meadow';
    if (!Save.unlocked(D.DIFFS[lo.diff])) lo.diff = 'normal';
    var s = screen('loadout');
    s.appendChild(header('Choose your team', UI.showMenu, button('View tech tree', 'ghost', function () { UI.showTree(null, UI.showLoadout); })));

    var sec = el('section'); add(sec, el('h3', '', 'Character'), el('p', 'hint', 'Each character starts with a different weapon and has a different Space ability.'));
    var grid = el('div', 'grid g3');
    for (k in D.CHARACTERS) (function (id) {
      var c = D.CHARACTERS[id];
      grid.appendChild(card({ icon: S.icon('char', id, 64), title: c.name + ' the ' + c.title, sub: 'Starts with ' + D.WEAPONS[c.weapon].name,
        lines: [c.passive, 'Space: ' + c.ability.name + ' (every ' + c.ability.cd + 's). ' + c.ability.desc],
        selected: lo.char === id, locked: !Save.unlocked(c), lockText: lockText(c), onClick: function () { lo.char = id; UI.showLoadout(); } }));
    })(k);
    add(sec, grid); s.appendChild(sec);

    sec = el('section'); add(sec, el('h3', '', 'Pets (' + lo.pets.length + ' of ' + slots + ' chosen)'),
      el('p', 'hint', slots < 3 ? 'Click to add or remove. A third pet slot can be bought in Research.' : 'Click to add or remove.'));
    grid = el('div', 'grid g3');
    for (k in D.PETS) (function (id) {
      var pd = D.PETS[id], vOk = Save.variantUnlocked(id), v = (vOk && sv.variant[id] === 'B') ? 'B' : 'A', V = pd[v], bond = sv.bond[id] || 0;
      var extra = el('div', 'variant');
      if (vOk) {
        ['A', 'B'].forEach(function (vv) {
          var b = el('button', 'chipbtn' + (v === vv ? ' on' : ''), (v === vv ? 'Using: ' : 'Switch to: ') + pd[vv].name); b.type = 'button';
          b.addEventListener('click', function (ev) { ev.stopPropagation(); click(); sv.variant[id] = vv; Save.persist(); UI.showLoadout(); });
          extra.appendChild(b);
        });
      } else extra.appendChild(el('span', 'card-sub', 'Variant "' + pd.B.name + '" unlocks at Bond ' + D.BAL.bondForVariant + ' (now ' + bond + ').'));
      var sel = lo.pets.indexOf(id) >= 0;
      grid.appendChild(card({ icon: S.icon('pet', id, 64), title: pd.name, sub: pd.kind + ' pet: ' + V.name, lines: [V.desc(1)], extra: extra,
        selected: sel, locked: !Save.unlocked(pd), lockText: lockText(pd),
        onClick: function () {
          if (sel) { if (lo.pets.length > 1) lo.pets.splice(lo.pets.indexOf(id), 1); else UI.toast('You need at least one pet.', true); }
          else if (lo.pets.length < slots) lo.pets.push(id);
          else { lo.pets.shift(); lo.pets.push(id); }
          UI.showLoadout();
        } }));
    })(k);
    add(sec, grid); s.appendChild(sec);

    sec = el('section'); add(sec, el('h3', '', 'Starting specialisation'), el('p', 'hint', 'You can still take upgrades from every branch during the run.'));
    grid = el('div', 'grid g4');
    for (k in D.SPECS) (function (id) {
      var sp = D.SPECS[id];
      grid.appendChild(card({ icon: S.icon('ui', sp.branch || 'syn', 48), title: sp.name, sub: sp.branch ? D.BRANCHES[sp.branch].blurb : 'Mix everything.', lines: [sp.desc],
        selected: lo.spec === id, locked: !Save.unlocked(sp), lockText: lockText(sp), onClick: function () { lo.spec = id; UI.showLoadout(); } }));
    })(k);
    add(sec, grid); s.appendChild(sec);

    sec = el('section'); add(sec, el('h3', '', 'Arena and difficulty'));
    grid = el('div', 'grid g3');
    for (k in D.ARENAS) (function (id) {
      var a = D.ARENAS[id];
      grid.appendChild(card({ title: a.name, lines: [a.desc], selected: !lo.challenge && lo.arena === id, locked: !Save.unlocked(a), lockText: lockText(a), onClick: function () { lo.arena = id; lo.challenge = null; UI.showLoadout(); } }));
    })(k);
    sec.appendChild(grid);
    grid = el('div', 'grid g3');
    for (k in D.DIFFS) (function (id) {
      var df = D.DIFFS[id];
      grid.appendChild(card({ title: df.name, lines: [df.desc], selected: !lo.challenge && lo.diff === id, locked: !Save.unlocked(df), lockText: lockText(df), onClick: function () { lo.diff = id; lo.challenge = null; UI.showLoadout(); } }));
    })(k);
    add(sec, grid); s.appendChild(sec);

    sec = el('section'); add(sec, el('h3', '', 'Seed and challenges'),
      el('p', 'hint', 'The seed decides upgrade offers and surprise encounters. Leave it empty for a random run, or type one to replay it or race a friend.'));
    var row = el('div', 'row'), inp = el('input', 'seed'); inp.type = 'text'; inp.maxLength = 24; inp.placeholder = 'Random seed'; inp.value = lo.seed; inp.setAttribute('aria-label', 'Seed');
    inp.addEventListener('input', function () { lo.seed = inp.value.replace(/[^\w\- ]/g, '').slice(0, 24); });
    inp.addEventListener('keydown', function (ev) { ev.stopPropagation(); });
    add(row, el('label', 'lbl', 'Seed'), inp); sec.appendChild(row);
    grid = el('div', 'grid g3');
    for (k in D.CHALLENGES) (function (id) {
      var ch = D.CHALLENGES[id], done = sv.challenges[id];
      grid.appendChild(card({ kind: 'Challenge' + (done ? ' (completed)' : ''), title: ch.name, lines: [ch.desc, 'Fixed seed ' + ch.seed + ' on ' + D.ARENAS[ch.arena].name + ', ' + D.DIFFS[ch.diff].name + '. First win: +' + ch.reward + ' Sparks.'],
        selected: lo.challenge === id, onClick: function () { lo.challenge = lo.challenge === id ? null : id; UI.showLoadout(); } }));
    })(k);
    add(sec, grid); s.appendChild(sec);

    var foot = el('div', 'footbar');
    add(foot, el('div', 'card-text', D.CHARACTERS[lo.char].name + ' with ' + lo.pets.map(function (p) { return D.PETS[p].name; }).join(' + ') + (lo.challenge ? ', challenge: ' + D.CHALLENGES[lo.challenge].name : '')),
      button('Start run', 'primary big', function () {
        sv.loadout = { char: lo.char, pets: lo.pets.slice(), spec: lo.spec, arena: lo.arena, diff: lo.diff }; Save.persist();
        game.startRun({ char: lo.char, pets: lo.pets.slice(), spec: lo.spec, arena: lo.arena, diff: lo.diff, seed: lo.seed.trim(), challenge: lo.challenge });
      }));
    s.appendChild(foot);
  };

  /* ---------- Research ---------- */
  UI.showResearch = function () {
    var s = screen('research'), sv = Save.data, k;
    s.appendChild(header('Permanent research', UI.showMenu, el('div', 'sparks', sv.sparks + ' Sparks')));
    s.appendChild(el('p', 'hint', 'Research is kept forever. It adds options and small boosts. Your run build (weapons, pets, run tech) always starts fresh. Sparks come from playing: kills, time survived, bosses and wins.'));
    var grid = el('div', 'grid g3');
    for (k in D.RESEARCH) (function (id) {
      var r = D.RESEARCH[id], rank = sv.research[id] || 0, maxed = rank >= r.max, needReq = r.req && !(sv.research[r.req] > 0), cost = maxed ? 0 : r.cost[rank];
      var b = button(maxed ? 'Maxed' : needReq ? 'Needs ' + D.RESEARCH[r.req].name : sv.sparks < cost ? 'Need ' + cost + ' Sparks' : 'Buy for ' + cost + ' Sparks', 'small' + (!maxed && !needReq && sv.sparks >= cost ? ' primary' : ''),
        function () { if (Save.buyResearch(id)) { UI.toast(r.name + ' researched.'); UI.showResearch(); } });
      b.disabled = maxed || needReq || sv.sparks < cost;
      grid.appendChild(card({ kind: 'Rank ' + rank + ' of ' + r.max + (r.req ? '   (requires ' + D.RESEARCH[r.req].name + ')' : ''), title: r.name, lines: [r.desc], extra: b, cls: maxed ? 'done' : '' }));
    })(k);
    s.appendChild(grid);
  };

  /* ---------- Pets collection ---------- */
  UI.showPets = function () {
    var s = screen('pets'), sv = Save.data, k;
    s.appendChild(header('Pets', UI.showMenu));
    s.appendChild(el('p', 'hint', 'Pets earn Bond equal to the level they reach in each run. Bond ' + D.BAL.bondForVariant + ' unlocks the pet\'s second ability variant. Pets always start a run at level 1.'));
    var grid = el('div', 'grid g2');
    for (k in D.PETS) (function (id) {
      var pd = D.PETS[id], bond = sv.bond[id] || 0, unlocked = Save.unlocked(pd), need = D.BAL.bondForVariant;
      var extra = el('div');
      add(extra, el('div', 'card-sub', 'Variant A: ' + pd.A.name), el('div', 'card-text', 'Level 1: ' + pd.A.desc(1)), el('div', 'card-text', 'Level 5: ' + pd.A.desc(5)), tagChips(pd.A.tags),
        el('div', 'card-sub', 'Variant B: ' + pd.B.name + (bond >= need ? '' : ' (locked)')), el('div', 'card-text', 'Level 1: ' + pd.B.desc(1)), el('div', 'card-text', 'Level 5: ' + pd.B.desc(5)), tagChips(pd.B.tags),
        progressBar(Math.min(bond, need), need, 'Bond ' + bond + ' / ' + need));
      grid.appendChild(card({ icon: S.icon('pet', id, 72), kind: pd.kind + ' pet', title: pd.name, extra: extra, locked: !unlocked, lockText: 'To unlock: ' + lockText(pd) }));
    })(k);
    s.appendChild(grid);
  };

  /* ---------- Achievements ---------- */
  UI.showAchievements = function () {
    var s = screen('achievements');
    s.appendChild(header('Achievements', UI.showMenu));
    var grid = el('div', 'grid g2');
    D.ACHIEVEMENTS.forEach(function (a) {
      var p = Save.achProgress(a), fmt = a.fmt === 'time' ? mmss(p.cur) + ' / ' + mmss(p.goal) : Math.floor(p.cur) + ' / ' + p.goal;
      grid.appendChild(card({ kind: p.done ? 'Done' : 'In progress', title: a.name, lines: [a.desc, 'Reward: ' + a.reward], extra: p.done ? null : progressBar(p.cur, p.goal, fmt), cls: p.done ? 'done' : '' }));
    });
    s.appendChild(grid);
  };

  /* ---------- How to play ---------- */
  UI.showHelp = function () {
    var s = screen('help');
    s.appendChild(header('How to play', UI.showMenu));
    var box = el('div', 'panel');
    [['Move', 'W A S D or the arrow keys. Your weapons and pets attack on their own.'],
     ['Ability', 'Space uses your character\'s ability when it is ready.'],
     ['Pause', 'Esc or P. The game also pauses by itself if you click away.'],
     ['Level up', 'Collect gems, then choose one upgrade (click it or press its number). Reroll with R if you have rerolls left.'],
     ['Danger', 'Red striped zones with a "!" are enemy attacks about to land. Spiky red stars are enemy shots. Everything else that glows is yours.'],
     ['Build', 'Weapons evolve at level 5 if you own their key tech. Three tech branches (Swarm, Arsenal, Engineering) mix into cross-branch synergies.'],
     ['Goal', 'Beat the Gloop King at 6:00 and the Hex Engine at 12:00. Then keep going in endless mode if you dare.'],
     ['Progress', 'Every run earns Sparks for permanent research, win or lose. Achievements unlock characters, pets, arenas and more.']
    ].forEach(function (r) { var line = el('div', 'helprow'); add(line, el('strong', '', r[0]), el('span', '', r[1])); box.appendChild(line); });
    s.appendChild(box);
    var grid = el('div', 'grid g3');
    for (var k in D.ENEMIES) grid.appendChild(card({ icon: S.icon('enemy', k, 48), title: D.ENEMIES[k].name, sub: D.ENEMIES[k].role, cls: 'flat' }));
    add(s, el('h3', '', 'Enemies'), grid);
  };

  /* ---------- Settings ---------- */
  function slider(label, key) {
    var st = Save.data.settings, row = el('div', 'row'), inp = el('input'), val = el('span', 'val', Math.round(st[key] * 100) + '%');
    inp.type = 'range'; inp.min = 0; inp.max = 100; inp.value = Math.round(st[key] * 100); inp.setAttribute('aria-label', label);
    inp.addEventListener('input', function () { st[key] = inp.value / 100; val.textContent = inp.value + '%'; PSO.Audio.init(); PSO.Audio.setVolumes(st); });
    inp.addEventListener('change', function () { Save.persist(); PSO.Audio.play('pickup'); });
    add(row, el('label', 'lbl', label), inp, val); return row;
  }
  function toggle(label, key, hint) {
    var st = Save.data.settings, row = el('div', 'row');
    var b = button(st[key] ? 'On' : 'Off', 'small toggle' + (st[key] ? ' on' : ''), function () { st[key] = !st[key]; b.textContent = st[key] ? 'On' : 'Off'; b.className = 'btn small toggle' + (st[key] ? ' on' : ''); Save.persist(); if (key === 'lowFx') PSO.Render.resize(); });
    add(row, el('label', 'lbl', label), b, el('span', 'hint', hint)); return row;
  }
  function settingsPanel() {
    var box = el('div', 'panel');
    add(box, el('h3', '', 'Sound'), slider('Master volume', 'master'), slider('Effects volume', 'sfx'), slider('Music volume', 'music'),
      el('h3', '', 'Visual effects'), toggle('Screen shake', 'shake', 'Camera shakes on big hits.'), toggle('Damage numbers', 'numbers', 'Numbers pop out of enemies.'),
      toggle('Low effects mode', 'lowFx', 'Fewer particles and no damage numbers. Use on slower PCs.'), toggle('Show FPS', 'fps', 'Frame rate and enemy count in the corner.'));
    return box;
  }
  UI.showSettings = function (inRun) {
    var s = screen('settings');
    s.appendChild(header('Settings', inRun ? function () { UI.showPause(game.R); } : UI.showMenu));
    s.appendChild(settingsPanel());
    if (inRun) return;
    var box = el('div', 'panel'), err = el('div', 'error hidden'), file = el('input'); file.type = 'file'; file.accept = '.json,application/json'; file.className = 'hidden';
    file.addEventListener('change', function () {
      var f = file.files && file.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        var res = Save.importString(String(rd.result));
        if (res.ok) { lo = null; PSO.settings = Save.data.settings; PSO.Render.resize(); PSO.Audio.setVolumes(Save.data.settings); UI.showSettings(false); UI.toast('Save imported.'); }
        else { err.textContent = 'Import failed: ' + res.error; err.className = 'error'; }
        file.value = '';
      };
      rd.onerror = function () { err.textContent = 'Import failed: the file could not be read.'; err.className = 'error'; };
      rd.readAsText(f);
    });
    var confirmBox = el('div', 'confirm hidden');
    add(confirmBox, el('div', 'card-text', 'Erase ALL progress (Sparks, research, unlocks, achievements)? This cannot be undone.'),
      button('Yes, erase everything', 'danger small', function () { Save.reset(); lo = null; PSO.settings = Save.data.settings; PSO.Render.resize(); PSO.Audio.setVolumes(Save.data.settings); UI.showSettings(false); UI.toast('Save erased.'); }),
      button('Keep my save', 'small', function () { confirmBox.className = 'confirm hidden'; }));
    var rowB = el('div', 'row');
    add(rowB, button('Export save to file', 'small', function () {
      try {
        var blob = new Blob([Save.exportString()], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = 'pet-swarm-save.json'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000); UI.toast('Save exported as pet-swarm-save.json');
      } catch (e) { err.textContent = 'Export failed in this browser: ' + e.message; err.className = 'error'; }
    }), button('Import save from file', 'small', function () { err.className = 'error hidden'; file.click(); }),
      button('Reset save', 'danger small', function () { confirmBox.className = 'confirm'; }));
    add(box, el('h3', '', 'Save data'), el('p', 'hint', Save.storageOk ? 'Progress saves automatically in this browser. Export a file as a backup or to move to another PC.' : 'Automatic saving is blocked by this browser for local files. Export a file to keep progress.'), rowB, file, err, confirmBox);
    s.appendChild(box);
  };

  /* ---------- Tech tree (preview from loadout, or live build from pause) ---------- */
  UI.showTree = function (R, backFn) {
    var s = screen('tree'), k;
    s.appendChild(header(R ? 'Your build' : 'Run technology', backFn));
    s.appendChild(el('p', 'hint', 'Run tech only lasts for the current run. Take tier 1 nodes to open the ones below. Capstones need two earlier nodes.'));
    if (R) {
      var bl = el('div', 'panel');
      add(bl, el('div', 'card-text', 'Weapons: ' + (R.weapons.map(function (w) { var d = D.WEAPONS[w.id]; return (w.evolved ? d.evo.name : d.name + ' Lv' + w.lvl); }).join(', ') || 'none')),
        el('div', 'card-text', 'Pets: ' + R.pets.map(function (p) { return D.PETS[p.id].name + ' (' + D.PETS[p.id][p.variant].name + ') Lv' + p.lvl; }).join(', ')),
        el('div', 'card-text', 'Build tags: ' + (Object.keys(R.tags).filter(function (t) { return t !== 'PetOwned'; }).join(', ') || 'none')));
      s.appendChild(bl);
    }
    var cols = el('div', 'grid g3');
    for (k in D.BRANCHES) (function (bid) {
      var b = D.BRANCHES[bid], col = el('div', 'branch b-' + bid), hd = el('div', 'branch-head');
      add(hd, S.icon('ui', bid, 40), el('div', '', b.name), el('span', 'hint', b.blurb)); col.appendChild(hd);
      Object.keys(D.TECH).filter(function (id) { return D.TECH[id].branch === bid; }).sort(function (x, y) { return D.TECH[x].tier - D.TECH[y].tier; }).forEach(function (id) {
        var n = D.TECH[id], rank = R ? (R.tech[id] || 0) : 0, state = R ? Up.nodeState(R, id) : 'info';
        var label = state === 'max' ? 'Owned (max)' : state === 'owned' ? 'Owned, rank ' + rank + ' of ' + n.max : state === 'open' ? 'Available' : state === 'locked' ? 'Locked' : (n.max > 1 ? n.max + ' ranks' : '1 rank');
        var req = (n.req || []).map(function (r) { return D.TECH[r].name; }).join(' + ');
        if (n.reqAny) req += (req ? ' + ' : '') + '(' + n.reqAny.map(function (r) { return D.TECH[r].name; }).join(' or ') + ')';
        if (n.needsTag) req += (req ? ' + ' : '') + 'an ' + n.needsTag + ' source';
        var lines = [n.desc]; if (n.detail) lines.push('Example: ' + n.detail); lines.push(req ? 'Requires: ' + req : 'No requirement (tier 1).');
        col.appendChild(card({ kind: (n.capstone ? 'Capstone. ' : 'Tier ' + n.tier + '. ') + label, title: n.name, lines: lines, extra: tagChips(n.tags), cls: 'node ' + state + (n.capstone ? ' cap' : '') }));
      });
      cols.appendChild(col);
    })(k);
    s.appendChild(cols);
    add(s, el('h3', '', 'Cross-branch synergies'), el('p', 'hint', 'A synergy can be offered once your build has every tag it needs.'));
    var grid = el('div', 'grid g3');
    for (k in D.SYNERGIES) {
      var sy = D.SYNERGIES[k], st = R ? (R.syn[k] ? 'Active' : Up.synMet(R, sy) ? 'Available: can appear in offers' : 'Missing a tag') : '';
      grid.appendChild(card({ icon: S.icon('ui', 'syn', 40), kind: sy.branches.map(function (x) { return D.BRANCHES[x].name; }).join(' + ') + (st ? '. ' + st : ''), title: sy.name, lines: [sy.desc],
        extra: tagChips(sy.tags.map(function (g) { return 'Needs ' + g.join(' or ').replace('PetOwned', 'any pet'); })), cls: 'node ' + (R && R.syn[k] ? 'max' : '') }));
    }
    s.appendChild(grid);
  };

  /* ---------- Level up ---------- */
  function optionIcon(opt) {
    if (opt.type === 'pet') return S.icon('pet', opt.id, 56);
    if (opt.type === 'tech') return S.icon('ui', D.TECH[opt.id].branch, 56);
    if (opt.type === 'syn') return S.icon('ui', 'syn', 56);
    if (opt.type === 'heal' || opt.type === 'sparks') return S.icon('ui', opt.type, 56);
    return S.icon('ui', opt.id, 56);
  }
  UI.showLevelUp = function (R) {
    var s = screen('levelup overlay'), of = R.offer;
    add(s, el('h2', '', of.chest ? 'Chest opened! Pick a free upgrade' : 'Level ' + R.level + '! Pick an upgrade'));
    var grid = el('div', 'grid g' + Math.min(4, of.options.length) + ' offers');
    of.options.forEach(function (opt, i) {
      var d = Up.describe(R, opt), extra = el('div');
      if (d.tags.length) extra.appendChild(tagChips(d.tags));
      if (d.note) extra.appendChild(el('div', 'card-note', d.note));
      var c = card({ icon: optionIcon(opt), kind: d.kind, title: d.title, lines: d.lines, extra: extra, cls: 'offer t-' + opt.type + (d.branch ? ' b-' + d.branch : ''), onClick: function () { game.pickUpgrade(i); } });
      c.insertBefore(el('div', 'keycap', String(i + 1)), c.firstChild);
      grid.appendChild(c);
    });
    s.appendChild(grid);
    var foot = el('div', 'row center');
    var rb = button('Reroll (R)   ' + R.rerolls + ' left', 'small', function () { game.reroll(); }); rb.disabled = R.rerolls <= 0;
    add(foot, rb, el('span', 'hint', 'Click a card or press its number. The game is paused.'));
    s.appendChild(foot);
  };

  /* ---------- Pause ---------- */
  UI.showPause = function (R) {
    var s = screen('pause overlay');
    add(s, el('h2', '', 'Paused'), el('p', 'hint', 'Move: W A S D or arrows.  Ability: Space.  Pause: Esc or P.'));
    var m = el('div', 'menu-buttons');
    var confirmBox = el('div', 'confirm hidden');
    add(confirmBox, el('div', 'card-text', 'End this run now? You keep the Sparks and progress earned so far.'),
      button('Yes, end run', 'danger small', function () { game.endRun(); }), button('Keep playing', 'small', function () { confirmBox.className = 'confirm hidden'; }));
    add(m, button('Resume', 'primary big', function () { game.resume(); }),
      button('Build and tech tree', '', function () { UI.showTree(R, function () { UI.showPause(R); }); }),
      button('Settings', '', function () { UI.showSettings(true); }),
      button('End run', 'danger', function () { confirmBox.className = 'confirm'; }));
    add(s, m, confirmBox);
  };

  /* ---------- End-of-run summary ---------- */
  var SRC = { turret: 'Turrets', burn: 'Burn', volatile: 'Volatile Rounds', overkill: 'Overkill', pyro: 'Pyro Salvo', wire: 'Live Wire', swarmling: 'Swarmlings',
    trap: 'Snap Traps', emp: 'Shield EMP', hazard: 'Arena hazards and Puffers', revive: 'Second Wind' };
  function srcName(R, k) {
    if (D.WEAPONS[k]) { var w = Sim.getWeapon(R, k); return w && w.evolved ? D.WEAPONS[k].evo.name : D.WEAPONS[k].name; }
    if (D.PETS[k]) return D.PETS[k].name;
    if (k === 'ability') return R.char.ability.name;
    return SRC[k] || k;
  }
  UI.showSummary = function (R, bank, reason) {
    var won = R.won, s = screen('summary overlay'), k;
    var title = reason === 'won' ? 'Victory! The Hex Engine is scrap.' : reason === 'quit' ? 'Run ended' : won ? 'Endless run over' : 'Defeated';
    add(s, el('h2', won ? 'good' : '', title));
    var stats = el('div', 'grid g4 stats');
    [['Time survived', mmss(R.t)], ['Level', R.level], ['Enemies defeated', R.kills], ['Bosses defeated', R.bossKills],
     ['Character', R.char.name], ['Arena', R.arena.name], ['Difficulty', R.diff.name], ['Seed', R.seedStr]].forEach(function (r) {
      var b = el('div', 'stat'); add(b, el('div', 'stat-v', String(r[1])), el('div', 'stat-k', r[0])); stats.appendChild(b);
    });
    s.appendChild(stats);

    var cols = el('div', 'grid g2');
    var build = el('div', 'panel');
    add(build, el('h3', '', 'Build'),
      el('div', 'card-text', 'Weapons: ' + (R.weapons.map(function (w) { var d = D.WEAPONS[w.id]; return w.evolved ? d.evo.name + ' (evolved)' : d.name + ' Lv' + w.lvl; }).join(', ') || 'none')),
      el('div', 'card-text', 'Pets: ' + R.pets.map(function (p) { return D.PETS[p.id].name + ' Lv' + p.lvl + ' (' + D.PETS[p.id][p.variant].name + ')'; }).join(', ')));
    for (k in D.BRANCHES) {
      var names = Object.keys(R.tech).filter(function (id) { return D.TECH[id].branch === k; }).map(function (id) { var n = D.TECH[id]; return n.name + (n.max > 1 ? ' x' + R.tech[id] : ''); });
      build.appendChild(el('div', 'card-text', D.BRANCHES[k].name + ' tech: ' + (names.join(', ') || 'none')));
    }
    build.appendChild(el('div', 'card-text', 'Synergies: ' + (Object.keys(R.syn).map(function (id) { return D.SYNERGIES[id].name; }).join(', ') || 'none')));
    cols.appendChild(build);

    var dmg = el('div', 'panel'), keys = Object.keys(R.dmgBy).sort(function (a, b) { return R.dmgBy[b] - R.dmgBy[a]; }), total = 0;
    keys.forEach(function (key) { total += R.dmgBy[key]; });
    dmg.appendChild(el('h3', '', 'Damage dealt'));
    keys.slice(0, 8).forEach(function (key) {
      var pct = total ? R.dmgBy[key] / total : 0;
      dmg.appendChild(progressBar(pct, keys.length ? R.dmgBy[keys[0]] / total : 1, srcName(R, key) + ': ' + Math.round(R.dmgBy[key]).toLocaleString() + ' (' + Math.round(pct * 100) + '%)'));
    });
    if (!keys.length) dmg.appendChild(el('div', 'card-text', 'No damage dealt.'));
    cols.appendChild(dmg);
    s.appendChild(cols);

    var rew = el('div', 'panel rewards');
    add(rew, el('h3', '', 'Progress'), el('div', 'card-title', '+' + bank.sparks + ' Sparks' + (bank.challenge ? '   +' + bank.challenge + ' challenge bonus' : '') + '   (total ' + Save.data.sparks + ')'));
    bank.newAch.forEach(function (a) { rew.appendChild(el('div', 'unlock', 'Achievement: ' + a.name + '. ' + a.reward)); });
    bank.newVariants.forEach(function (pid) { rew.appendChild(el('div', 'unlock', D.PETS[pid].name + ' unlocked the variant "' + D.PETS[pid].B.name + '". Switch to it when choosing pets.')); });
    var goal = Save.nextGoal();
    if (goal) { var p = Save.achProgress(goal); add(rew, el('div', 'card-sub', 'Next unlock goal: ' + goal.name + '. ' + goal.desc + ' Reward: ' + goal.reward), progressBar(p.cur, p.goal, goal.fmt === 'time' ? mmss(p.cur) + ' / ' + mmss(p.goal) : Math.floor(p.cur) + ' / ' + p.goal)); }
    s.appendChild(rew);

    var foot = el('div', 'row center');
    if (reason === 'won') foot.appendChild(button('Keep going: endless mode', 'primary', function () { game.continueEndless(); }));
    add(foot, button('Play again (new seed)', reason === 'won' ? '' : 'primary', function () { var c = JSON.parse(JSON.stringify(R.cfg)); c.seed = ''; game.startRun(c); }),
      button('Replay seed ' + R.seedStr, '', function () { var c = JSON.parse(JSON.stringify(R.cfg)); c.seed = R.seedStr; game.startRun(c); }),
      button('Change team', '', function () { game.toMenu(); UI.showLoadout(); }), button('Main menu', 'ghost', function () { game.toMenu(); }));
    s.appendChild(foot);
  };
})();
