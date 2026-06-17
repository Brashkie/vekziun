// triples.ts — LA ÚNICA FUENTE DE VERDAD.
// build-time, runtime y publish importan ESTO. Nadie más conoce el formato del sufijo.
// Si esto está bien, build/loader/publish NO PUEDEN divergir.

export type Abi = "gnu" | "musl" | "msvc" | null;

export interface PlatformTriple {
  /** Rust target triple — lo que se le pasa a `cargo build --target` */
  triple: string;
  /** lo que devuelve process.platform en Node */
  platform: NodeJS.Platform;
  /** lo que devuelve process.arch en Node */
  arch: string;
  /** ABI: relevante en linux (gnu/musl) y windows (msvc); null en darwin */
  abi: Abi;
}

// v0.1: 8 triples. Android queda fuera hasta verificar qué devuelve process.platform
// en hardware real (Termux reporta "linux" o "android"? no lo asumimos).
export const TRIPLES: PlatformTriple[] = [
  { triple: "x86_64-pc-windows-msvc",     platform: "win32",  arch: "x64",   abi: "msvc" },
  { triple: "aarch64-pc-windows-msvc",    platform: "win32",  arch: "arm64", abi: "msvc" },
  { triple: "x86_64-apple-darwin",        platform: "darwin", arch: "x64",   abi: null   },
  { triple: "aarch64-apple-darwin",       platform: "darwin", arch: "arm64", abi: null   },
  { triple: "x86_64-unknown-linux-gnu",   platform: "linux",  arch: "x64",   abi: "gnu"  },
  { triple: "x86_64-unknown-linux-musl",  platform: "linux",  arch: "x64",   abi: "musl" },
  { triple: "aarch64-unknown-linux-gnu",  platform: "linux",  arch: "arm64", abi: "gnu"  },
  { triple: "aarch64-unknown-linux-musl", platform: "linux",  arch: "arm64", abi: "musl" },
];

/**
 * EL CONTRATO. El sufijo que va detrás del nombre base.
 * Ejemplo: { linux, x64, musl } -> "linux-x64-musl"
 *          { darwin, arm64, null } -> "darwin-arm64"
 * Build, loader y publish llaman ESTA función. Es la razón de que no diverjan.
 */
export function suffix(t: Pick<PlatformTriple, "platform" | "arch" | "abi">): string {
  return [t.platform, t.arch, t.abi].filter(Boolean).join("-");
}

/** "@brashkie/addon" + triple -> "@brashkie/addon-linux-x64-musl" */
export function packageNameFor(base: string, t: PlatformTriple): string {
  return `${base}-${suffix(t)}`;
}

/** busca el triple en la tabla; lanza claro si no está soportado */
export function resolveTriple(triple: string): PlatformTriple {
  const t = TRIPLES.find((x) => x.triple === triple);
  if (!t) {
    const known = TRIPLES.map((x) => x.triple).join(", ");
    throw new Error(`Triple no soportado: "${triple}".\nSoportados: ${known}`);
  }
  return t;
}
