/* Batch balance probe: node tools/batch.js [react] [noise] [diff] */
var h = require('./headless.js'), PSO = h.PSO;
var react = Number(process.argv[2] || 0), noise = Number(process.argv[3] || 0), diff = process.argv[4] || 'normal';
var cfgs = [
  ['rook', 'zap,ember', 'arsenal'], ['rook', 'beetle,ember', 'swarm'], ['rook', 'zap,beetle', 'engineering'],
  ['vex', 'zap,ember', 'swarm'], ['vex', 'frost,magpip', 'arsenal'], ['moss', 'cog,ember', 'engineering'], ['moss', 'beetle,frost', 'swarm']
];
cfgs.forEach(function (c, i) {
  PSO.Bot.react = react; PSO.Bot.noise = noise; PSO.Bot.hold = 0; PSO.Bot.rng = PSO.makeRng(100 + i);
  var res = h.runOnce({ char: c[0], pets: c[1].split(','), spec: c[2], arena: process.argv[5] || 'meadow', diff: diff, seed: 'B' + i }, { afk: process.argv[6] === 'afk' }), R = res.R;
  var top = Object.keys(R.dmgBy).sort(function (x, y) { return R.dmgBy[y] - R.dmgBy[x]; }).slice(0, 4).map(function (k) { return k + ':' + Math.round(R.dmgBy[k] / 1000) + 'k'; }).join(' ');
  console.log(c.join('/').padEnd(30), R.state.padEnd(5), (Math.floor(R.t / 60) + ':' + String(Math.floor(R.t % 60)).padStart(2, '0')).padEnd(6), 'L' + R.level, 'kills', String(R.kills).padEnd(6), 'peak', String(res.peak).padEnd(4), 'taken', String(Math.round(R.dmgTaken)).padEnd(5), 'avg', res.avgMs.toFixed(2), 'max', res.maxMs.toFixed(1), '|', top);
});
