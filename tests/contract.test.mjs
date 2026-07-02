// Tests the HEART of Vekziun without Rust: that build and loader produce the SAME suffix.
import { TRIPLES, suffix, packageNameFor } from '../src/core/triples.ts';

console.log('=== CONTRACT: triple -> suffix -> package ===\n');
const base = '@brashkie/my-addon';
for (const t of TRIPLES) {
  const s = suffix(t);
  const file = `my-addon.${s}.node`;        // what build writes to dist/
  const pkg = packageNameFor(base, t);       // what publish names it
  console.log(`${t.triple.padEnd(28)} -> ${s.padEnd(18)} | ${file.padEnd(30)} | ${pkg}`);
}

console.log('\n=== RUNTIME SIMULATION: what the loader would look for on each platform ===\n');
function simulateLoader(platform, arch, musl) {
  let abi = null;
  if (platform === 'win32') abi = 'msvc';
  else if (platform === 'linux') abi = musl ? 'musl' : 'gnu';
  else if (platform === 'android' && arch === 'arm') abi = 'eabi';
  return suffix({ platform, arch, abi });
}
const cases = [
  ['linux', 'x64', false], ['linux', 'x64', true],
  ['darwin', 'arm64', false], ['win32', 'x64', false],
  ['android', 'arm64', false], ['android', 'arm', false],
];
let ok = true;
for (const [p, a, m] of cases) {
  const want = simulateLoader(p, a, m);
  const builtFile = `my-addon.${want}.node`;
  const existsInBuild = TRIPLES.some(t => suffix(t) === want);
  const mark = existsInBuild ? 'OK' : 'NO BUILD';
  if (!existsInBuild) ok = false;
  console.log(`${p}/${a}${m?'/musl':''}`.padEnd(20) + `-> loader looks for ${builtFile.padEnd(32)} [${mark}]`);
}
console.log('\n' + (ok
  ? '✅ Both ends MATCH: what build writes is exactly what the loader looks for.'
  : '❌ Divergence detected.'));

// CRITICAL for CI: fail with exit != 0 if the contract is broken.
// Without this, the pipeline would go green even if build and loader diverge.
if (!ok) {
  console.error('\nContract broken: build and loader produce different suffixes.');
  process.exit(1);
}
