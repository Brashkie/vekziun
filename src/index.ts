// index.ts — entry point principal de @vekziun/napi.
// Re-exporta la API pública para `import { ... } from "@vekziun/napi"`.
// Los subpaths (./loader, ./build, ./triples) siguen disponibles para imports finos.

export {
  TRIPLES,
  suffix,
  packageNameFor,
  resolveTriple,
  type PlatformTriple,
  type Abi,
} from "./core/triples.js";

export { loadBinding } from "./napi/loader.js";
export { build, type BuildResult } from "./napi/build.js";
export { pack, type PackResult } from "./napi/pack.js";
export { publish, type PublishOptions } from "./napi/publish.js";
export {
  buildOptionalDeps,
  platformPackageJson,
  entryShim,
  type PlatformPackageJson,
} from "./napi/optional-deps.js";
export { loadConfig, type VekziunConfig, type NapiOptions } from "./core/config.js";
