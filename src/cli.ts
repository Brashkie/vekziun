#!/usr/bin/env node
// cli.ts -> compila a dist/cli.js, expuesto como `vekziun` (campo "bin").
// v0.1: solo el comando `build`. doctor/publish/init vienen después.

import { loadConfig } from "./core/config.js";
import { build } from "./napi/build.js";
import { pack } from "./napi/pack.js";
import { publish } from "./napi/publish.js";

const HELP = `vekziun — compila addons NAPI-RS multiplataforma

Uso:
  vekziun build [--out <dir>]   Compila los targets que ESTA máquina puede producir
  vekziun pack                  Empaqueta los .node existentes como paquetes de plataforma
  vekziun publish [--dry-run]   Publica en npm (plataforma primero, principal último)
  vekziun --help                Muestra esta ayuda

Config: vekziun.config.json en el directorio actual.
`;

async function cmdBuild(args: string[]): Promise<number> {
  const config = await loadConfig();
  const { crate, packageName, targets } = config.napi;

  // --out sobreescribe el outDir de la config
  const outFlag = args.indexOf("--out");
  const outDir = outFlag !== -1 ? args[outFlag + 1] : config.napi.outDir ?? "dist";

  console.log(`vekziun build`);
  console.log(`  paquete: ${packageName}`);
  console.log(`  crate:   ${crate}`);
  console.log(`  targets: ${targets.length}`);
  console.log(`  salida:  ${outDir}/\n`);

  const { built, skipped, failed } = await build(crate, targets, outDir);

  for (const p of built) console.log(`  ✓ ${p}`);
  for (const s of skipped) console.log(`  ⊘ ${s.triple} (${s.reason}; lo hará otro runner de CI)`);
  for (const f of failed) console.log(`  ✗ ${f.triple} (ERROR de compilación)`);

  console.log(
    `\n${built.length} compilado(s), ${skipped.length} omitido(s), ${failed.length} con error.`
  );

  // los FAILED son errores reales del código: mostramos la salida de cargo
  if (failed.length > 0) {
    console.error(`\n${"─".repeat(60)}`);
    console.error(`Error de compilación. Salida de cargo:\n`);
    for (const f of failed) {
      console.error(`[${f.triple}]`);
      console.error(f.output.trim());
      console.error("");
    }
    console.error(
      `${"─".repeat(60)}\n` +
        `Esto es un error en el código Rust, no un problema de plataforma. ` +
        `Corrige lo de arriba y vuelve a intentar.`
    );
    return 1;
  }

  // sin failed pero sin nada compilado: faltan todos los toolchains del host
  if (built.length === 0) {
    console.error(
      `\nNo se compiló ningún target en esta máquina.\n` +
        `Los targets se omitieron por falta de toolchain — normal si compilas en CI ` +
        `con matriz de varios OS. Para compilar localmente, instala el target del host:\n` +
        `  rustup target add <triple>`
    );
    return 1;
  }
  return 0;
}

async function cmdPack(): Promise<number> {
  const config = await loadConfig();
  const { crate, packageName, targets, outDir } = config.napi;

  // la versión es la fuente de verdad del package.json del addon, no del config
  const { readFile } = await import("node:fs/promises");
  let version = "0.0.0";
  try {
    version = JSON.parse(await readFile("package.json", "utf8")).version ?? "0.0.0";
  } catch {
    /* sin package.json local: queda 0.0.0, el usuario debería tenerlo */
  }

  console.log(`vekziun pack (v${version})`);
  const { packed, missing } = await pack(
    packageName,
    crate,
    version,
    targets,
    outDir ?? "dist-native"
  );

  for (const d of packed) console.log(`  ✓ ${d}`);
  for (const t of missing) console.log(`  ⊘ ${t} (sin .node en esta máquina)`);

  console.log(`\n${packed.length} empaquetado(s), ${missing.length} faltante(s).`);
  if (packed.length === 0) {
    console.error(`\nNada que empaquetar. ¿Corriste 'vekziun build' antes?`);
    return 1;
  }
  return 0;
}

async function cmdPublish(args: string[]): Promise<number> {
  const dryRun = args.includes("--dry-run");
  await publish({ dryRun });
  return 0;
}

async function main(): Promise<number> {
  const [, , cmd, ...rest] = process.argv;

  if (!cmd || cmd === "--help" || cmd === "-h") {
    console.log(HELP);
    return cmd ? 0 : 1;
  }

  switch (cmd) {
    case "build":
      return cmdBuild(rest);
    case "pack":
      return cmdPack();
    case "publish":
      return cmdPublish(rest);
    default:
      console.error(`Comando desconocido: "${cmd}"\n`);
      console.log(HELP);
      return 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`\nError: ${err.message}`);
    process.exit(1);
  });
