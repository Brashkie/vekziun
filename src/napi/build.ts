// build.ts — orquestador `vekziun build`.
// REGLA CLAVE: compila SOLO los targets que la máquina actual puede producir.
// La matriz completa vive en CI (un runner por OS). Un target que no se puede
// construir aquí NO es error fatal: lo hará otro runner.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { copyFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { resolveTriple, suffix, type PlatformTriple } from "../core/triples.js";

const exec = promisify(execFile);

/**
 * cargo NO emite "addon.node". Emite el dylib del sistema con naming irregular:
 *   linux:   lib<crate_snake>.so
 *   darwin:  lib<crate_snake>.dylib
 *   windows: <crate_snake>.dll   (sin "lib")
 * y los guiones del nombre del crate se vuelven "_". Equivocarse aquí = MODULE_NOT_FOUND.
 */
function dylibName(crate: string, platform: NodeJS.Platform): string {
  const snake = crate.replace(/-/g, "_");
  if (platform === "win32") return `${snake}.dll`;
  if (platform === "darwin") return `lib${snake}.dylib`;
  return `lib${snake}.so`;
}

export interface BuildResult {
  built: string[];   // rutas a los .node generados
  skipped: string[]; // triples que esta máquina no pudo construir (los hace CI)
}

async function buildOne(crate: string, t: PlatformTriple, outDir: string): Promise<string> {
  // cargo build --release --target <triple>
  await exec("cargo", ["build", "--release", "--target", t.triple]);

  const artifact = path.join("target", t.triple, "release", dylibName(crate, t.platform));
  try {
    await access(artifact);
  } catch {
    throw new Error(
      `No se generó el binario para ${t.triple}.\n` +
        `Revisa:\n` +
        `  1) crate-type = ["cdylib"] en Cargo.toml\n` +
        `  2) rustup target add ${t.triple}\n` +
        `  3) si no es el host, falta el cross-toolchain (zig/cross/xwin).`
    );
  }

  await mkdir(outDir, { recursive: true });
  // nombre canónico = MISMO suffix() que usa el loader. el contrato, otra vez.
  const dest = path.join(outDir, `${crate}.${suffix(t)}.node`);
  await copyFile(artifact, dest);
  return dest;
}

/**
 * Construye los triples pedidos. Los que la máquina actual no puede armar
 * caen en `skipped` sin abortar — eso es correcto, no un fallo.
 */
export async function build(
  crate: string,
  requested: string[],
  outDir = "dist"
): Promise<BuildResult> {
  const built: string[] = [];
  const skipped: string[] = [];

  for (const triple of requested) {
    const t = resolveTriple(triple);
    try {
      built.push(await buildOne(crate, t, outDir));
    } catch {
      skipped.push(triple);
    }
  }

  return { built, skipped };
}
