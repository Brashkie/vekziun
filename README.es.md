# Vekziun — núcleo NAPI (v0.1)

> [English](./README.md)

Compila addons de Rust/NAPI y los resuelve por plataforma vía un **contrato único**:
`triple → suffix → package`, compartido por build, loader y publish.

## Estructura
- `src/core/triples.ts` — fuente única de verdad del contrato.
- `src/core/config.ts` — carga/valida `vekziun.config.json`.
- `src/napi/build.ts` — compila SOLO los targets que la máquina actual puede producir.
- `src/napi/loader.ts` — runtime: detecta musl, binario local antes que paquete npm.
- `src/cli.ts` — comando `vekziun` (build).
- `examples/hello-addon/` — addon de ejemplo para probar la herramienta (no es el producto).

## Comandos
```bash
npm install
npm run build        # compila TS -> dist/
npm run verify       # prueba el contrato (sin Rust)
node dist/cli.js --help
node dist/cli.js build
```

## End-to-end con Rust (en tu laptop)
```bash
# 1) instala Rust: https://rustup.rs
rustup target add x86_64-unknown-linux-gnu

# 2) compila el TS y corre el CLI
npm install && npm run build
node dist/cli.js build      # ahora SÍ compila el crate -> dist-native/*.node

# verás: ✓ dist-native/vekziun-demo.linux-x64-gnu.node
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

## Estado / huecos pendientes
- ✅ Contrato probado (verify-contract.mjs ejecutado).
- ✅ CLI compila a nodenext y corre end-to-end hasta el borde de cargo.
- ⚠️ Loader ESM/CJS: usa `require()` para los .node; al compilar a ESM puede
  necesitar `createRequire(import.meta.url)`. Se resuelve al probar contra un .node real.
- ⬜ Falta: publish (matriz CI), doctor, optional-deps generator.
- ⬜ Config solo lee JSON. .ts/.js + presets vía c12/unconfig: más adelante.

## Reglas que NO se rompen
1. `build` solo emite el outDir — nunca toca tsconfig/Cargo.toml/package.json.
2. ABI pin EXACTO en optionalDependencies, nunca `^`.
3. Un paquete, módulos adentro. Partir en `@vekziun/*` solo cuando un caso real lo pida.
