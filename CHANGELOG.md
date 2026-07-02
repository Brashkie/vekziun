# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.6] - 2026-07-01

### Changed
- **Cleanup & consistency release** — no new features, no behavior change.
- All code comments translated to English (project is now 100% English: code,
  comments, messages, docs).
- Remaining Spanish error/warning strings that had slipped through are now English
  (`resolveTriple`, build artifact-not-found, crate-name mismatch warning).
- `build()` return type cleaned up: `crateName` is now part of the `BuildResult`
  interface instead of an intersection type.
- Fixed the npm publish warning by removing the `./` prefix from the `bin` path
  (`"vekziun": "dist/cli.js"`).
- The contract test now also simulates the Android targets (arm64 + arm-eabi).

### Docs
- **ROADMAP.md fully rewritten** — detailed phases (v0.2 doctor/init/verify, v0.3
  configs, v0.4 cargo-zigbuild cross-compile), plus an explicit "explored and rejected"
  section documenting why Rust-rewrite, tsup-replacement, `verify --remote`, `--docker`,
  and bundling ansimax were all turned down.
- **Design Principles** section added to both READMEs, with the guiding tagline
  "Fail before Cargo fails."
- `verify` reframed in ROADMAP as one command with three phases (preflight → host →
  structural), and a new v0.5 "smarter diagnostics" phase (recognize common cargo
  failures and suggest fixes), with a design note on doing text-matching carefully.

## [0.1.5] - 2026-06-20

### Changed
- **All user-facing console and error messages are now in English** (were partly in
  Spanish). Affects CLI output, build/pack/publish messages, config validation errors,
  Cargo.toml validation errors, and the loader's runtime error. Code comments are
  unchanged. No API or behavior change — purely message text.

## [0.1.4] - 2026-06-20

### Added
- **Pre-build Cargo.toml validation** (`cargo-check.ts`) — before running cargo,
  Vekziun now verifies the manifest and gives clear, actionable errors instead of
  letting cargo fail cryptically:
  - Missing `crate-type = ["cdylib"]` → explains why it's needed and how to add it
    (this is the #1 mistake when starting a NAPI addon).
  - Detects the real crate name from `[lib] name` / `[package] name` instead of
    assuming, so the built binary name always matches what cargo emits.
- `build()` now warns if the config's crate name differs from the Cargo.toml's.

### Note
- Cross-compilation limits (e.g. Linux/ARM linker errors, musl cdylib restrictions
  from a Windows host) are environment constraints, not Vekziun bugs. Full
  cross-build support via cargo-zigbuild is planned (see ROADMAP.md).

## [0.1.3] - 2026-06-19

### Added
- **Android targets** — `aarch64-linux-android` (suffix `android-arm64`) and
  `armv7-linux-androideabi` (suffix `android-arm-eabi`). Now 10 supported targets.
- Verified against napi-rs's runtime loader: on Android, `process.platform` is
  `"android"` (not `"linux"`) and the 32-bit arm target carries the `eabi` suffix.
  This was confirmed against real napi-rs output, not assumed.

### Changed
- `Abi` type now includes `"eabi"` for the Android 32-bit arm case.
- Loader `currentSuffix()` handles `platform === "android"` correctly.

### Note
- Android binaries are typically cross-compiled in CI (Linux runner + NDK), not on a
  dev machine. `vekziun build` will skip Android targets locally unless the NDK
  cross-toolchain is configured — that's expected.

## [0.1.2] - 2026-06-18

### Improved
- **Build error handling** — `vekziun build` now distinguishes three outcomes instead
  of silently lumping everything into "skipped":
  - **built** — compiled successfully
  - **skipped** — the current machine lacks the target's toolchain (legitimate; another
    CI runner will handle it)
  - **failed** — the Rust code itself does not compile (fatal; cargo's output is shown)
- Previously a real compilation error was hidden as "another runner will build it",
  which was misleading. Now the actual cargo output is surfaced for code errors.
- Clear message when `cargo` is not installed (instead of a cryptic `ENOENT`).
- Defensive check: if cargo reports success but no binary is found, points to the
  likely cause (`crate-type = ["cdylib"]` or crate name mismatch).

## [0.1.1] - 2026-06-17

### Added
- Root export (`@vekziun/napi`) exposing the full public API.
- `index.ts` entry point re-exporting triples, loader, build, pack, publish, config.
- Enterprise README (EN + ES): rationale, architecture diagram, supported targets,
  roadmap, ecosystem, project structure.
- `ARCHITECTURE.md`, `ROADMAP.md`, `ECOSYSTEM.md` — enterprise documentation.
- `CHANGELOG.md`.
- `.gitattributes` — normalizes line endings to LF (CI and CLI shebang safety).
- `ci.yml` workflow: type-check, build, and contract test on every push to `main`.

### Changed
- `release.yml` now publishes the tool `@vekziun/napi` from the repository root
  (previously targeted the example addon).
- Loader: ESM-safe `require` via `createRequire`; distinguishes "binary missing"
  from "binary failed to load" instead of masking real errors.

### Fixed
- Relative imports now carry explicit `.js` extensions for Node ESM resolution.

## [0.1.0] - 2026-06-17

### Added
- Single-contract platform resolution (`triples.ts`): `triple → suffix → package`.
- `vekziun build` — compiles targets the current machine can produce.
- `vekziun pack` — generates platform packages with `os`/`cpu`/`libc`.
- `vekziun publish` — ordered publishing (platform first, main last) with
  `next` → `latest` promotion and exact-version pinning.
- Runtime loader with musl/glibc detection.
- Reference example addon and contract test.
