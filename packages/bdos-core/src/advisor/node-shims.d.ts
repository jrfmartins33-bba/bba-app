// Minimal ambient declaration for the Node.js global used by
// claude-narrator.ts. `@types/node` is not a dependency of `@bba/bdos-core`
// (by design — see ../architecture/node-shims.d.ts), so this file declares
// only the narrow surface actually called: reading env vars. If
// `@types/node` is ever added as a real dependency of this package, this
// file should be deleted in favor of the official types.

declare const process: {
  env: Record<string, string | undefined>;
};
