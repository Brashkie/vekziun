// pack.ts — Phase A: packages the .node files that EXIST on a given machine.
// For each .node in nativeDir, creates npm/<suffix>/{package.json, <crate>.<suffix>.node}.
// Runs per-machine: on your laptop it only packages what you compiled; in CI each runner
// packages its own, then all npm/* dirs are gathered before publishing.

import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { TRIPLES, suffix } from "../core/triples.js";
import { platformPackageJson } from "./optional-deps.js";

export interface PackResult {
  packed: string[];   // package dirs created (npm/<suffix>)
  missing: string[];  // requested triples whose .node wasn't on this machine
}

/**
 * Empaqueta cada target cuyo .node exista en nativeDir.
 * @param base       nombre base del paquete: "@brashkie/hello-addon"
 * @param crate      nombre del crate: "hello-addon"
 * @param version    version to stamp
 * @param targets    triples deseados (de la config)
 * @param nativeDir  where the .node files are (default "dist-native")
 * @param outDir     where to create the package folders (default "npm")
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

    // if this machine didn't build this target, skip it (another runner did/will)
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
