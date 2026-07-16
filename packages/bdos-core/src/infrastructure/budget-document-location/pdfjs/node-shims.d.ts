// Minimal ambient declaration for the Node.js module used by this adapter
// (`node:crypto`, for the SHA-256 hash of the original bytes). `@types/node`
// is not a dependency of `@bba/bdos-core` (by design — see
// ../../../architecture/node-shims.d.ts and ../../../advisor/node-shims.d.ts,
// which establish the same narrow-shim convention already used elsewhere in
// this package). If `@types/node` is ever added as a real dependency of this
// package, this file should be deleted in favor of the official types.

declare module "node:crypto" {
  interface Hash {
    update(data: Uint8Array): Hash;
    digest(encoding: "hex"): string;
  }
  export function createHash(algorithm: "sha256"): Hash;
}
