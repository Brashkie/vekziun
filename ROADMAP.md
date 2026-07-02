# Vekziun Roadmap

Vekziun follows a **"ship what works, then grow"** philosophy. Every feature must earn
its place by solving a real problem inside Vekziun's niche: **building, packaging, and
publishing NAPI-RS native addons across platforms.** Features that sound impressive but
drift outside that niche are explicitly rejected below, with the reasoning kept honest.

---

## Current — v0.1.x (shipped)

The foundation. All of this exists and is published to npm today.

- **The single contract** (`triples.ts`) — build, runtime loader, and publish all derive
  platform names from one `suffix()` function. They cannot diverge because none of them
  knows the suffix format independently. Proven by `npm test`.
- **`vekziun build`** — compiles the targets the host can produce; distinguishes three
  outcomes: **built**, **skipped** (missing toolchain — another CI runner will do it), and
  **failed** (the Rust code doesn't compile — fatal, with cargo's output shown).
- **`vekziun pack`** — packages existing `.node` files into per-platform packages with
  correct `os` / `cpu` / `libc` fields.
- **`vekziun publish`** — safe ordered publishing: platform packages first, main package
  last, all under `--tag next`, then promoted to `latest` (prevents a broken install window).
- **musl/glibc runtime detection** in the loader.
- **10 targets:** Windows (x64, arm64), macOS (x64, arm64), Linux (x64/arm64 × gnu/musl),
  Android (arm64, arm-eabi). Android was verified against napi-rs's own loader —
  `process.platform` is `"android"` and the 32-bit arm target carries the `eabi` suffix.
- **Exact-version pinning** in `optionalDependencies` to prevent ABI drift.
- **Pre-build Cargo.toml validation** — checks `crate-type = ["cdylib"]` and detects the
  real crate name before cargo runs, turning cryptic failures into clear messages.
- **English messages** across the whole CLI and errors.

---

## Planned — v0.2.x: Developer Experience

Making failures obvious and getting started fast.

- **`vekziun doctor`** — diagnoses the toolchain *before* cargo fails cryptically:
  is Rust installed? is the target added (`rustup target add`)? is there a C++ linker on
  Windows? is the Android NDK configured? is Zig present for cross-compilation? This is
  where the "why was this target skipped?" question gets a specific, actionable answer
  instead of a generic skip. Grew directly out of real pain: the napi-rs CLI on Windows
  has a known bug where `build:native` for Android injects env vars that override
  `.cargo/config.toml` (hardcoding `linux-x86_64`), while `cargo build` directly works.
  `doctor` would detect and warn about exactly this class of environment issue.
- **`vekziun init`** — scaffolds a new addon from scratch: `Cargo.toml` with
  `crate-type=["cdylib"]`, the `vekziun.config.json`, the CI workflow, the entry shim.
  So `vekziun init my-addon` produces something ready for `vekziun build`.

---

## Planned — v0.2.x/0.3.x: Verification (`vekziun verify`)

One command that answers "is this addon actually shippable?" — running three phases,
each respecting the hard limit that **you cannot execute a Linux/macOS `.node` from
Windows.**

```
vekziun verify

Checking project...        (Phase 1 — preflight)
  ✓ Cargo.toml
  ✓ crate-type = ["cdylib"]
  ✓ crate name detected
  ✓ package.json exports
  ✓ optionalDependencies
  ✓ target compatibility

Checking native addon...   (Phase 2 — host)
  ✓ Binary exists
  ✓ NAPI exports present
  ✓ require() loads it

Checking packaging...      (Phase 3 — structural)
  ✓ platform package.json (os/cpu/libc)
  ✓ runtime loader resolves

Done.
```

- **Phase 1 — Preflight (before Cargo even runs).** Validates the *project itself*:
  Cargo.toml consistency, `crate-type = ["cdylib"]`, crate-name detection, package.json
  exports, optionalDependencies, target compatibility, Node-API configuration. Catches
  configuration mistakes before the compiler starts — shifting CI failures to local dev.
  **Vekziun already does part of this** (the 0.1.4 Cargo.toml validation); `verify`
  formalizes it into a named phase.
- **Phase 2 — Host verify.** After building, confirm the `.node` actually loads on the
  host: it exists, Node can `require()` it, the expected exports are present, no broken
  symbols. Catches corrupt builds, missing symbols, ABI mismatch *before* publishing.
- **Phase 3 — Structural verify of cross binaries.** Inspect a `.so`/`.dylib` compiled
  for another platform *without executing it*: valid ELF/Mach-O? exports
  `napi_register_module_v1`? Catches broken cross-builds you can't run locally.

---

