// build.ts — orquestador `vekziun build`.
// KEY RULE: build ONLY the targets the current machine can produce.
// La matriz completa vive en CI (un runner por OS). Un target que no se puede
// building here is NOT a fatal error: another runner will do it.
//
// But "can't on this machine" (missing toolchain) is DIFFERENT from "your code
// no compila" (error de Rust). El primero se omite; el segundo se muestra y aborta.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { copyFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { resolveTriple, suffix, type PlatformTriple } from "../core/triples.js";
import { inspectCargo } from "./cargo-check.js";

const exec = promisify(execFile);

/** Error meaning "the user's code does not compile" — fatal, must be shown. */
export class CargoBuildError extends Error {
  constructor(public triple: string, public cargoOutput: string) {
    super(`cargo build failed for ${triple}`);
    this.name = "CargoBuildError";
  }
}

/** Error meaning "this machine can't handle this target" — skipped, not fatal. */
export class TargetUnavailableError extends Error {
  constructor(public triple: string, public reason: string) {
    super(`target ${triple} unavailable on this machine: ${reason}`);
    this.name = "TargetUnavailableError";
  }
}

/**
 * cargo does NOT emit "addon.node". It emits the system dylib with irregular naming:
 *   linux:   lib<crate_snake>.so
 *   darwin:  lib<crate_snake>.dylib
 *   windows: <crate_snake>.dll   (sin "lib")
 * and dashes in the crate name become "_". Getting this wrong = MODULE_NOT_FOUND.
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
        `'cargo' not found. Rust is not installed or not on the PATH.\n` +
          `  Install it from https://rustup.rs and reopen the terminal.`
      );
    }
    throw err;
  }
}

/**
 * Distinguishes why cargo failed, by reading its output:
 * - toolchain del target no instalado  -> TargetUnavailableError (se omite)
 * - code compilation error               -> CargoBuildError (fatal, shown)
 */
function classifyCargoFailure(triple: string, stderr: string): never {
  const out = stderr.toLowerCase();

  // signals that the TARGET / toolchain is missing (not the code's fault)
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

  // otherwise, it's a real compilation error in the user's code
  throw new CargoBuildError(triple, stderr);
}

async function buildOne(crate: string, t: PlatformTriple, outDir: string): Promise<string> {
  // cargo build --release --target <triple>; capturamos su salida para diagnosticar
  try {
    await exec("cargo", ["build", "--release", "--target", t.triple]);
  } catch (err) {
    const e = err as { stderr?: string; stdout?: string; code?: string };
    const output = (e.stderr || "") + (e.stdout || "");
    // if cargo ran but failed, classify WHY
    classifyCargoFailure(t.triple, output || String(err));
  }

  // cargo said OK but we verify the artifact exists (extra defense)
  const artifact = path.join("target", t.triple, "release", dylibName(crate, t.platform));
  try {
    await access(artifact);
  } catch {
    throw new CargoBuildError(
      t.triple,
      `cargo finished without error but the binary wasn't found:\n  ${artifact}\n` +
        `Missing crate-type = ["cdylib"] in Cargo.toml, or the crate name doesn't match?`
    );
  }

  await mkdir(outDir, { recursive: true });
  // canonical name = SAME suffix() the loader uses. the contract, again.
  const dest = path.join(outDir, `${crate}.${suffix(t)}.node`);
  await copyFile(artifact, dest);
  return dest;
}

export interface BuildResult {
  built: string[];                                // paths to the generated .node files
  skipped: { triple: string; reason: string }[];  // skipped (missing toolchain)
  failed: { triple: string; output: string }[];   // REAL compilation failures
  crateName: string;                              // effective crate name (from Cargo.toml)
}

/**
 * Builds the requested triples.
 * - built:   compiled OK
 * - skipped: the machine lacks the toolchain (another runner will do it) — not fatal
 * - failed:  the CODE does not compile — fatal, with cargo's output for diagnosis
 *
 * @param crate    expected crate name. If the Cargo.toml defines a different one,
 *                 the Cargo.toml's is used (source of truth) and a mismatch is warned.
 * @param cargoDir Cargo.toml directory (default: cwd)
 */
export async function build(
  crate: string,
  requested: string[],
  outDir = "dist",
  cargoDir = process.cwd()
): Promise<BuildResult> {
  await assertCargoExists(); // fails clearly if Rust is missing, before iterating

  // VALIDATE the Cargo.toml before compiling: crate-type=cdylib + real name.
  // This turns cryptic cargo errors into clear, actionable messages.
  const cargo = await inspectCargo(cargoDir);

  // the binary name comes from Cargo.toml, not the config. If they differ,
  // we use the Cargo.toml's (it's what cargo actually emits) and warn.
  const effectiveCrate = cargo.libName;
  if (crate && crate !== effectiveCrate) {
    console.warn(
      `Warning: config says crate "${crate}" but Cargo.toml defines "${effectiveCrate}". ` +
        `Using "${effectiveCrate}" (what cargo emits).`
    );
  }

  const built: string[] = [];
  const skipped: { triple: string; reason: string }[] = [];
  const failed: { triple: string; output: string }[] = [];

  for (const triple of requested) {
    const t = resolveTriple(triple);
    try {
      built.push(await buildOne(effectiveCrate, t, outDir));
    } catch (err) {
      if (err instanceof TargetUnavailableError) {
        skipped.push({ triple, reason: err.reason }); // legitimate skip
      } else if (err instanceof CargoBuildError) {
        failed.push({ triple, output: err.cargoOutput }); // real code error
      } else {
        throw err; // algo inesperado: propagar
      }
    }
  }

  return { built, skipped, failed, crateName: effectiveCrate };
}
