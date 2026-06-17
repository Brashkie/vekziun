// Prueba el CORAZÓN de Vekziun sin Rust: que build y loader generen el MISMO sufijo.
import { TRIPLES, suffix, packageNameFor } from '../src/core/triples.ts';

console.log('=== CONTRATO triple -> suffix -> package ===\n');
const base = '@brashkie/my-addon';
for (const t of TRIPLES) {
  const s = suffix(t);
  const file = `my-addon.${s}.node`;        // lo que build escribe en dist/
  const pkg = packageNameFor(base, t);       // lo que publish nombra
  console.log(`${t.triple.padEnd(28)} -> ${s.padEnd(18)} | ${file.padEnd(30)} | ${pkg}`);
}

console.log('\n=== SIMULACRO runtime: qué buscaría el loader en cada plataforma ===\n');
function simulateLoader(platform, arch, musl) {
  let abi = null;
  if (platform === 'win32') abi = 'msvc';
  else if (platform === 'linux') abi = musl ? 'musl' : 'gnu';
  return suffix({ platform, arch, abi });
}
const cases = [
  ['linux', 'x64', false], ['linux', 'x64', true],
  ['darwin', 'arm64', false], ['win32', 'x64', false],
];
let ok = true;
for (const [p, a, m] of cases) {
  const want = simulateLoader(p, a, m);
  const builtFile = `my-addon.${want}.node`;
  const existsInBuild = TRIPLES.some(t => suffix(t) === want);
  const mark = existsInBuild ? 'OK' : 'SIN BUILD';
  if (!existsInBuild) ok = false;
  console.log(`${p}/${a}${m?'/musl':''}`.padEnd(20) + `-> loader busca ${builtFile.padEnd(32)} [${mark}]`);
}
console.log('\n' + (ok
  ? '✅ Las dos puntas COINCIDEN: lo que build escribe es exactamente lo que el loader busca.'
  : '❌ Divergencia detectada.'));

// CRÍTICO para CI: fallar con exit != 0 si el contrato se rompió.
// Sin esto, el pipeline pasaría en verde aunque build y loader diverjan.
if (!ok) {
  console.error('\nContrato roto: build y loader generan sufijos distintos.');
  process.exit(1);
}
