// config.ts — carga y valida vekziun.config.json.
// v0.1: solo JSON (a prueba de balas en CI, sin transpilar TS en runtime).
// Más adelante: c12/unconfig para aceptar .ts/.js/.mjs + presets con merge.

import { readFile } from "node:fs/promises";
import path from "node:path";

export interface NapiOptions {
  /** nombre base del paquete npm; los por-plataforma se derivan de aquí */
  packageName: string;
  /** nombre del crate de Rust (= [package].name en Cargo.toml) */
  crate: string;
  /** Rust target triples — la unidad real, no platform×arch */
  targets: string[];
  /** dónde caen los .node compilados */
  outDir?: string;
}

export interface VekziunConfig {
  napi: NapiOptions;
}

const CONFIG_FILES = ["vekziun.config.json"];

export async function loadConfig(cwd = process.cwd()): Promise<VekziunConfig> {
  let raw: string | null = null;
  let found: string | null = null;

  for (const file of CONFIG_FILES) {
    try {
      raw = await readFile(path.join(cwd, file), "utf8");
      found = file;
      break;
    } catch {
      /* probar el siguiente */
    }
  }

  if (raw === null) {
    throw new Error(
      `No se encontró config. Crea un vekziun.config.json en ${cwd}:\n` +
        `{\n  "napi": {\n    "packageName": "@brashkie/my-addon",\n` +
        `    "crate": "my_addon",\n    "targets": ["x86_64-unknown-linux-gnu"]\n  }\n}`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`${found} no es JSON válido: ${(e as Error).message}`);
  }

  return validate(parsed, found!);
}

function validate(obj: unknown, file: string): VekziunConfig {
  if (typeof obj !== "object" || obj === null || !("napi" in obj)) {
    throw new Error(`${file}: falta la sección "napi".`);
  }
  const napi = (obj as { napi: unknown }).napi;
  if (typeof napi !== "object" || napi === null) {
    throw new Error(`${file}: "napi" debe ser un objeto.`);
  }
  const n = napi as Record<string, unknown>;

  if (typeof n.packageName !== "string" || !n.packageName) {
    throw new Error(`${file}: "napi.packageName" es obligatorio (string).`);
  }
  if (typeof n.crate !== "string" || !n.crate) {
    throw new Error(`${file}: "napi.crate" es obligatorio (string).`);
  }
  if (!Array.isArray(n.targets) || n.targets.length === 0) {
    throw new Error(`${file}: "napi.targets" debe ser un array no vacío.`);
  }
  if (!n.targets.every((t) => typeof t === "string")) {
    throw new Error(`${file}: todos los "napi.targets" deben ser strings.`);
  }

  return {
    napi: {
      packageName: n.packageName,
      crate: n.crate,
      targets: n.targets as string[],
      outDir: typeof n.outDir === "string" ? n.outDir : "dist",
    },
  };
}
