# Vekziun — NAPI core (v0.1)

> [Español](./README.es.md)

Builds Rust/NAPI addons and resolves them per-platform through a **single contract**:
`triple → suffix → package`, shared by build, loader, and publish.

## Structure
- `src/core/triples.ts` — single source of truth for the contract.
- `src/core/config.ts` — loads/validates `vekziun.config.json`.
- `src/napi/build.ts` — builds ONLY the targets the current machine can produce.
- `src/napi/loader.ts` — runtime: detects musl, tries the local binary before the npm package.
- `src/cli.ts` — the `vekziun` command (build).
- `examples/hello-addon/` — example addon to test the tool against (not the product).

## Commands
```bash
npm install
npm run build        # compile TS -> dist/
npm test             # internal contract test (no Rust needed)
node dist/cli.js --help
node dist/cli.js build
```

## End-to-end with Rust (on your laptop)
```bash
# 1) install Rust: https://rustup.rs
rustup target add x86_64-unknown-linux-gnu

# 2) build the TS and run the CLI
npm install && npm run build
node dist/cli.js build      # now it actually compiles the crate -> dist-native/*.node

# expect: ✓ dist-native/vekziun-demo.linux-x64-gnu.node
```

## Config (vekziun.config.json)
```json
{
  "napi": {
    "packageName": "@brashkie/vekziun-demo",
    "crate": "vekziun-demo",
    "targets": ["x86_64-unknown-linux-gnu"],
    "outDir": "dist-native"
  }
}
```

## Status / open items
- ✅ Contract tested (verify-contract.mjs executed).
- ✅ CLI compiles to nodenext and runs end-to-end up to the cargo boundary.
- ⚠️ Loader ESM/CJS: uses `require()` for the .node; when compiling to ESM it may
  need `createRequire(import.meta.url)`. Resolved once tested against a real .node.
- ⬜ Pending: publish (CI matrix), doctor, optional-deps generator.
- ⬜ Config only reads JSON. .ts/.js + presets via c12/unconfig: later.

## Rules that don't break
1. `build` only emits the outDir — never touches tsconfig/Cargo.toml/package.json.
2. EXACT pin in optionalDependencies, never `^`.
3. One package, modules inside. Split into `@vekziun/*` only when a real case demands it.
