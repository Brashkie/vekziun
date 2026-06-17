// publish.ts — Fase B: publica los paquetes ya empaquetados, en orden seguro.
// REGLA DE ORO: paquetes de plataforma PRIMERO (todos), paquete principal ÚLTIMO.
// Si el principal sube antes, un `npm install` en esa ventana resuelve
// optionalDependencies que aún no existen -> instala sin binario -> crash.
//
// ATOMICIDAD v0.1 (sin rollback transaccional): se publica todo bajo --tag next,
// se verifica, y solo entonces se promueve a latest. Un fallo a mitad NO contamina
// lo que `npm install` normal resuelve.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const exec = promisify(execFile);

export interface PublishOptions {
  /** dir con las carpetas de paquete de plataforma (de pack) */
  npmDir?: string;
  /** dir del paquete principal (con su package.json + index.cjs) */
  mainDir?: string;
  /** tag temporal antes de promover a latest */
  tag?: string;
  /** si true, no ejecuta npm; solo imprime el plan */
  dryRun?: boolean;
}

async function npmPublish(cwd: string, tag: string, dryRun: boolean): Promise<void> {
  const args = ["publish", "--access", "public", "--tag", tag];
  if (dryRun) {
    console.log(`  [dry-run] npm ${args.join(" ")}  (cwd: ${cwd})`);
    return;
  }
  await exec("npm", args, { cwd });
}

async function readPkgName(dir: string): Promise<string> {
  const raw = await readFile(path.join(dir, "package.json"), "utf8");
  return JSON.parse(raw).name as string;
}

export async function publish(opts: PublishOptions = {}): Promise<void> {
  const npmDir = opts.npmDir ?? "npm";
  const mainDir = opts.mainDir ?? ".";
  const tag = opts.tag ?? "next";
  const dryRun = opts.dryRun ?? false;

  // 1) descubrir las carpetas de paquete de plataforma
  const entries = await readdir(npmDir, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => path.join(npmDir, e.name));

  if (dirs.length === 0) {
    throw new Error(`No hay paquetes de plataforma en ${npmDir}/. ¿Corriste 'vekziun pack' antes?`);
  }

  // 2) FASE 1: publicar TODOS los de plataforma (bajo --tag next)
  console.log(`\nPublicando ${dirs.length} paquete(s) de plataforma (tag: ${tag})...`);
  const publishedNames: string[] = [];
  for (const dir of dirs) {
    const name = await readPkgName(dir);
    console.log(`  → ${name}`);
    await npmPublish(dir, tag, dryRun);
    publishedNames.push(name);
  }

  // 3) FASE 2: publicar el principal ÚLTIMO (también bajo --tag next)
  const mainName = await readPkgName(mainDir);
  console.log(`\nPublicando paquete principal: ${mainName} (tag: ${tag})...`);
  await npmPublish(mainDir, tag, dryRun);

  // 4) FASE 3: promover todo de `next` a `latest` SOLO si todo lo anterior pasó
  console.log(`\nPromoviendo de "${tag}" a "latest"...`);
  const version = JSON.parse(await readFile(path.join(mainDir, "package.json"), "utf8")).version;
  const allNames = [...publishedNames, mainName];
  for (const name of allNames) {
    if (dryRun) {
      console.log(`  [dry-run] npm dist-tag add ${name}@${version} latest`);
      continue;
    }
    await exec("npm", ["dist-tag", "add", `${name}@${version}`, "latest"]);
    console.log(`  ✓ ${name}@${version} -> latest`);
  }

  console.log(`\n✅ Publicado: ${allNames.length} paquete(s) en "latest".`);
}
