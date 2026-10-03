/* Syntax check for every script: node tools/check-syntax.js
   Runs `node --check` on each .js file under js/ and tools/. Exit code 1 if any file fails. */
'use strict';
var fs = require('fs'), path = require('path'), cp = require('child_process');
var root = path.resolve(__dirname, '..'), fail = 0, n = 0;
['js', 'tools'].forEach(function (dir) {
  fs.readdirSync(path.join(root, dir)).filter(function (f) { return /\.js$/.test(f); }).sort().forEach(function (f) {
    var r = cp.spawnSync(process.execPath, ['--check', path.join(root, dir, f)], { encoding: 'utf8' });
    n++;
    if (r.status !== 0) { fail++; console.log('  FAIL ' + dir + '/' + f + '\n' + r.stderr); }
    else console.log('  ok   ' + dir + '/' + f);
  });
});
console.log('\n' + (n - fail) + ' of ' + n + ' files pass');
process.exit(fail ? 1 : 0);
