# Ecosystem

Vekziun is one tool today, designed to grow into a small, focused family of packages
under the `@vekziun` scope — but only as concrete needs justify each split.

## Today

```
vekziun (repository)
└── @vekziun/napi        the tool: build · pack · publish · loader · CLI
```

A single package with modular internals and `exports` subpaths. You already get
fine-grained imports without multiple packages:

```ts
import { loadBinding } from "@vekziun/napi/loader";  // runtime only
import { build }       from "@vekziun/napi/build";   // build orchestration
import { suffix }      from "@vekziun/napi/triples";  // the contract
import * as vekziun    from "@vekziun/napi";          // full API
```

## Planned split

The split is driven by **distinct consumers**, not aesthetics. The first real trigger is
a production addon that needs the runtime loader without the build tooling:

```
vekziun (repository — monorepo)
├── @vekziun/core      the contract: triples, config        (shared)
├── @vekziun/loader    runtime-only resolution (lightweight) (production dependency)
└── @vekziun/napi      build · pack · publish · CLI          (dev dependency)
```

Why this shape:

- **`@vekziun/loader`** is what an addon ships to production. It only needs to find and
  load the right `.node` — no cargo, no CLI. Keeping it separate means production installs
  stay tiny.
- **`@vekziun/napi`** is what authors use at build time. It's a dev dependency; its weight
  doesn't reach end users.
- **`@vekziun/core`** holds the contract both depend on, versioned together via changesets
  so they can never disagree.

## How addons relate to Vekziun

Vekziun is the tool you **build with**, not something your addon imports at runtime — with
one exception, the loader. An addon built with Vekziun looks like:

```
@your-scope/your-addon              ← main package (JS + shim)
├── @your-scope/your-addon-win32-x64-msvc
├── @your-scope/your-addon-linux-x64-gnu
├── @your-scope/your-addon-linux-x64-musl
└── @your-scope/your-addon-darwin-arm64   ← platform packages (the .node files)
```

Vekziun generates all of these. The main package's shim calls `loadBinding` to pick the
right platform package at runtime.

## Principle

> Grow by extracting what has a distinct consumer — never by splitting for symmetry.

Each new `@vekziun/*` package must answer: *who installs this alone, and why?* If there's
no clear answer, it stays a module inside an existing package.
