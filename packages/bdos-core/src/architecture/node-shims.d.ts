// Minimal ambient declarations for the Node.js APIs used by the architecture
// guards in this folder. `@types/node` is not a dependency of `@bba/bdos-core`
// (by design — this package stays free of Node/runtime typings), so this
// file declares only the narrow surface the guards actually call. If
// `@types/node` is ever added as a real dependency of this package, this
// file should be deleted in favor of the official types.

declare module "node:fs" {
  export function readFileSync(path: string, encoding: "utf8"): string;
  export function readdirSync(path: string): string[];
  export function statSync(path: string): {
    isDirectory(): boolean;
    isFile(): boolean;
  };
}

declare module "node:path" {
  export function join(...segments: string[]): string;
  export function dirname(path: string): string;
  export function resolve(...segments: string[]): string;
  export function relative(from: string, to: string): string;
}
