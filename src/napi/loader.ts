// loader.ts — runtime loader. Rebuilds the SAME suffix() as build,
// detects musl correctly, and tries the local binary before the npm package.
// This is the other end of the contract: if suffix() matches build, it never diverges.

import path from "node:path";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { suffix, type Abi } from "../core/triples.js";

// In ESM, `require` and `__dirname` do NOT exist as globals. We rebuild them:
// createRequire gives a require able to load native .node files from an ESM module.
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Detecta musl vs glibc. ESTE es el punto donde mueren el 90% de los addons NAPI
 * in production (Alpine/Docker). glibc exposes glibcVersionRuntime in process.report;
 * musl no lo tiene.
 */
function isMusl(): boolean {
  try {
    const report = (process as unknown as {
      report?: { getReport?: () => { header?: { glibcVersionRuntime?: string } } };
    }).report?.getReport?.();
    return !report?.header?.glibcVersionRuntime;
  } catch {
    return false; // without process.report, assume glibc (the common case)
  }
}

/** current machine's suffix — MUST match what build wrote */
function currentSuffix(): string {
  const platform = process.platform;
  const arch = process.arch;
  let abi: Abi = null;
  if (platform === "win32") abi = "msvc";
  else if (platform === "linux") abi = isMusl() ? "musl" : "gnu";
  // Android: 32-bit arm carries the eabi suffix (android-arm-eabi); arm64 does not.
  // process.platform returns "android" in Node on Android (verified vs napi-rs).
  else if (platform === "android" && arch === "arm") abi = "eabi";
  return suffix({ platform, arch, abi });
}

/**
 * Carga el binding nativo para la plataforma actual.
 * @param crate  nombre del crate (parte de archivo): "my-addon"
 * @param base   nombre base del paquete npm: "@brashkie/my-addon"
 * @param dir    where to look for the local .node (default: next to the loader)
 */
export function loadBinding(crate: string, base: string, dir = __dirname): unknown {
  const target = currentSuffix();
  const localFile = path.join(dir, `${crate}.${target}.node`);

  // 1) LOCAL binary first -> allows `vekziun build` + test without publishing.
  //    We distinguish "file doesn't exist" from "exists but failed to load":
  //    if it exists and require() blows up, we propagate the REAL error (don't hide it).
  if (existsSync(localFile)) {
    return require(localFile);
  }

  // 2) platform package from optionalDependencies
  const pkg = `${base}-${target}`;
  try {
    return require(pkg);
  } catch (err) {
    // if the package EXISTS but failed to load, show the real error;
    // only give the "no binary" message if it truly couldn't be resolved.
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== "MODULE_NOT_FOUND") throw err;

    throw new Error(
      `No native binary for "${target}".\n` +
        `  - Tried local: ${localFile}\n` +
        `  - Tried package: ${pkg}\n` +
        `Platform without a published build, or the optionalDependency didn't install?`
    );
  }
}
