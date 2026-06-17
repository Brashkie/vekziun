# Vekziun

> [English](./README.md)

**Compila y publica addons nativos NAPI-RS multiplataforma con un contrato único.**

[![npm](https://img.shields.io/npm/v/@vekziun/napi.svg)](https://www.npmjs.com/package/@vekziun/napi)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-green.svg)](https://nodejs.org)

Vekziun compila addons de Rust/NAPI, los empaqueta por plataforma y los publica en
npm — sin que escribas un `switch (process.platform)` a mano ni pelees con el baile de
los `optionalDependencies`. Una sola fuente de verdad resuelve cada plataforma.

```bash
npm install @vekziun/napi
npx vekziun build
```

---

## Por qué Vekziun

Llevar un addon nativo de Node a todas las plataformas es engañosamente difícil. El
mismo binario debe compilarse en Windows, Linux (glibc **y** musl) y macOS; cada `.node`
compilado debe nombrarse de forma consistente; cada uno debe envolverse en su propio
paquete npm; el paquete principal debe listarlos como `optionalDependencies` con versión
exacta; y un loader en runtime debe elegir el correcto — incluyendo distinguir musl de
glibc en Alpine, que es donde la mayoría de los addons se rompen en silencio en producción.

Si cualquiera de esos nombres se desincroniza — `linux-x64-musl` en el build,
`linux-musl-x64` en el loader — obtenés un `MODULE_NOT_FOUND` que solo aparece en una
plataforma, en producción, nunca en tu máquina.

**La idea central de Vekziun: un contrato único.** El build, el loader de runtime y el
publish derivan todos los nombres de plataforma de una sola tabla. No pueden divergir,
porque ninguno conoce el formato del sufijo por su cuenta — todos le preguntan a la misma
función.

```
Rust target triple
        │
        ▼
   suffix()          ◄── la única fuente de verdad (triples.ts)
        │
        ├──────────────┬──────────────┐
        ▼              ▼              ▼
   build nombra     loader busca    publish nombra
   el .node         el .node        el paquete
```

---

## Cómo funciona

| Etapa | Comando | Qué hace |
|-------|---------|----------|
| Build | `vekziun build` | Compila los targets que **esta máquina** puede producir (host + cross-toolchains instalados). Nombra cada `.node` desde el contrato. |
| Pack | `vekziun pack` | Envuelve cada `.node` compilado en un paquete de plataforma con `os` / `cpu` / `libc` correctos. |
| Publish | `vekziun publish` | Publica los paquetes de plataforma primero, el principal último, bajo `--tag next`, y luego promueve a `latest`. El pin de versión exacto previene la rotura de ABI. |

El build es **distribuido por diseño**: ninguna máquina puede cross-compilar todos los
targets, así que cada runner de CI compila su propio `.node`, y un job final los cose en
un release coherente.

---

## Configuración

Un `vekziun.config.json` describe intención, no archivos:

```json
{
  "napi": {
    "packageName": "@tu-scope/tu-addon",
    "crate": "tu_addon",
    "targets": [
      "x86_64-pc-windows-msvc",
      "x86_64-unknown-linux-gnu",
      "x86_64-unknown-linux-musl",
      "aarch64-apple-darwin"
    ]
  }
}
```

Los targets son **Rust target triples** — la unidad real, no una matriz
`plataforma × arquitectura` que crearía combinaciones imposibles. Los nombres de paquete,
y los campos `os`, `cpu` y `libc` se derivan de estos triples automáticamente.

---

## Targets soportados

| Triple | Sufijo del paquete de plataforma |
|--------|----------------------------------|
| `x86_64-pc-windows-msvc` | `win32-x64-msvc` |
| `aarch64-pc-windows-msvc` | `win32-arm64-msvc` |
| `x86_64-apple-darwin` | `darwin-x64` |
| `aarch64-apple-darwin` | `darwin-arm64` |
| `x86_64-unknown-linux-gnu` | `linux-x64-gnu` |
| `x86_64-unknown-linux-musl` | `linux-x64-musl` |
| `aarch64-unknown-linux-gnu` | `linux-arm64-gnu` |
| `aarch64-unknown-linux-musl` | `linux-arm64-musl` |

Agregar una plataforma es una sola fila en la tabla del contrato. Android y otros targets
quedan fuera intencionalmente hasta verificarlos en hardware real.

---

## API

```ts
import { loadBinding } from "@vekziun/napi/loader";

// elige el .node correcto para la plataforma actual (detecta musl)
const addon = loadBinding("tu-addon", "@tu-scope/tu-addon");
```

Exports por subpath: `@vekziun/napi` (API completa), `/loader` (solo runtime, liviano),
`/build`, `/triples`.

---

## Roadmap

Vekziun sigue una filosofía de "publicar lo que funciona, después crecer". El estado
actual es honesto:

**Disponible ahora (v0.1.x)**
- ✅ Resolución de plataforma por contrato único (`triples`)
- ✅ `vekziun build` — compilación host + cross-toolchain
- ✅ `vekziun pack` — generación de paquetes de plataforma con `os`/`cpu`/`libc`
- ✅ `vekziun publish` — publicación ordenada y segura con promoción `next` → `latest`
- ✅ Detección de musl/glibc en runtime
- ✅ Pin de versión exacto para prevenir rotura de ABI

**Planeado**
- ⬜ `vekziun doctor` — diagnóstico de toolchain antes de que cargo falle de forma críptica
- ⬜ `vekziun init` — scaffold de un addon nuevo (Cargo.toml, config, CI)
- ⬜ Presets de configuración (configs `.ts`/`.js` vía loader, presets compartibles)
- ⬜ Cobertura extendida de targets (Android, FreeBSD, riscv64) tras verificación en hardware

---

## Ecosistema

Vekziun se publica hoy como un solo paquete, `@vekziun/napi`, con internals modulares.
A medida que casos de uso reales demanden instalaciones más finas, está diseñado para
partirse bajo el mismo scope — por ejemplo un `@vekziun/loader` liviano para consumidores
que solo necesitan el runtime y no deberían arrastrar el tooling de build. Esa partición
ocurre cuando surge una necesidad concreta, no antes; un paquete con buenos `exports`
cubre la superficie actual.

```
vekziun (repositorio)
└── @vekziun/napi        ← la herramienta (build · pack · publish · loader · CLI)
    └── @vekziun/loader   ← futuro: solo runtime, cuando un addon lo necesite
```

---

## Estructura del proyecto

```
vekziun/
├── src/
│   ├── core/            triples (el contrato), loader de config
│   ├── napi/            build, loader, pack, publish, optional-deps
│   ├── cli.ts           el comando `vekziun`
│   └── index.ts         entry point de la API pública
├── examples/
│   └── hello-addon/     addon de referencia para validar el toolchain
├── tests/
│   └── contract.test.mjs  verifica que build y loader sigan sincronizados
└── .github/workflows/
    ├── ci.yml           revisa cada push (typecheck, build, test de contrato)
    └── release.yml      publica @vekziun/napi en tags de versión
```

---

## Desarrollo

```bash
npm install
npm run build       # compila TS -> dist/
npm test            # corre el test del contrato
npm run typecheck   # chequea tipos sin emitir
```

Los releases se disparan por tag: push a `main` corre CI; empujar un tag `v*` publica.

---

## Licencia

[Apache-2.0](./LICENSE) © Moisés Yaurivilca (Hepein Oficial)
