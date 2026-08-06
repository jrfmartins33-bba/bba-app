// Minimal ambient declaration for the additional Node.js `node:fs` surface
// used by this folder's one-off generator script (reading the real source
// PDF's raw bytes, writing the generated data files). `@types/node` is not
// a dependency of `@bba/bdos-core` (by design — see
// `../../../../architecture/node-shims.d.ts`); this file extends the same
// narrow-shim convention with only the extra surface this generator needs.
// Declaration-merges with the existing `node:fs` shim (which only declares
// the `utf8`-encoded string overload).

declare module "node:fs" {
  export function readFileSync(path: string): Uint8Array;
  export function writeFileSync(path: string, data: string, encoding: "utf8"): void;
}
