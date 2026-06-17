// pack.ts — Fase A: empaqueta los .node que EXISTEN en una máquina dada.
// Por cada .node en nativeDir, crea npm/<suffix>/{package.json, <crate>.<suffix>.node}.
// Corre por-máquina: en tu laptop solo empaqueta lo que compilaste; en CI cada runner
// empaqueta el suyo y luego se juntan todos los dirs npm/* antes de publicar.

import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { TRIPLES, suffix } from "../core/triples.js";
import { platformPackageJson } from "./optional-deps.js";

export interface PackResult {
  packed: string[];   // dirs de paquete creados (npm/<suffix>)
  missing: string[];  // triples pedidos cuyo .node no estaba en esta máquina
}

/**
 * Empaqueta cada target cuyo .node exista en nativeDir.
 * @param base       nombre base del paquete: "@brashkie/hello-addon"
 * @param crate      nombre del crate: "hello-addon"
 * @param version    versión a estampar
 * @param targets    triples deseados (de la config)
 * @param nativeDir  dónde están los .node (default "dist-native")
 * @param outDir     dónde crear las carpetas de paquete (default "npm")
 */
export async function pack(
  base: string,
  crate: string,
  version: string,
  targets: string[],
  nativeDir = "dist-native",
  outDir = "npm"
): Promise<PackResult> {
  const packed: string[] = [];
  const missing: string[] = [];

  for (const triple of targets) {
    const t = TRIPLES.find((x) => x.triple === triple);
    if (!t) {
      missing.push(triple);
      continue;
    }

    const fileName = `${crate}.${suffix(t)}.node`;
    const src = path.join(nativeDir, fileName);

    // si esta máquina no compiló este target, se lo salta (lo hizo/hará otro runner)
    if (!existsSync(src)) {
      missing.push(triple);
      continue;
    }

    const pkgDir = path.join(outDir, suffix(t));
    await mkdir(pkgDir, { recursive: true });
    await copyFile(src, path.join(pkgDir, fileName));

    const pkgJson = platformPackageJson(base, crate, version, t);
    await writeFile(
      path.join(pkgDir, "package.json"),
      JSON.stringify(pkgJson, null, 2) + "\n"
    );

    packed.push(pkgDir);
  }

  return { packed, missing };
}
