# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.1] - 2026-06-17

### Added
- Root export (`@vekziun/napi`) exposing the full public API.
- `index.ts` entry point re-exporting triples, loader, build, pack, publish, config.
- Enterprise README (EN + ES): rationale, architecture diagram, supported targets,
  roadmap, ecosystem, project structure.
- `CHANGELOG.md`.
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
