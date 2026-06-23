// build.ts — orquestador `vekziun build`.
// REGLA CLAVE: compila SOLO los targets que la máquina actual puede producir.
// La matriz completa vive en CI (un runner por OS). Un target que no se puede
// construir aquí NO es error fatal: lo hará otro runner.
//
// Pero "no se puede en esta máquina" (falta toolchain) es DISTINTO de "tu código
// no compila" (error de Rust). El primero se omite; el segundo se muestra y aborta.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { copyFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { resolveTriple, suffix, type PlatformTriple } from "../core/triples.js";

const exec = promisify(execFile);

/** Error que significa "el código del usuario no compila" — fatal, hay que mostrarlo. */
export class CargoBuildError extends Error {
  constructor(public triple: string, public cargoOutput: string) {
    super(`cargo build falló para ${triple}`);
    this.name = "CargoBuildError";
  }
}

/** Error que significa "esta máquina no puede con este target" — se omite, no es fatal. */
export class TargetUnavailableError extends Error {
  constructor(public triple: string, public reason: string) {
    super(`target ${triple} no disponible en esta máquina: ${reason}`);
    this.name = "TargetUnavailableError";
  }
}

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

/** Verifica que cargo exista antes de intentar nada. Mensaje claro si no. */
async function assertCargoExists(): Promise<void> {
  try {
    await exec("cargo", ["--version"]);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") {
      throw new Error(
        `No se encontró 'cargo'. Rust no está instalado o no está en el PATH.\n` +
          `  Instálalo desde https://rustup.rs y reabre la terminal.`
      );
    }
    throw err;
  }
}

/**
 * Distingue por qué falló cargo, leyendo su salida:
 * - toolchain del target no instalado  -> TargetUnavailableError (se omite)
 * - error de compilación del código     -> CargoBuildError (fatal, se muestra)
 */
function classifyCargoFailure(triple: string, stderr: string): never {
  const out = stderr.toLowerCase();

  // señales de que falta el TARGET / toolchain (no es culpa del código)
  const targetMissing =
    out.includes("is not installed") ||
    out.includes("target may not be installed") ||
    out.includes("rustup target add") ||
    out.includes("can't find crate for `std`") ||
    out.includes("error: linker") ||         // falta linker (ej. MSVC en Windows)
    out.includes("link.exe") ||
    out.includes("cc not found") ||
    out.includes("no such file or directory") && out.includes("linker");

  if (targetMissing) {
    throw new TargetUnavailableError(triple, "falta el toolchain/linker del target");
  }

  // si no, es un error de compilación real del código del usuario
  throw new CargoBuildError(triple, stderr);
}

async function buildOne(crate: string, t: PlatformTriple, outDir: string): Promise<string> {
  // cargo build --release --target <triple>; capturamos su salida para diagnosticar
  try {
    await exec("cargo", ["build", "--release", "--target", t.triple]);
  } catch (err) {
    const e = err as { stderr?: string; stdout?: string; code?: string };
    const output = (e.stderr || "") + (e.stdout || "");
    // si cargo corrió pero falló, clasificamos POR QUÉ
    classifyCargoFailure(t.triple, output || String(err));
  }

  // cargo dijo OK pero verificamos que el artefacto exista (defensa extra)
  const artifact = path.join("target", t.triple, "release", dylibName(crate, t.platform));
  try {
    await access(artifact);
  } catch {
    throw new CargoBuildError(
      t.triple,
      `cargo terminó sin error pero no se encontró el binario:\n  ${artifact}\n` +
        `¿Falta crate-type = ["cdylib"] en Cargo.toml, o el nombre del crate no coincide?`
    );
  }

  await mkdir(outDir, { recursive: true });
  // nombre canónico = MISMO suffix() que usa el loader. el contrato, otra vez.
  const dest = path.join(outDir, `${crate}.${suffix(t)}.node`);
  await copyFile(artifact, dest);
  return dest;
}

export interface BuildResult {
  built: string[];                              // rutas a los .node generados
  skipped: { triple: string; reason: string }[]; // omitidos (toolchain faltante)
  failed: { triple: string; output: string }[];  // fallos REALES de compilación
}

/**
 * Construye los triples pedidos.
 * - built:   compilados OK
 * - skipped: la máquina no tiene el toolchain (otro runner lo hará) — no fatal
 * - failed:  el CÓDIGO no compila — fatal, con la salida de cargo para diagnosticar
 */
export async function build(
  crate: string,
  requested: string[],
  outDir = "dist"
): Promise<BuildResult> {
  await assertCargoExists(); // falla claro si no hay Rust, antes de iterar

  const built: string[] = [];
  const skipped: { triple: string; reason: string }[] = [];
  const failed: { triple: string; output: string }[] = [];

  for (const triple of requested) {
    const t = resolveTriple(triple);
    try {
      built.push(await buildOne(crate, t, outDir));
    } catch (err) {
      if (err instanceof TargetUnavailableError) {
        skipped.push({ triple, reason: err.reason }); // omitido legítimo
      } else if (err instanceof CargoBuildError) {
        failed.push({ triple, output: err.cargoOutput }); // error real del código
      } else {
        throw err; // algo inesperado: propagar
      }
    }
  }

  return { built, skipped, failed };
}
