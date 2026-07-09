// Minimal ambient declaration for the Node.js globals/modules used under
// this folder (claude-narrator.ts, copilot/context-hash.ts). `@types/node`
// is not a dependency of `@bba/bdos-core` (by design — see
// ../architecture/node-shims.d.ts), so this file declares only the narrow
// surface actually called: reading env vars, sha256 hashing. If
// `@types/node` is ever added as a real dependency of this package, this
// file should be deleted in favor of the official types.

declare const process: {
  env: Record<string, string | undefined>;
};

declare module "node:crypto" {
  interface Hash {
    update(data: string): Hash;
    digest(encoding: "hex"): string;
  }
  export function createHash(algorithm: "sha256"): Hash;
}
