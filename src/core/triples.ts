// triples.ts — THE SINGLE SOURCE OF TRUTH.
// build-time, runtime, and publish all import THIS. Nobody else knows the suffix format.
// If this is correct, build/loader/publish CANNOT diverge.

export type Abi = "gnu" | "musl" | "msvc" | "eabi" | null;

export interface PlatformTriple {
  /** Rust target triple — what gets passed to `cargo build --target` */
  triple: string;
  /** what process.platform returns in Node */
  platform: NodeJS.Platform;
  /** what process.arch returns in Node */
  arch: string;
  /** ABI: gnu/musl on linux, msvc on windows, eabi on android-arm; null on darwin/android-arm64 */
  abi: Abi;
}

// 10 triples. Android verified: napi-rs reports process.platform="android",
// arch "arm64"/"arm", with suffixes android-arm64 and android-arm-eabi (the 32-bit
// one carries "eabi"). Confirmed against the loader napi-rs generates.
export const TRIPLES: PlatformTriple[] = [
  { triple: "x86_64-pc-windows-msvc",     platform: "win32",   arch: "x64",   abi: "msvc" },
  { triple: "aarch64-pc-windows-msvc",    platform: "win32",   arch: "arm64", abi: "msvc" },
  { triple: "x86_64-apple-darwin",        platform: "darwin",  arch: "x64",   abi: null   },
  { triple: "aarch64-apple-darwin",       platform: "darwin",  arch: "arm64", abi: null   },
  { triple: "x86_64-unknown-linux-gnu",   platform: "linux",   arch: "x64",   abi: "gnu"  },
  { triple: "x86_64-unknown-linux-musl",  platform: "linux",   arch: "x64",   abi: "musl" },
  { triple: "aarch64-unknown-linux-gnu",  platform: "linux",   arch: "arm64", abi: "gnu"  },
  { triple: "aarch64-unknown-linux-musl", platform: "linux",   arch: "arm64", abi: "musl" },
  { triple: "aarch64-linux-android",      platform: "android", arch: "arm64", abi: null   },
  { triple: "armv7-linux-androideabi",    platform: "android", arch: "arm",   abi: "eabi" },
];

/**
 * THE CONTRACT. The suffix that goes after the base name.
 * Example: { linux, x64, musl } -> "linux-x64-musl"
 *          { darwin, arm64, null } -> "darwin-arm64"
 * Build, loader, and publish all call THIS function. It's why they can't diverge.
 */
export function suffix(t: Pick<PlatformTriple, "platform" | "arch" | "abi">): string {
  return [t.platform, t.arch, t.abi].filter(Boolean).join("-");
}

/** "@brashkie/addon" + triple -> "@brashkie/addon-linux-x64-musl" */
export function packageNameFor(base: string, t: PlatformTriple): string {
  return `${base}-${suffix(t)}`;
}

/** looks up the triple in the table; throws clearly if unsupported */
export function resolveTriple(triple: string): PlatformTriple {
  const t = TRIPLES.find((x) => x.triple === triple);
  if (!t) {
    const known = TRIPLES.map((x) => x.triple).join(", ");
    throw new Error(`Unsupported triple: "${triple}".\nSupported: ${known}`);
  }
  return t;
}
