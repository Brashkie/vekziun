// optional-deps.ts — genera los artefactos de publicación a partir de napi.targets.
// TODO sale del MISMO triples.ts: nombres, os, cpu, libc. Sin strings a mano.
// Esto es lo que hace que publish no pueda divergir de build/loader.

import { resolveTriple, suffix, packageNameFor, type PlatformTriple } from "../core/triples.js";

/** package.json de un paquete de plataforma (el que envuelve UN .node) */
export interface PlatformPackageJson {
  name: string;
  version: string;
  os: string[];
  cpu: string[];
  libc?: string[];
  main: string;
  files: string[];
}

/**
 * Construye el package.json de un paquete de plataforma.
 * os/cpu/libc le dicen a npm "ni descargues esto en la plataforma equivocada".
 * El campo libc (npm 10+) es el equivalente declarativo de isMusl() del loader.
 */
export function platformPackageJson(
  base: string,
  crate: string,
  version: string,
  t: PlatformTriple
): PlatformPackageJson {
  const fileName = `${crate}.${suffix(t)}.node`; // MISMO nombre que escribe build
  const pkg: PlatformPackageJson = {
    name: packageNameFor(base, t),
    version,
    os: [t.platform],
    cpu: [t.arch],
    main: fileName,
    files: [fileName],
  };
  // libc solo aplica en linux (gnu/musl); en windows/darwin no se incluye
  if (t.abi === "musl" || t.abi === "gnu") {
    pkg.libc = [t.abi];
  }
  return pkg;
}

/**
 * Construye el bloque optionalDependencies para el package.json PRINCIPAL.
 * Pin EXACTO (no ^ ni ~): el binario nativo y el JS deben ir sincronizados
 * o se rompe el ABI. Este es el bug que casi todos cometen por costumbre.
 */
export function buildOptionalDeps(
  base: string,
  version: string,
  targets: string[]
): Record<string, string> {
  const deps: Record<string, string> = {};
  for (const triple of targets) {
    const t = resolveTriple(triple);
    deps[packageNameFor(base, t)] = version; // exacto, sin rango
  }
  return deps;
}

/**
 * Shim de entrada del paquete PRINCIPAL.
 * El usuario hace `import { sum } from "@brashkie/hello-addon"` y esto carga
 * el .node correcto por plataforma vía loadBinding, sin saber nada de loaders.
 * Se genera como index.cjs para máxima compatibilidad de carga de .node.
 */
export function entryShim(crate: string, base: string): string {
  return `// AUTO-GENERADO por vekziun. No editar a mano.
const { loadBinding } = require("@vekziun/napi/loader");
const binding = loadBinding(${JSON.stringify(crate)}, ${JSON.stringify(base)}, __dirname);
module.exports = binding;
`;
}
