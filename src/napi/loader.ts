// loader.ts — runtime loader. Reconstruye el MISMO suffix() que build,
// detecta musl correctamente, e intenta el binario local antes del paquete npm.
// Esta es la otra punta del contrato: si suffix() coincide con build, nunca diverge.

import path from "node:path";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { suffix, type Abi } from "../core/triples.js";

// En ESM `require` y `__dirname` NO existen como globales. Los reconstruimos:
// createRequire da un require capaz de cargar .node nativos desde un módulo ESM.
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Detecta musl vs glibc. ESTE es el punto donde mueren el 90% de los addons NAPI
 * en producción (Alpine/Docker). glibc expone glibcVersionRuntime en process.report;
 * musl no lo tiene.
 */
function isMusl(): boolean {
  try {
    const report = (process as unknown as {
      report?: { getReport?: () => { header?: { glibcVersionRuntime?: string } } };
    }).report?.getReport?.();
    return !report?.header?.glibcVersionRuntime;
  } catch {
    return false; // sin process.report, asumimos glibc (caso mayoritario)
  }
}

/** sufijo de la máquina actual — DEBE coincidir con lo que build escribió */
function currentSuffix(): string {
  const platform = process.platform;
  const arch = process.arch;
  let abi: Abi = null;
  if (platform === "win32") abi = "msvc";
  else if (platform === "linux") abi = isMusl() ? "musl" : "gnu";
  // Android: el arm de 32-bit lleva sufijo eabi (android-arm-eabi); arm64 no.
  // process.platform devuelve "android" en Node sobre Android (verificado vs napi-rs).
  else if (platform === "android" && arch === "arm") abi = "eabi";
  return suffix({ platform, arch, abi });
}

/**
 * Carga el binding nativo para la plataforma actual.
 * @param crate  nombre del crate (parte de archivo): "my-addon"
 * @param base   nombre base del paquete npm: "@brashkie/my-addon"
 * @param dir    dónde buscar el .node local (default: junto al loader)
 */
export function loadBinding(crate: string, base: string, dir = __dirname): unknown {
  const target = currentSuffix();
  const localFile = path.join(dir, `${crate}.${target}.node`);

  // 1) binario LOCAL primero -> permite `vekziun build` + test sin publicar.
  //    Distinguimos "no existe el archivo" de "existe pero falló al cargar":
  //    si existe y require() revienta, propagamos el error REAL (no lo ocultamos).
  if (existsSync(localFile)) {
    return require(localFile);
  }

  // 2) paquete de plataforma desde optionalDependencies
  const pkg = `${base}-${target}`;
  try {
    return require(pkg);
  } catch (err) {
    // si el paquete EXISTE pero falló al cargar, mostramos el error real;
    // solo damos el mensaje "no hay binario" si de verdad no se pudo resolver.
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
