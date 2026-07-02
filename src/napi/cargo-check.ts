// cargo-check.ts — valida el Cargo.toml ANTES de correr cargo.
// Ataca los errores #1 de NAPI: falta crate-type=cdylib, o el nombre del crate
// no coincide con lo que build busca. Mejor un mensaje claro ahora que un error
// cryptic cargo error afterward.
//
// No usamos un parser TOML completo (mantener zero-dep); extraemos solo lo que
// necesitamos con matching acotado a las secciones [package] y [lib].

import { readFile } from "node:fs/promises";
import path from "node:path";

export interface CargoInfo {
  /** nombre del paquete ([package].name) */
  packageName: string;
  /** lib name if defined ([lib].name), otherwise falls back to packageName */
  libName: string;
  /** true si crate-type incluye cdylib */
  hasCdylib: boolean;
}

/** Extracts a key's value within a [section] of the TOML. */
function readKeyInSection(toml: string, section: string, key: string): string | null {
  // isolate the [section] body up to the next [header]
  const secRe = new RegExp(`\\[${section}\\]([\\s\\S]*?)(?:\\n\\[|$)`);
  const secMatch = toml.match(secRe);
  if (!secMatch) return null;
  const body = secMatch[1];
  const keyRe = new RegExp(`^\\s*${key}\\s*=\\s*"([^"]+)"`, "m");
  const m = body.match(keyRe);
  return m ? m[1] : null;
}

/** Detecta si [lib] crate-type contiene "cdylib". */
function detectCdylib(toml: string): boolean {
  const secMatch = toml.match(/\[lib\]([\s\S]*?)(?:\n\[|$)/);
  if (!secMatch) return false;
  const body = secMatch[1];
  // crate-type = ["cdylib", ...] — buscamos cdylib dentro del array
  const ctMatch = body.match(/crate-type\s*=\s*\[([^\]]*)\]/);
  if (!ctMatch) return false;
  return /["']cdylib["']/.test(ctMatch[1]);
}

/**
 * Lee y valida el Cargo.toml. Lanza con mensaje claro si falta lo esencial.
 * @param cargoDir  directorio que contiene el Cargo.toml (default: cwd)
 */
export async function inspectCargo(cargoDir = process.cwd()): Promise<CargoInfo> {
  const cargoPath = path.join(cargoDir, "Cargo.toml");

  let toml: string;
  try {
    toml = await readFile(cargoPath, "utf8");
  } catch {
    throw new Error(
      `Cargo.toml not found in ${cargoDir}.\n` +
        `Are you in the addon directory? A Cargo.toml with [lib] crate-type=["cdylib"] must exist.`
    );
  }

  const packageName = readKeyInSection(toml, "package", "name");
  if (!packageName) {
    throw new Error(`Cargo.toml: missing [package] name. It is required.`);
  }

  const libName = readKeyInSection(toml, "lib", "name") ?? packageName;
  const hasCdylib = detectCdylib(toml);

  if (!hasCdylib) {
    throw new Error(
      `Cargo.toml does not have crate-type = ["cdylib"].\n\n` +
        `Without it, cargo builds a Rust lib (rlib) but NOT the dynamic\n` +
        `binary (.dll/.so/.dylib) that Node needs to load the addon.\n\n` +
        `Add this to your Cargo.toml:\n\n` +
        `  [lib]\n` +
        `  crate-type = ["cdylib"]\n`
    );
  }

  return { packageName, libName, hasCdylib };
}
