# Architecture

> [Español](#arquitectura-español) abajo.

## The single contract

Vekziun's entire design rests on one idea: **build, runtime loader, and publish must
never disagree about platform names.** They achieve this not by being careful, but by
construction — none of them knows the suffix format independently. All three derive every
name from one function in one file.

```
                    src/core/triples.ts
                    ┌──────────────────┐
                    │  TRIPLES table   │
                    │  suffix()        │  ◄── single source of truth
                    │  packageNameFor()│
                    └────────┬─────────┘
                             │ imported by
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
   src/napi/build.ts   src/napi/loader.ts  src/napi/publish.ts
   names the .node     finds the .node     names the package
```

If `build` writes `addon.linux-x64-musl.node`, the loader looks for exactly
`addon.linux-x64-musl.node`, and publish names the package `...-linux-x64-musl` — because
all three call the same `suffix()`. There is no second implementation that could drift.

## Module responsibilities

| Module | Responsibility |
|--------|---------------|
| `core/triples.ts` | The contract: triple table, `suffix()`, `packageNameFor()`, `resolveTriple()`. |
| `core/config.ts` | Loads and validates `vekziun.config.json`. |
| `napi/build.ts` | Runs `cargo build` per target the host can produce; copies `.node` with canonical name. |
| `napi/loader.ts` | Runtime resolution: musl/glibc detection, local-binary-first, then platform package. |
| `napi/pack.ts` | Wraps each `.node` into a platform package (`os`/`cpu`/`libc`). |
| `napi/publish.ts` | Ordered publish: platform packages first, main last, `next` → `latest`. |
| `napi/optional-deps.ts` | Generates `optionalDependencies` (exact pin) and the entry shim. |
| `cli.ts` | The `vekziun` command dispatcher. |
| `index.ts` | Public API entry point. |

## Distributed build, single publish

No single machine can cross-compile every target (you can't build `aarch64-apple-darwin`
from Linux without a cross-toolchain). So the model is:

1. **Each CI runner** builds the targets *it* can (`build` + `pack`).
2. **One final job** collects all platform packages and publishes them together.

`vekziun build` reflects this: targets the current machine cannot produce are skipped
(not errors) — another runner will handle them.

## Why one package today

Vekziun ships as a single package, `@vekziun/napi`, with the modular internals above.
Splitting into multiple published packages now would reintroduce the exact problem
Vekziun solves: `loader` depends on `core`'s `suffix()`; as separate versioned packages,
they could resolve mismatched versions and produce a production-only `MODULE_NOT_FOUND`.
As one package in one file tree, they cannot diverge.

User choice of what to import is already provided by `exports` subpaths
(`@vekziun/napi/loader` loads only the loader), so a split adds no functional benefit yet.

## Migration plan (when to go monorepo)

The split happens when a **concrete need** appears, not for symmetry. The clearest
trigger: a production addon (e.g. `ansimax-native`) needs `@vekziun/loader` at runtime
without pulling in the build tooling (cargo orchestration, CLI).

When that trigger arrives, migrate to a workspaces monorepo:

```
vekziun/
├── packages/
│   ├── core/      ← triples.ts, config.ts        (@vekziun/core)
│   ├── loader/    ← loader.ts (runtime-only, light) (@vekziun/loader)
│   └── napi/      ← build, pack, publish, cli, optional-deps (@vekziun/napi)
└── package.json   ← workspaces root (not published)
```

Notes on the plan:
- **Three packages, not four.** `core` and the heavy tooling don't each need to be
  separate; group `build`/`pack`/`publish`/`cli` under `napi`. Split only what has a
  distinct consumer (`loader` for runtime, `core` as the shared contract).
- **Use changesets** so internal packages version together — this prevents the ABI
  drift described above from happening within the ecosystem itself.
- The code already lives in separate modules (`core/`, `napi/`), so migration is moving
  files and adding manifests, not rewriting logic.

---

<a name="arquitectura-español"></a>

# Arquitectura (Español)

## El contrato único

Todo el diseño de Vekziun descansa en una idea: **el build, el loader de runtime y el
publish nunca deben estar en desacuerdo sobre los nombres de plataforma.** Lo logran no
por cuidado, sino por construcción — ninguno conoce el formato del sufijo por su cuenta.
Los tres derivan cada nombre de una sola función en un solo archivo.

Si `build` escribe `addon.linux-x64-musl.node`, el loader busca exactamente
`addon.linux-x64-musl.node`, y publish nombra el paquete `...-linux-x64-musl` — porque los
tres llaman a la misma `suffix()`. No hay una segunda implementación que pueda divergir.

## Build distribuido, publish único

Ninguna máquina puede cross-compilar todos los targets, así que: cada runner de CI compila
los que puede (`build` + `pack`), y un job final junta todos los paquetes de plataforma y
los publica juntos. `vekziun build` refleja esto — los targets que la máquina no puede
producir se omiten (no son errores), otro runner los hará.

## Por qué un solo paquete hoy

Partir en varios paquetes publicados ahora reintroduciría el problema exacto que Vekziun
resuelve: `loader` depende del `suffix()` de `core`; como paquetes versionados separados,
podrían resolver versiones distintas y producir un `MODULE_NOT_FOUND` solo-en-producción.
Como un paquete en un solo árbol de archivos, no pueden divergir. La elección de qué
importar ya la dan los `exports` por subpath.

## Plan de migración (cuándo pasar a monorepo)

La partición ocurre cuando aparece una **necesidad concreta**, no por simetría. El
disparador más claro: un addon en producción (ej. `ansimax-native`) necesita
`@vekziun/loader` en runtime sin arrastrar el tooling de build. Ahí se migra a un monorepo
de workspaces con tres paquetes (`core`, `loader`, `napi`), usando changesets para
versionar en conjunto. El código ya está en módulos separados, así que migrar es mover
carpetas, no reescribir.
