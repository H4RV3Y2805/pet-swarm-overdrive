/* Pet Swarm: Overdrive - ALL content definitions and balance values live here.
   Tweak numbers in this file; no other file hard-codes balance. */
(function () {
  'use strict';
  var PSO = window.PSO = window.PSO || {};

  /* ---------- Global balance ---------- */
  var BAL = {
    viewH: 760,                       // world units visible vertically
    player: { speed: 215, hp: 100, radius: 14, pickup: 95, iframes: 0.6, critChance: 0.05, critMult: 2 },
    xp: { base: 5, lin: 4, powMul: 0.45, pow: 2.2 },   // xp to next level = base + lin*L + powMul*L^pow
    levelHeal: 0.06,                  // heal 6% max HP on each level-up
    weaponSlots: 4, weaponMaxLvl: 5, petMaxLvl: 5,
    rerolls: 2, choices: 3,
    enemyCap: 520, gemCap: 320, particleCap: 420, textCap: 50,
    hpScalePerMin: 0.25, hpScaleQuad: 0.02,   // enemy HP x (1 + 0.25*min + 0.02*min^2)
    dmgScalePerMin: 0.06,
    bossTimes: [360, 720],            // seconds: Gloop King, Hex Engine (final)
    endless: { bossEvery: 180, bossHpStep: 0.6 },
    /* Leaderboard score = round((seconds*perSecond + kills*perKill + boss bonuses) * multiplier).
       Boss bonus per boss killed = bossBase + bossSpeed * max(0, 1 - fightSeconds / bossPar).
       While the FINAL boss of a standard run is alive, seconds and kills do not count, so
       stalling that fight can never raise the score. Weights are provisional. */
    score: { perSecond: 10, perKill: 1, bossBase: 2000, bossSpeed: 12000, bossPar: 120, freezeDuringFinalBoss: true,
             diffMult: { normal: 1, hard: 1, overdrive: 1 }, challengeMult: 1 },
    sparks: { perKills: 80, perMin: 6, perBoss: 40, win: 100 },   // 1 Spark per 80 kills, 6 per minute survived
    turret: { interval: 6, life: 16, dmg: 9, cd: 0.45, range: 340, shotSpeed: 600 },
    trap: { interval: 2.5, max: 6, dmg: 30, radius: 62, root: 1 },
    swarmling: { everyKills: 20, max: 3, life: 15, dmg: 12, biteCd: 0.45, speed: 300 },
    shield: { amount: 25, delay: 6 },
    healOrb: { chance: 0.012, amount: 8 },
    chestChanceElite: 0.35,
    bondForVariant: 10,               // pet bond needed to unlock variant B
    markBonus: 0.2
  };

  var BRANCHES = {
    swarm: { name: 'Swarm', color: '#ff6f91', blurb: 'Pets, pet teamwork and summoned allies.' },
    arsenal: { name: 'Arsenal', color: '#ffc145', blurb: 'Weapons, projectiles, critical hits and explosions.' },
    engineering: { name: 'Engineering', color: '#3ddbc4', blurb: 'Turrets, traps, shields and resource tools.' }
  };

  /* ---------- Characters ---------- */
  var CHARACTERS = {
    rook: {
      name: 'Rook', title: 'Scrapper', hp: 120, speed: 1, weapon: 'bolt', dmgMult: 1.1, petRate: 1, turretCap: 0,
      color: '#ff9f43', passive: '120 HP and +10% weapon damage.',
      ability: { id: 'dash', name: 'Comet Dash', cd: 6, dmg: 40, desc: 'Dash forward. You cannot be hurt while dashing and everything in your path takes 40 damage.' },
      unlock: null
    },
    vex: {
      name: 'Vex', title: 'Stormcaller', hp: 90, speed: 1.08, weapon: 'arc', dmgMult: 1, petRate: 1.15, turretCap: 0,
      color: '#b388ff', passive: '8% faster movement and pets act 15% faster. Only 90 HP.',
      ability: { id: 'clap', name: 'Thunderclap', cd: 10, dmg: 50, radius: 230, stun: 1.5, desc: 'Shockwave around you: 50 damage and a 1.5s stun to every enemy within reach.' },
      unlock: 'ach_lvl10'
    },
    moss: {
      name: 'Moss', title: 'Tinkerer', hp: 100, speed: 1, weapon: 'sentry', dmgMult: 1, petRate: 1, turretCap: 1,
      color: '#2ee6a6', passive: '+1 turret at all times.',
      ability: { id: 'rally', name: 'Rally Beacon', cd: 16, dur: 6, desc: 'For 6s your turrets and pets act twice as fast. Also drops a bonus turret.' },
      unlock: 'ach_boss1'
    }
  };

  /* ---------- Weapons ----------
     lv[] holds exact stats per level (1..5). evo.needs is the run-tech node required to evolve at level 5. */
  var WEAPONS = {
    bolt: {
      name: 'Bolt Caster', tags: ['Projectile'], color: '#7ef9ff',
      desc: 'Fires piercing bolts at the nearest enemy.',
      fields: [['dmg', 'Damage'], ['cd', 'Seconds between shots'], ['count', 'Bolts'], ['pierce', 'Enemies pierced']],
      lv: [{ dmg: 12, cd: 0.75, count: 1, pierce: 2 }, { dmg: 15, cd: 0.68, count: 2, pierce: 2 }, { dmg: 18, cd: 0.6, count: 2, pierce: 3 },
           { dmg: 22, cd: 0.54, count: 3, pierce: 3 }, { dmg: 26, cd: 0.48, count: 3, pierce: 5 }],
      evo: { name: 'Rail Lance', needs: 'a_rapid', dmg: 38, cd: 0.5, len: 900, width: 16,
             desc: 'Bolts become instant beams that hit EVERY enemy in a long line (38 damage each).' }
    },
    arc: {
      name: 'Arc Coil', tags: ['Shock'], color: '#c9a7ff',
      desc: 'Chain lightning that jumps from enemy to enemy.',
      fields: [['dmg', 'Damage'], ['cd', 'Seconds between casts'], ['jumps', 'Jumps']],
      lv: [{ dmg: 14, cd: 1.1, jumps: 3 }, { dmg: 17, cd: 1.02, jumps: 4 }, { dmg: 20, cd: 0.94, jumps: 5 },
           { dmg: 24, cd: 0.86, jumps: 6 }, { dmg: 28, cd: 0.78, jumps: 8 }],
      evo: { name: 'Storm Web', needs: 's_pack', dmg: 32, cd: 0.7, jumps: 14, blast: 60, stun: 0.35,
             desc: 'Lightning jumps up to 14 times, briefly stuns, and every strike explodes (radius 60).' }
    },
    blades: {
      name: 'Orbit Blades', tags: ['Orbit'], color: '#e8f1ff',
      desc: 'Blades circle you and slice anything they touch.',
      fields: [['dmg', 'Damage per slice'], ['count', 'Blades'], ['radius', 'Orbit radius']],
      lv: [{ dmg: 9, count: 2, radius: 78, spin: 3.2 }, { dmg: 11, count: 3, radius: 84, spin: 3.4 }, { dmg: 13, count: 3, radius: 92, spin: 3.7 },
           { dmg: 15, count: 4, radius: 98, spin: 4 }, { dmg: 18, count: 5, radius: 105, spin: 4.3 }],
      hitCd: 0.35,
      evo: { name: 'Saw Halo', needs: 'e_magnet', dmg: 24, inner: 72, outerMin: 130, outerMax: 235,
             desc: 'Adds a second, larger ring of saws that sweeps in and out. 24 damage per slice.' }
    },
    boom: {
      name: 'Boom Seeds', tags: ['Explosion'], color: '#ffd166',
      desc: 'Lobs bombs into the crowd. They explode in an area.',
      fields: [['dmg', 'Damage'], ['cd', 'Seconds between volleys'], ['count', 'Bombs'], ['radius', 'Blast radius']],
      lv: [{ dmg: 26, cd: 1.9, count: 1, radius: 68 }, { dmg: 32, cd: 1.75, count: 2, radius: 72 }, { dmg: 38, cd: 1.6, count: 2, radius: 80 },
           { dmg: 46, cd: 1.45, count: 3, radius: 86 }, { dmg: 55, cd: 1.3, count: 3, radius: 95 }],
      evo: { name: 'Cluster Bloom', needs: 'a_scorch', dmg: 60, minis: 4,
             desc: 'Every bomb scatters 4 mini bombs when it explodes (half damage each).' }
    },
    sentry: {
      name: 'Sentry Pod', tags: ['Turret'], color: '#3ddbc4',
      desc: 'Drops turrets where you stand. Turrets shoot the nearest enemy for 16s.',
      fields: [['dmg', 'Turret damage'], ['cd', 'Seconds between turret shots'], ['cap', 'Turrets at once'], ['interval', 'Seconds between drops']],
      lv: [{ dmg: 9, cd: 0.45, cap: 2, interval: 6 }, { dmg: 11, cd: 0.42, cap: 2, interval: 5.5 }, { dmg: 13, cd: 0.38, cap: 3, interval: 5 },
           { dmg: 15, cd: 0.34, cap: 3, interval: 4.5 }, { dmg: 18, cd: 0.3, cap: 4, interval: 4 }],
      evo: { name: 'Tesla Bastion', needs: 'e_sentry', dmg: 20, linkRange: 460, linkDps: 70,
             desc: 'Turrets never expire and link to each other and to you with lightning fences that fry anything crossing them.' }
    }
  };

  /* ---------- Pets ----------
     Each pet has variant A (default) and variant B (unlocked with Bond).
     All numbers are functions of pet level l (1..5) so the UI can print exact values. */
  var PETS = {
    zap: {
      name: 'Zapkit', kind: 'Lightning', color: '#ffe14d', unlock: null,
      A: { name: 'Chain Spark', tags: ['Shock'], cd: 1.6, dmg: function (l) { return 10 + 4 * l; }, jumps: function (l) { return 2 + l; },
           desc: function (l) { return 'Every 1.6s zaps the nearest enemy for ' + (10 + 4 * l) + ' damage and chains to ' + (2 + l) + ' more.'; } },
      B: { name: 'Storm Mark', tags: ['Shock', 'Explosion'], cd: 2.2, dmg: function (l) { return 30 + 14 * l; }, radius: 60, stun: 0.5,
           desc: function (l) { return 'Every 2.2s smites the toughest nearby enemy: ' + (30 + 14 * l) + ' damage in a small blast and a 0.5s stun.'; } }
    },
    ember: {
      name: 'Emberwyrm', kind: 'Dragon', color: '#ff7b3a', unlock: null,
      A: { name: 'Flame Breath', tags: ['Burn'], cd: 2, range: 200, dmg: function (l) { return 6 + 2 * l; }, burn: function (l) { return 4 + 2 * l; }, burnT: 3,
           desc: function (l) { return 'Every 2s breathes a cone of fire: ' + (6 + 2 * l) + ' damage, then Burn for ' + (4 + 2 * l) + ' damage per second for 3s.'; } },
      B: { name: 'Fire Pool', tags: ['Burn', 'Explosion'], cd: 3.5, radius: 70, life: 4, dmg: function (l) { return 10 + 4 * l; }, burn: function (l) { return 6 + 3 * l; }, burnT: 2,
           desc: function (l) { return 'Every 3.5s spits a fireball (' + (10 + 4 * l) + ' damage) that leaves a burning pool for 4s (' + (6 + 3 * l) + ' damage per second).'; } }
    },
    beetle: {
      name: 'Bulwark Beetle', kind: 'Guardian', color: '#5aa9ff', unlock: null,
      A: { name: 'Barrier', tags: ['Shield'], cd: function (l) { return 11 - l; }, dmg: function (l) { return 15 + 8 * l; }, radius: 130,
           desc: function (l) { return 'Completely blocks one hit every ' + (11 - l) + 's. Blocking releases a shockwave (' + (15 + 8 * l) + ' damage, knocks enemies back).'; } },
      B: { name: 'Thorn Shell', tags: ['Shield'], reduce: function (l) { return 0.15 + 0.03 * l; }, dmg: function (l) { return 12 + 6 * l; },
           desc: function (l) { return 'You take ' + Math.round((0.15 + 0.03 * l) * 100) + '% less damage from every hit. Enemies that hit you take ' + (12 + 6 * l) + ' damage.'; } }
    },
    magpip: {
      name: 'Magpip', kind: 'Collector', color: '#59e0ff', unlock: 'ach_gems',
      A: { name: 'Fetch', tags: ['Collect'], range: 460, speed: function (l) { return 380 + 50 * l; }, pickup: function (l) { return 0.1 * l; }, xp: function (l) { return 0.04 * l; },
           desc: function (l) { return 'Flies out and fetches gems for you. Pickup range +' + (10 * l) + '% and gems give +' + (4 * l) + '% XP.'; } },
      B: { name: 'Treasure Pulse', tags: ['Collect'], cd: function (l) { return 14 - l; }, xp: function (l) { return 0.04 * l; },
           desc: function (l) { return 'Every ' + (14 - l) + 's pulls EVERY gem in the arena to you and gives a 2s speed burst. Gems give +' + (4 * l) + '% XP.'; } }
    },
    cog: {
      name: 'Cogmole', kind: 'Engineer', color: '#d9a066', unlock: 'ach_turrets',
      A: { name: 'Overclock', tags: ['Turret'], cap: 1, rate: function (l) { return 0.1 + 0.06 * l; },
           desc: function (l) { return 'Builds its own turret (+1 turret, dropped every 6s). All turrets fire ' + Math.round((0.1 + 0.06 * l) * 100) + '% faster.'; } },
      B: { name: 'Mine Layer', tags: ['Trap', 'Explosion'], cd: function (l) { return 3.6 - 0.4 * l; }, dmg: function (l) { return 25 + 10 * l; }, radius: 75, max: function (l) { return 5 + l; },
           desc: function (l) { return 'Plants a mine every ' + (3.6 - 0.4 * l).toFixed(1) + 's (up to ' + (5 + l) + '). Mines explode for ' + (25 + 10 * l) + ' damage.'; } }
    },
    frost: {
      name: 'Frostfinch', kind: 'Frost', color: '#aeeaff', unlock: 'ach_kills',
      A: { name: 'Chill Aura', tags: ['Frost'], radius: function (l) { return 150 + 10 * l; }, slow: function (l) { return 0.3 + 0.04 * l; },
           desc: function (l) { return 'Enemies within ' + (150 + 10 * l) + ' of you move ' + Math.round((0.3 + 0.04 * l) * 100) + '% slower (bosses half as much).'; } },
      B: { name: 'Ice Shards', tags: ['Frost'], cd: 1.8, dmg: function (l) { return 8 + 3 * l; }, freeze: 0.8, count: 3,
           desc: function (l) { return 'Every 1.8s fires 3 shards at different enemies: ' + (8 + 3 * l) + ' damage and frozen solid for 0.8s (bosses are slowed instead).'; } }
    }
  };

  /* ---------- Run technology (temporary, per run) ----------
     req: all listed nodes needed. reqAny: at least one needed. needsTag: build must have this tag. */
  var TECH = {
    /* Swarm */
    s_pack: { branch: 'swarm', tier: 1, name: 'Pack Tactics', max: 3, tags: ['Pet'],
      desc: 'Pets act 20% faster per rank.', detail: 'A pet that attacks every 2.0s attacks every 1.67s at rank 1.' },
    s_bond: { branch: 'swarm', tier: 1, name: 'Fierce Bond', max: 3, tags: ['Pet'],
      desc: 'Pet damage +25% per rank.', detail: 'A 20 damage pet attack deals 25 at rank 1.' },
    s_mark: { branch: 'swarm', tier: 2, name: 'Shared Target', max: 1, req: ['s_pack'], tags: ['Pet', 'Mark'],
      desc: 'Enemies hit by a pet are Marked for 3s. Marked enemies take +20% damage from everything.' },
    s_hatch: { branch: 'swarm', tier: 2, name: 'Hatchlings', max: 1, req: ['s_bond'], tags: ['Summon'],
      desc: 'Every 20 kills hatches a Swarmling ally (up to 3). Each bites enemies for 15s.' },
    s_brood: { branch: 'swarm', tier: 3, name: 'Brood Swell', max: 1, req: ['s_hatch'], tags: ['Summon', 'Explosion'],
      desc: '+3 Swarmlings at once. Swarmlings explode when their time runs out (30 damage, radius 70).' },
    s_cap: { branch: 'swarm', tier: 4, name: 'Stampede', max: 1, req: ['s_mark', 's_hatch'], capstone: true, tags: ['Pet'],
      desc: 'CAPSTONE. Every 20s your pets go into a Frenzy for 6s: they act 3x as fast and each pet launches a bonus strike every 0.5s.' },
    /* Arsenal */
    a_sharp: { branch: 'arsenal', tier: 1, name: 'Sharpened', max: 3, tags: ['Weapon'],
      desc: 'Weapon and turret damage +20% per rank.', detail: 'A 20 damage hit deals 24 at rank 1.' },
    a_rapid: { branch: 'arsenal', tier: 1, name: 'Quick Hands', max: 3, tags: ['Weapon'],
      desc: 'Weapons fire 12% faster per rank.', detail: 'A weapon firing every 1.00s fires every 0.89s at rank 1.' },
    a_crit: { branch: 'arsenal', tier: 2, name: 'Keen Eye', max: 1, req: ['a_sharp'], tags: ['Crit'],
      desc: 'Critical hit chance goes from 5% to 20%. A critical hit deals double damage.' },
    a_multi: { branch: 'arsenal', tier: 2, name: 'Multishot', max: 1, req: ['a_rapid'], tags: ['Projectile'],
      desc: '+1 bolt, +1 bomb, +1 blade, +2 lightning jumps, and turrets fire 2 shots.' },
    a_scorch: { branch: 'arsenal', tier: 2, name: 'Scorch Shells', max: 1, req: ['a_sharp'], needsTag: 'Explosion', tags: ['Explosion', 'Burn'],
      desc: 'Your explosions are 30% wider and set enemies on fire (Burn: 8 damage per second for 3s).' },
    a_volatile: { branch: 'arsenal', tier: 3, name: 'Volatile Rounds', max: 1, req: ['a_crit'], tags: ['Crit', 'Explosion'],
      desc: 'Critical hits cause a small explosion (radius 55) for half of the hit\'s damage.' },
    a_cap: { branch: 'arsenal', tier: 4, name: 'Overkill', max: 1, req: ['a_volatile', 'a_multi'], capstone: true, tags: ['Crit', 'Explosion'],
      desc: 'CAPSTONE. Critical hits deal triple damage instead of double. Enemies killed by a critical hit detonate (radius 80) for 60% of their max HP.' },
    /* Engineering */
    e_sentry: { branch: 'engineering', tier: 1, name: 'Pocket Sentry', max: 2, tags: ['Turret'],
      desc: '+1 turret per rank, dropped automatically where you stand. Turrets last 30% longer.' },
    e_magnet: { branch: 'engineering', tier: 1, name: 'Scrap Magnet', max: 3, tags: ['Collect'],
      desc: 'Pickup range +35% and XP from gems +8% per rank.', detail: 'A 10 XP gem gives 10.8 XP at rank 1.' },
    e_trap: { branch: 'engineering', tier: 2, name: 'Snap Traps', max: 1, req: ['e_sentry'], tags: ['Trap', 'Explosion'],
      desc: 'Drop a trap every 2.5s (up to 6). Traps explode for 30 damage (radius 62) and hold enemies in place for 1s.' },
    e_shield: { branch: 'engineering', tier: 2, name: 'Energy Shield', max: 1, req: ['e_magnet'], tags: ['Shield'],
      desc: 'A shield absorbs the next 25 damage. It recharges fully after 6s without being hit.' },
    e_salvage: { branch: 'engineering', tier: 2, name: 'Salvage Drones', max: 1, req: ['e_sentry'], tags: ['Turret', 'Collect'],
      desc: 'Turrets collect nearby gems for you. Enemies killed by turrets or traps have a 12% chance to drop a Repair Orb (heals 8 HP).' },
    e_cap: { branch: 'engineering', tier: 4, name: 'Fortress Protocol', max: 1, req: ['e_shield'], reqAny: ['e_trap', 'e_salvage'], capstone: true, tags: ['Turret', 'Shield'],
      desc: 'CAPSTONE. +2 turrets. Turrets fire 60% faster and their shots pierce 2 enemies. When your Energy Shield recharges it releases an EMP that stuns nearby enemies for 1.5s.' }
  };

  /* ---------- Cross-branch synergies ----------
     tags: every inner list needs at least one tag present in the build. */
  var SYNERGIES = {
    x_pyro: { name: 'Pyro Salvo', branches: ['swarm', 'engineering'], tags: [['Burn'], ['Turret', 'Trap']],
      desc: 'Burning enemies killed by turrets or traps explode (40 damage, radius 75) and spread Burn.' },
    x_signal: { name: 'Hunter\'s Signal', branches: ['arsenal', 'swarm'], tags: [['Crit'], ['PetOwned']],
      desc: 'When a weapon lands a critical hit, every pet launches a bonus strike at that enemy (each pet at most once per 0.6s).' },
    x_halo: { name: 'Scrap Halo', branches: ['engineering', 'arsenal'], tags: [['Orbit'], ['Collect']],
      desc: 'Each gem you pick up makes Orbit Blades 3% faster and bigger for 5s, stacking up to +60%.' },
    x_cryo: { name: 'Cryo Shatter', branches: ['swarm', 'arsenal'], tags: [['Frost'], ['Explosion']],
      desc: 'Explosions deal double damage to Slowed or Frozen enemies.' },
    x_wire: { name: 'Live Wire', branches: ['engineering', 'arsenal'], tags: [['Shock'], ['Turret']],
      desc: 'Whenever your chain lightning fires, every turret fires a copy at 30% damage.' }
  };

  /* ---------- Starting specialisations ---------- */
  var SPECS = {
    swarm: { name: 'Swarm Handler', branch: 'swarm', grant: 's_pack', unlock: null, desc: 'Start with Pack Tactics rank 1. Swarm tech is offered more often.' },
    arsenal: { name: 'Gunsmith', branch: 'arsenal', grant: 'a_sharp', unlock: null, desc: 'Start with Sharpened rank 1. Arsenal tech is offered more often.' },
    engineering: { name: 'Engineer', branch: 'engineering', grant: 'e_sentry', unlock: null, desc: 'Start with Pocket Sentry rank 1. Engineering tech is offered more often.' },
    hybrid: { name: 'Hybrid', branch: null, grant: null, unlock: 'ach_synergy', desc: 'No free tech, but +1 reroll and cross-branch synergies are offered twice as often.' }
  };

  /* ---------- Enemies ---------- */
  var ENEMIES = {
    grub: { name: 'Grub', role: 'Swarmer', hp: 10, speed: 70, dmg: 6, r: 11, xp: 1, group: [3, 5] },
    skitter: { name: 'Skitter', role: 'Fast swarmer', hp: 6, speed: 140, dmg: 5, r: 8, xp: 1, group: [4, 7] },
    dasher: { name: 'Dasher', role: 'Charger', hp: 30, speed: 74, dmg: 13, r: 13, xp: 3, group: [1, 2],
      trigger: 280, wind: 0.7, dashSpeed: 620, dashTime: 0.5, rest: 2.5 },
    spitter: { name: 'Spitter', role: 'Ranged', hp: 22, speed: 60, dmg: 9, r: 12, xp: 3, group: [1, 2],
      near: 220, far: 320, wind: 0.5, shotSpeed: 200, rest: 2.8 },
    puffer: { name: 'Puffer', role: 'Bomber', hp: 30, speed: 88, dmg: 18, r: 13, xp: 3, group: [1, 2],
      trigger: 75, wind: 0.9, radius: 95, allyDmg: 40 },
    brute: { name: 'Brute', role: 'Elite', hp: 240, speed: 46, dmg: 16, r: 24, xp: 20, group: [1, 1], elite: true,
      trigger: 140, wind: 1, radius: 130, slamDmg: 22, rest: 4 }
  };

  var BOSSES = {
    gloop: { name: 'Gloop King', hp: 5200, speed: 70, dmg: 18, r: 46, xp: 120,
      slamRadius: 150, slamWind: 1.1, slamDmg: 24, chargeWind: 0.65, chargeSpeed: 700, chargeTime: 0.5, ringShots: 14, shotSpeed: 180, shotDmg: 10 },
    hex: { name: 'Hex Engine', hp: 15000, speed: 34, dmg: 20, r: 52, xp: 300,
      shotSpeed: 170, shotDmg: 10, laserWind: 1.2, laserTime: 2.6, laserDmg: 16, laserLen: 900, laserSpin: 0.5,
      mortars: 7, mortarRadius: 90, mortarWind: 1.2, mortarDmg: 20 }
  };

  /* Spawn timeline: rate = enemies per second (interpolated between rows), mix = relative weights. */
  var WAVES = [
    { t: 0, rate: 2.5, mix: { grub: 1 } },
    { t: 35, rate: 5, mix: { grub: 6, skitter: 1 } },
    { t: 90, rate: 10, mix: { grub: 6, skitter: 2, dasher: 0.5 } },
    { t: 150, rate: 13, mix: { grub: 7, skitter: 2, dasher: 0.6, spitter: 0.5 } },
    { t: 240, rate: 17, mix: { grub: 7, skitter: 3, dasher: 0.7, spitter: 0.6, puffer: 0.4 } },
    { t: 360, rate: 26, mix: { grub: 8, skitter: 3, dasher: 0.8, spitter: 0.7, puffer: 0.5, brute: 0.06 } },
    { t: 480, rate: 36, mix: { grub: 8, skitter: 4, dasher: 1, spitter: 0.8, puffer: 0.6, brute: 0.1 } },
    { t: 600, rate: 48, mix: { grub: 9, skitter: 5, dasher: 1.1, spitter: 0.9, puffer: 0.7, brute: 0.14 } },
    { t: 720, rate: 60, mix: { grub: 9, skitter: 5, dasher: 1.2, spitter: 1, puffer: 0.8, brute: 0.18 } }
  ];
  var WAVE_ENDLESS_RATE_PER_MIN = 4;   // extra enemies/sec per minute after the last row
  var BOSS_SPAWN_SLOWDOWN = 0.6;         // normal spawns are multiplied by this while a boss lives

  /* Seeded surprise encounters. */
  var ENCOUNTERS = [
    { id: 'ring', name: 'Surrounded!', minT: 50 },
    { id: 'rush', name: 'Dasher rush!', minT: 110 },
    { id: 'flood', name: 'Skitter flood!', minT: 70 },
    { id: 'elite', name: 'Elite patrol!', minT: 180 },
    { id: 'bombers', name: 'Puffer squad!', minT: 250 }
  ];
  var ENCOUNTER_GAP = [38, 58];

  /* ---------- Arenas ---------- */
  function scatter(seed, n, w, h, rMin, rMax, keepClear) {
    var rng = PSO.makeRng(seed), out = [], tries = 0;
    while (out.length < n && tries++ < 2000) {
      var o = { x: rng.range(160, w - 160), y: rng.range(160, h - 160), r: rng.range(rMin, rMax) };
      var dx = o.x - w / 2, dy = o.y - h / 2, ok = dx * dx + dy * dy > keepClear * keepClear;
      for (var i = 0; ok && i < out.length; i++) {
        var ex = out[i].x - o.x, ey = out[i].y - o.y, min = out[i].r + o.r + 150;
        if (ex * ex + ey * ey < min * min) ok = false;
      }
      if (ok) out.push(o);
    }
    return out;
  }
  var ARENAS = {
    meadow: { name: 'Meadow Circuit', w: 2600, h: 2000, unlock: null, ground: '#2f7d5b', ground2: '#35896a', edge: '#17402f',
      desc: 'A wide open field with no hazards. The place to learn.' },
    cavern: { name: 'Crystal Caverns', w: 2400, h: 1900, unlock: 'ach_5min', ground: '#3a3f7a', ground2: '#444a8c', edge: '#1c1f45',
      obstacles: scatter(4242, 15, 2400, 1900, 46, 78, 230),
      desc: 'Crystal pillars block movement and stop enemy shots. Use them as cover.' },
    foundry: { name: 'Molten Foundry', w: 2300, h: 1800, unlock: 'ach_win', ground: '#5a3d36', ground2: '#664640', edge: '#2a1a17',
      vents: scatter(9191, 13, 2300, 1800, 105, 105, 260), vent: { idle: [5, 9], warn: 1.4, burn: 0.9, dmg: 20, enemyDmg: 70 },
      desc: 'Lava vents erupt after a warning. They burn you AND your enemies, so lure the swarm in.' }
  };

  /* ---------- Difficulty ---------- */
  var DIFFS = {
    normal: { name: 'Normal', hp: 1, dmg: 0.8, rate: 1, speed: 1, sparks: 1, unlock: null, desc: 'Forgiving. Best for learning builds.' },
    hard: { name: 'Hard', hp: 1.3, dmg: 1.15, rate: 1.25, speed: 1.08, sparks: 1.5, unlock: null, desc: 'Enemies: +30% HP, hit about 45% harder, +25% numbers. Sparks x1.5.' },
    overdrive: { name: 'Overdrive', hp: 1.7, dmg: 1.5, rate: 1.5, speed: 1.15, sparks: 2.2, unlock: 'ach_hard', desc: 'Enemies: +70% HP, hit almost twice as hard, +50% numbers. Sparks x2.2.' }
  };

  /* ---------- Permanent research (bought with Sparks) ---------- */
  var RESEARCH = {
    r_vital: { name: 'Vitality', max: 3, cost: [40, 80, 140], desc: '+6% max HP per rank.' },
    r_swift: { name: 'Swiftness', max: 3, cost: [40, 80, 140], desc: '+3% movement speed per rank.' },
    r_magnet: { name: 'Magnetism', max: 3, cost: [30, 70, 120], desc: '+10% pickup range per rank.' },
    r_insight: { name: 'Insight', max: 3, cost: [60, 110, 170], req: 'r_magnet', desc: '+4% XP per rank.' },
    r_reroll: { name: 'Second Guess', max: 2, cost: [80, 200], desc: '+1 reroll per run per rank.' },
    r_slot: { name: 'Third Pet Slot', max: 1, cost: [250], desc: 'Equip a third pet. New option, same starting power per pet.' },
    r_choice: { name: 'Wider Horizons', max: 1, cost: [350], req: 'r_reroll', desc: 'Upgrade screens show 4 options instead of 3.' },
    r_start: { name: 'Head Start', max: 1, cost: [200], desc: 'Begin every run with one free upgrade choice.' },
    r_revive: { name: 'Second Wind', max: 1, cost: [300], req: 'r_vital', desc: 'Once per run, get back up with 50% HP instead of losing.' }
  };

  /* ---------- Achievements (each has a gameplay unlock) ----------
     scope run: best single-run value. scope life: lifetime total. scope flag: one-off event. */
  var ACHIEVEMENTS = [
    { id: 'ach_lvl10', name: 'Warming Up', scope: 'run', stat: 'level', goal: 10, desc: 'Reach level 10 in one run.', reward: 'Unlocks Vex the Stormcaller.' },
    { id: 'ach_gems', name: 'Shiny Things', scope: 'run', stat: 'gems', goal: 250, desc: 'Collect 250 gems in one run.', reward: 'Unlocks the pet Magpip.' },
    { id: 'ach_5min', name: 'Still Standing', scope: 'run', stat: 'time', goal: 300, fmt: 'time', desc: 'Survive 5:00 in one run.', reward: 'Unlocks the Crystal Caverns arena.' },
    { id: 'ach_boss1', name: 'Slime Time', scope: 'flag', stat: 'boss_gloop', goal: 1, desc: 'Defeat the Gloop King.', reward: 'Unlocks Moss the Tinkerer.' },
    { id: 'ach_kills', name: 'Pest Control', scope: 'life', stat: 'kills', goal: 1500, desc: 'Defeat 1500 enemies in total.', reward: 'Unlocks the pet Frostfinch.' },
    { id: 'ach_turrets', name: 'Nest of Sentries', scope: 'run', stat: 'turrets', goal: 3, desc: 'Have 3 turrets standing at the same time.', reward: 'Unlocks the pet Cogmole.' },
    { id: 'ach_synergy', name: 'Better Together', scope: 'flag', stat: 'synergy', goal: 1, desc: 'Pick a cross-branch synergy.', reward: 'Unlocks the Hybrid specialisation.' },
    { id: 'ach_evolve', name: 'Next Form', scope: 'flag', stat: 'evolve', goal: 1, desc: 'Evolve a weapon.', reward: '+1 reroll in every run.' },
    { id: 'ach_win', name: 'Overdrive!', scope: 'flag', stat: 'win', goal: 1, desc: 'Defeat the Hex Engine and win a run.', reward: 'Unlocks the Molten Foundry arena.' },
    { id: 'ach_hard', name: 'Hard Hitter', scope: 'flag', stat: 'winHard', goal: 1, desc: 'Win a run on Hard.', reward: 'Unlocks Overdrive difficulty.' },
    { id: 'ach_endless', name: 'Unstoppable', scope: 'run', stat: 'time', goal: 1080, fmt: 'time', desc: 'Reach 18:00 in endless mode.', reward: 'Pets start every run at level 2.' }
  ];

  /* ---------- Challenges: fixed seed + rule twist ---------- */
  var CHALLENGES = {
    ch_glass: { name: 'Glass Cannon', seed: 'GLASS-7', arena: 'meadow', diff: 'normal', reward: 80,
      mods: { dmgMult: 2, hpMult: 0.5 }, desc: 'You deal double damage but have half HP.' },
    ch_pets: { name: 'Pet Parade', seed: 'PARADE-3', arena: 'meadow', diff: 'normal', reward: 80,
      mods: { noWeapons: true, petDmgMult: 2.5, petRate: 1.3 }, desc: 'No weapons at all. Pets deal 2.5x damage and act 30% faster.' },
    ch_horde: { name: 'Horde Night', seed: 'HORDE-9', arena: 'meadow', diff: 'normal', reward: 100,
      mods: { rate: 1.6, xpMult: 1.3 }, desc: '60% more enemies. Gems give 30% more XP.' }
  };

  PSO.DATA = {
    /* Bump only for releases that change gameplay or balance: every bump starts fresh leaderboards. */
    gameVersion: '1.0.0',
    BAL: BAL, BRANCHES: BRANCHES, CHARACTERS: CHARACTERS, WEAPONS: WEAPONS, PETS: PETS, TECH: TECH, SYNERGIES: SYNERGIES,
    SPECS: SPECS, ENEMIES: ENEMIES, BOSSES: BOSSES, WAVES: WAVES, WAVE_ENDLESS_RATE_PER_MIN: WAVE_ENDLESS_RATE_PER_MIN,
    BOSS_SPAWN_SLOWDOWN: BOSS_SPAWN_SLOWDOWN, ENCOUNTERS: ENCOUNTERS, ENCOUNTER_GAP: ENCOUNTER_GAP, ARENAS: ARENAS, DIFFS: DIFFS,
    RESEARCH: RESEARCH, ACHIEVEMENTS: ACHIEVEMENTS, CHALLENGES: CHALLENGES,
    /* Online layer (js/online.js). Only used on http(s); never read by the simulation. */
    ONLINE: { sdkVersion: '12.19.0', timeoutMs: 8000, nickMax: 16, queueCap: 20 }
  };
})();
