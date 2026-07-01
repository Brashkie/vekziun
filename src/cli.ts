#!/usr/bin/env node
// cli.ts -> compiles to dist/cli.js, exposed as `vekziun` (the "bin" field).

import { loadConfig } from "./core/config.js";
import { build } from "./napi/build.js";
import { pack } from "./napi/pack.js";
import { publish } from "./napi/publish.js";

const HELP = `vekziun — build multi-platform NAPI-RS addons

Usage:
  vekziun build [--out <dir>]   Build the targets THIS machine can produce
  vekziun pack                  Package existing .node files as platform packages
  vekziun publish [--dry-run]   Publish to npm (platform packages first, main last)
  vekziun --help                Show this help

Config: vekziun.config.json in the current directory.
`;

async function cmdBuild(args: string[]): Promise<number> {
  const config = await loadConfig();
  const { crate, packageName, targets } = config.napi;

  // --out overrides the config's outDir
  const outFlag = args.indexOf("--out");
  const outDir = outFlag !== -1 ? args[outFlag + 1] : config.napi.outDir ?? "dist";

  console.log(`vekziun build`);
  console.log(`  package: ${packageName}`);
  console.log(`  crate:   ${crate}`);
  console.log(`  targets: ${targets.length}`);
  console.log(`  output:  ${outDir}/\n`);

  const { built, skipped, failed } = await build(crate, targets, outDir);

  for (const p of built) console.log(`  ✓ ${p}`);
  for (const s of skipped) console.log(`  ⊘ ${s.triple} (${s.reason}; another CI runner will build it)`);
  for (const f of failed) console.log(`  ✗ ${f.triple} (COMPILATION error)`);

  console.log(
    `\n${built.length} built, ${skipped.length} skipped, ${failed.length} failed.`
  );

  // FAILED are real code errors: show cargo's output
  if (failed.length > 0) {
    console.error(`\n${"─".repeat(60)}`);
    console.error(`Compilation error. cargo output:\n`);
    for (const f of failed) {
      console.error(`[${f.triple}]`);
      console.error(f.output.trim());
      console.error("");
    }
    console.error(
      `${"─".repeat(60)}\n` +
        `This is an error in the Rust code, not a platform issue. ` +
        `Fix the above and try again.`
    );
    return 1;
  }

  // no failures but nothing built: all host toolchains are missing
  if (built.length === 0) {
    console.error(
      `\nNo target was built on this machine.\n` +
        `Targets were skipped due to missing toolchains — normal when building in CI ` +
        `with a multi-OS matrix. To build locally, install the host target:\n` +
        `  rustup target add <triple>`
    );
    return 1;
  }
  return 0;
}

async function cmdPack(): Promise<number> {
  const config = await loadConfig();
  const { crate, packageName, targets, outDir } = config.napi;

  // the version is the source of truth from the addon's package.json, not the config
  const { readFile } = await import("node:fs/promises");
  let version = "0.0.0";
  try {
    version = JSON.parse(await readFile("package.json", "utf8")).version ?? "0.0.0";
  } catch {
    /* no local package.json: stays 0.0.0, the user should provide one */
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
  for (const t of missing) console.log(`  ⊘ ${t} (no .node on this machine)`);

  console.log(`\n${packed.length} packed, ${missing.length} missing.`);
  if (packed.length === 0) {
    console.error(`\nNothing to pack. Did you run 'vekziun build' first?`);
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
      console.error(`Unknown command: "${cmd}"\n`);
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
