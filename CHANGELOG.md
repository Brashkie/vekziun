# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
