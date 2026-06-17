# Vekziun

> [Español](./README.es.md)

**Build and publish multi-platform NAPI-RS native addons with a single contract.**

[![npm](https://img.shields.io/npm/v/@vekziun/napi.svg)](https://www.npmjs.com/package/@vekziun/napi)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-green.svg)](https://nodejs.org)

Vekziun compiles Rust/NAPI addons, packages them per platform, and publishes them
to npm — without you ever writing a `switch (process.platform)` by hand or fighting
the `optionalDependencies` dance. One source of truth resolves every platform.

```bash
npm install @vekziun/napi
npx vekziun build
```

---

## Why Vekziun

Shipping a native Node addon to every platform is deceptively hard. The same binary
must be compiled on Windows, Linux (glibc **and** musl), and macOS; each compiled
`.node` must be named consistently; each must be wrapped in its own npm package; the
main package must list them as `optionalDependencies` with exact versions; and a
runtime loader must pick the right one — including telling Alpine's musl apart from
glibc, which is where most addons silently break in production.

Get any one of those names out of sync — `linux-x64-musl` in the build, `linux-musl-x64`
in the loader — and you get a `MODULE_NOT_FOUND` that only appears on one platform, in
production, never on your machine.

**Vekziun's core idea: a single contract.** Build, runtime loader, and publish all derive
every platform name from one table. They cannot diverge, because none of them knows the
suffix format independently — they all ask the same function.

```
Rust target triple
        │
        ▼
   suffix()          ◄── the single source of truth (triples.ts)
        │
        ├──────────────┬──────────────┐
        ▼              ▼              ▼
   build names     loader finds    publish names
   the .node       the .node       the package
```

---

## How it works

| Stage | Command | What it does |
|-------|---------|--------------|
| Build | `vekziun build` | Compiles the targets the **current machine** can produce (host + installed cross-toolchains). Names each `.node` from the contract. |
| Pack | `vekziun pack` | Wraps each compiled `.node` into a platform package with correct `os` / `cpu` / `libc`. |
| Publish | `vekziun publish` | Publishes platform packages first, main package last, under `--tag next`, then promotes to `latest`. Exact version pinning prevents ABI drift. |

The build is **distributed by design**: no single machine can cross-compile every
target, so each CI runner builds its own `.node`, and a final job stitches them into
one coherent release.

---

## Configuration

A `vekziun.config.json` describes intent, not files:

```json
{
  "napi": {
    "packageName": "@your-scope/your-addon",
    "crate": "your_addon",
    "targets": [
      "x86_64-pc-windows-msvc",
      "x86_64-unknown-linux-gnu",
      "x86_64-unknown-linux-musl",
      "aarch64-apple-darwin"
    ]
  }
}
```

Targets are **Rust target triples** — the real unit, not a `platform × arch` matrix
that would create impossible combinations. The package names, `os`, `cpu`, and `libc`
fields are all derived from these triples automatically.

---

## Supported targets

| Triple | Platform package suffix |
|--------|------------------------|
| `x86_64-pc-windows-msvc` | `win32-x64-msvc` |
| `aarch64-pc-windows-msvc` | `win32-arm64-msvc` |
| `x86_64-apple-darwin` | `darwin-x64` |
| `aarch64-apple-darwin` | `darwin-arm64` |
| `x86_64-unknown-linux-gnu` | `linux-x64-gnu` |
| `x86_64-unknown-linux-musl` | `linux-x64-musl` |
| `aarch64-unknown-linux-gnu` | `linux-arm64-gnu` |
| `aarch64-unknown-linux-musl` | `linux-arm64-musl` |

Adding a platform is a single row in the contract table. Android and other targets
are intentionally out until verified on real hardware.

---

## API

```ts
import { loadBinding } from "@vekziun/napi/loader";

// picks the right .node for the current platform (musl-aware)
const addon = loadBinding("your-addon", "@your-scope/your-addon");
```

Subpath exports: `@vekziun/napi` (full API), `/loader` (runtime only, lightweight),
`/build`, `/triples`.

---

## Roadmap

Vekziun follows a "ship what works, then grow" philosophy. Current state is honest:

**Available now (v0.1.x)**
- ✅ Single-contract platform resolution (`triples`)
- ✅ `vekziun build` — host + cross-toolchain compilation
- ✅ `vekziun pack` — platform package generation with `os`/`cpu`/`libc`
- ✅ `vekziun publish` — safe ordered publishing with `next` → `latest` promotion
- ✅ musl/glibc runtime detection
- ✅ Exact-version pinning to prevent ABI drift

**Planned**
- ⬜ `vekziun doctor` — toolchain diagnostics before cargo fails cryptically
- ⬜ `vekziun init` — scaffold a new addon (Cargo.toml, config, CI)
- ⬜ Config presets (`.ts`/`.js` configs via a loader, shareable presets)
- ⬜ Extended target coverage (Android, FreeBSD, riscv64) once hardware-verified

---

## Ecosystem

Vekziun ships today as a single package, `@vekziun/napi`, with modular internals.
As real use cases demand finer-grained installs, it is designed to split under the
same scope — for example a lightweight `@vekziun/loader` for runtime-only consumers
that should not pull in build tooling. That split happens when a concrete need
arises, not before; one package with good `exports` covers the current surface.

```
vekziun (repository)
└── @vekziun/napi        ← the tool (build · pack · publish · loader · CLI)
    └── @vekziun/loader   ← future: runtime-only, when an addon needs it
```

---

## Project structure

```
vekziun/
├── src/
│   ├── core/            triples (the contract), config loader
│   ├── napi/            build, loader, pack, publish, optional-deps
│   ├── cli.ts           the `vekziun` command
│   └── index.ts         public API entry point
├── examples/
│   └── hello-addon/     reference addon used to validate the toolchain
├── tests/
│   └── contract.test.mjs  verifies build & loader stay in sync
└── .github/workflows/
    ├── ci.yml           checks every push (typecheck, build, contract test)
    └── release.yml      publishes @vekziun/napi on version tags
```

---

## Development

```bash
npm install
npm run build       # compile TS -> dist/
npm test            # run the contract test
npm run typecheck   # type-check without emitting
```

Releases are tag-driven: push to `main` runs CI; pushing a `v*` tag publishes.

---

## License

[Apache-2.0](./LICENSE) © Moisés Yaurivilca (Hepein Oficial)
