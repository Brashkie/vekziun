// index.ts — main entry point for @vekziun/napi.
// Re-exports the public API for `import { ... } from "@vekziun/napi"`.
// Subpaths (./loader, ./build, ./triples) remain available for fine-grained imports.

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
