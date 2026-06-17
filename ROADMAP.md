# Roadmap

Vekziun follows a "ship what works, then grow" philosophy. This roadmap is honest about
the line between what exists and what is planned. Dates are intentions, not promises.

## v0.1.x — Foundation ✅ (current)

The core that makes everything else possible: a single contract for platform resolution,
proven end-to-end (build compiles, loader loads, contract test passes).

- ✅ `triples` — single source of truth (`triple → suffix → package`)
- ✅ `vekziun build` — compiles targets the current machine can produce
- ✅ `vekziun pack` — platform packages with correct `os`/`cpu`/`libc`
- ✅ `vekziun publish` — ordered publish, `next` → `latest`, exact pinning
- ✅ Runtime loader with musl/glibc detection
- ✅ CI (check on push) + release (publish on tag)

## v0.2.x — Developer experience

Make the common path smoother and catch problems before cargo does.

- ⬜ `vekziun doctor` — verifies Rust toolchain, installed targets, cross-toolchains,
  and linkers; reports what's missing *before* a cryptic build failure
- ⬜ `vekziun init` — scaffolds a new addon: `Cargo.toml` (with `crate-type=cdylib`),
  `vekziun.config.json`, and a starter CI workflow
- ⬜ Better build diagnostics (clearer messages for the common Windows MSVC / linker cases)

## v0.3.x — Configuration flexibility

- ⬜ Config loader accepting `.ts` / `.js` / `.mjs` (via a loader like c12/unconfig),
  not just JSON
- ⬜ Shareable presets (`extends`-style) for common target sets
- ⬜ `defineConfig()` with full type inference

## v0.4.x — Reach

- ⬜ Extended target coverage — Android, FreeBSD, riscv64, armv7 — each added to the
  contract table only after verification on real hardware
- ⬜ Optional parallel builds for multiple host-buildable targets

## Beyond — Ecosystem split

- ⬜ Extract `@vekziun/loader` as a lightweight runtime-only package, when a production
  addon needs it without the build tooling (see ECOSYSTEM.md and ARCHITECTURE.md)

## Non-goals

To keep Vekziun focused and memorable, these are explicitly **out of scope**:

- ❌ A generic JS/TS bundler (use tsup, unbuild, tshy — that space is solved)
- ❌ A monorepo task runner (Nx, Turborepo)
- ❌ Scaffolding unrelated to native addons
- ❌ Anything that turns Vekziun into "another build tool" rather than "the tool for
  shipping NAPI addons cross-platform"
