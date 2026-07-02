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

## Principios de diseño

**Fallar antes de que falle Cargo.** Atrapar errores de configuración localmente, antes que CI.

- Preferir diagnósticos claros sobre magia.
- Compilar solo lo que el host puede compilar.
- Nunca ocultar errores de Cargo — mostrarlos, jamás tragárselos.
- Omitir targets no soportados con honestidad, y decir por qué.
- Detectar problemas de configuración antes de que empiece la compilación.
- Mantener el pipeline de build determinista.

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
| `aarch64-linux-android` | `android-arm64` |
| `armv7-linux-androideabi` | `android-arm-eabi` |

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

Vekziun sigue una filosofía de "publicar lo que funciona, después crecer". La línea entre
lo que existe y lo que está planeado se mantiene honesta.

| Versión | Foco | Estado |
|---------|------|--------|
| **v0.1.x** | Base: contrato único, build · pack · publish, loader con musl, 10 targets, validación de Cargo.toml | ✅ actual |
| **v0.2.x** | DX: `vekziun doctor` (chequeo de toolchain), `vekziun init` (scaffold), `verify` a nivel host | planeado |
| **v0.3.x** | Config: configs `.ts`/`.js`, presets compartibles, `defineConfig` tipado | planeado |
| **v0.4.x** | Alcance: cross-compile vía `cargo-zigbuild`, más targets (FreeBSD, riscv64), builds paralelos, caché | planeado |

**Non-goals:** Vekziun no será un bundler genérico de JS (usá tsup/unbuild), un task runner
de monorepos, ni "otro build tool". Se mantiene enfocado en publicar addons NAPI multiplataforma.

→ Roadmap completo con detalles: **[ROADMAP.md](./ROADMAP.md)**

---

## Ecosistema

Vekziun se publica hoy como un solo paquete, `@vekziun/napi`, con internals modulares y
`exports` por subpath — así ya tenés imports finos (`@vekziun/napi/loader` carga solo el
loader) sin múltiples paquetes.

```
Hoy                                Planeado (cuando surja una necesidad real)
────────────────────              ─────────────────────────────────────────
vekziun (repositorio)             vekziun (monorepo)
└── @vekziun/napi                 ├── @vekziun/core    ← el contrato (compartido)
    build · pack · publish        ├── @vekziun/loader  ← solo runtime, liviano
    loader · CLI                  └── @vekziun/napi    ← build · pack · publish · CLI
```

La partición ocurre solo cuando un consumidor concreto la necesita — ej. un addon en
producción que necesita el loader sin el tooling de build. Se evita partir por simetría;
la regla es *¿quién instala esto solo, y por qué?*

→ Ecosistema y modelo de addons completo: **[ECOSYSTEM.md](./ECOSYSTEM.md)**

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


## Documentación

- [Arquitectura](./ARCHITECTURE.md) — el contrato único, módulos, plan de migración
- [Roadmap](./ROADMAP.md) — qué existe, qué está planeado, non-goals
- [Ecosistema](./ECOSYSTEM.md) — la familia `@vekziun/*` y cómo se relacionan los addons
- [Changelog](./CHANGELOG.md) — historial de versiones

---

## Licencia

[Apache-2.0](./LICENSE) © Hepein Oficial
