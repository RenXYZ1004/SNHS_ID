#!/usr/bin/env node
/**
 * tests/run.js
 * Runs every *.test.js in this directory and exits non-zero if any check fails.
 *
 *   npm test
 *   npm test -- wizard        (only suites whose name contains "wizard")
 */

const fs = require('fs');
const path = require('path');

const filter = process.argv[2] || '';

const files = fs.readdirSync(__dirname)
  .filter(f => f.endsWith('.test.js'))
  .filter(f => !filter || f.includes(filter))
  .sort();

if (!files.length) {
  console.error('No test suites matched ' + JSON.stringify(filter));
  process.exit(1);
}

let totalPass = 0;
let totalFail = 0;
const failedSuites = [];

function makeT(label) {
  const results = { pass: 0, fail: 0 };
  const t = (name, ok, detail) => {
    if (ok) {
      results.pass++;
      console.log('  [32mPASS[0m  ' + name);
    } else {
      results.fail++;
      console.log('  [31mFAIL[0m  ' + name + (detail ? '  — ' + detail : ''));
    }
  };
  t.results = results;
  t.section = title => console.log('\n  ' + title);
  return t;
}

(async () => {
  for (const file of files) {
    const name = file.replace(/\.test\.js$/, '');
    console.log('\n[1m' + name + '[0m');
    const t = makeT(name);
    try {
      await require(path.join(__dirname, file))(t);
    } catch (err) {
      t.results.fail++;
      console.log('  [31mFAIL[0m  suite threw: ' + (err && err.stack || err));
    }
    totalPass += t.results.pass;
    totalFail += t.results.fail;
    if (t.results.fail) failedSuites.push(name);
  }

  console.log('\n' + '─'.repeat(52));
  console.log(totalPass + ' passed, ' + totalFail + ' failed, ' + files.length + ' suites');
  if (failedSuites.length) console.log('failing: ' + failedSuites.join(', '));
  process.exit(totalFail ? 1 : 0);
})();