## Planned — v0.3.x: Configuration

- **`.ts` / `.js` configs** via a loader (e.g. c12/unconfig), replacing JSON-only.
- **Shareable presets** and a typed `defineConfig` helper.

---

## Planned — v0.4.x: Reach & Performance

- **Cross-compilation via `cargo-zigbuild`** — the big one. Today `vekziun build` only
  produces the host's target; everything else is delegated to CI's multi-OS matrix (which
  works fine — each runner builds its own natively). Zig would let *one machine* cross-
  compile targets it currently skips (Windows → Linux, → ARM, → musl). Motivated by real
  pain: cross-compiling from Windows hits linker errors (`ld.exe: unrecognized option
  '--eh-frame-hdr'`) and musl `cannot produce cdylib` — these are environment limits, not
  Vekziun bugs, and Zig is the clean way around them. Detection: if Zig is present, use
  `cargo-zigbuild`; if not, skip the target with a clear explanation.
- **More targets** — FreeBSD, riscv64, Linux armv7 — added as a single row in `triples.ts`
  each, once hardware-verified. The mechanism is complete; coverage is *data*, not *code*.
- **Parallel builds** and **build caching**.

---

## Planned — v0.5.x: Smarter diagnostics

Instead of forwarding Cargo's output verbatim, Vekziun recognizes common build failures
and suggests the most likely fix. Examples of failures it would recognize:

- missing `crate-type = ["cdylib"]`
- missing `rustup target add <triple>`
- missing Visual Studio Build Tools (Windows linker)
- Android NDK not configured
- `cargo-zigbuild` not installed
- unsupported linker

So `error[E0463]` (target not installed) would surface as:

```
Likely cause:
  The target x86_64-unknown-linux-gnu is not installed.
Run:
  rustup target add x86_64-unknown-linux-gnu
```

**Design note (why this is done carefully):** matching cargo's output by text is fragile —
cargo changes its messages between versions, and errors vary by OS. A *wrong* suggestion
made confidently is worse than none (it sends people down the wrong path). So this starts
with only the handful of unambiguous, high-frequency cases, and **always shows cargo's raw
output alongside the suggestion, never in place of it.** The suggestion is a hint, not a
replacement for the real error.

---

## Beyond

- **Extract `@vekziun/loader`** — a lightweight, runtime-only package for consumers that
  need to load a `.node` without pulling in the build tooling. Happens only when a concrete
  production addon needs it — splitting for symmetry is avoided. The rule: *who installs
  this alone, and why?*

---

## Explored and rejected (with reasons)

These were seriously considered and deliberately **not** pursued. Keeping the reasoning
prevents re-litigating them.

- **Rewrite Vekziun in Rust (like Biome).** Rejected. Biome rewrote in Rust because it
  processes millions of lines and parse speed dominates. Vekziun spends ~99% of its time
  *waiting* on cargo and npm — rewriting the orchestrator in Rust speeds up nothing
  perceptible. Worse: Vekziun installs via `npm install`; as a Rust binary it would need
  to distribute its own per-platform binaries — the exact problem Vekziun exists to solve.
- **Replace tsup / become a JS bundler.** Rejected. That's a different mission in a
  saturated space (tsup, unbuild, tshy, rollup, esbuild). Vekziun builds *native addons*,
  not JS bundles. This would dilute the one thing it does well.
- **`vekziun verify --remote` (orchestrate GitHub Actions from the CLI).** Rejected for
  now. Sounds like a differentiator, but it means building a GitHub Actions client inside a
  build tool: generate the workflow, commit, push, authenticate, poll runner status, parse
  results — huge new surface, most of it outside the niche, and fragile (GitHub API changes,
  auth, timeouts). And it's already solved more simply: `git push` of a tag runs the 3
  runners today. Marginal value, enormous cost.
- **`vekziun verify --docker`.** Deferred indefinitely. Using Docker to run the Linux
  `.node` works, but adds a heavy dependency (Docker installed, running, images pulled)
  for most users who just want to ship an addon. Advanced-only, if ever requested.
- **Bundling `ansimax` for colored output.** Rejected. It would break Vekziun's
  zero-dependency status for a few lines of output — ironic, since ansimax itself is
  zero-dep. Basic ANSI color codes can be written directly without a dependency. Reconsider
  only if building rich CLIs like `doctor`/`init` with interactive UI.

---

## Non-goals (permanent)

Vekziun will **not** become:
- a generic JS bundler (use tsup/unbuild),
- a monorepo task runner (use Nx/Turbo),
- "another build tool".

It stays focused on shipping NAPI-RS addons cross-platform, and grows only within that niche.
