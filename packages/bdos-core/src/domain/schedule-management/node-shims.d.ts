// Minimal ambient declarations for the additional Node.js APIs used by
// BBA Project Studio's Excel importer and its regression test.
// `@types/node` is not a dependency of `@bba/bdos-core` (by design — see
// `architecture/node-shims.d.ts`); this file extends the same narrow-shim
// convention with only the extra surface this module needs.

declare module "node:url" {
  export function fileURLToPath(url: string | URL): string;
}

declare module "node:zlib" {
  export function inflateRawSync(buffer: Uint8Array): Uint8Array;
  export function deflateRawSync(buffer: Uint8Array): Uint8Array;
}
