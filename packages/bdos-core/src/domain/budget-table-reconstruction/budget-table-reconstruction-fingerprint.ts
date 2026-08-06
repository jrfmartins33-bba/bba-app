import { createHash } from "node:crypto";

function canonical(value:unknown):string{
  if(value===null)return"null";
  if(typeof value==="string"||typeof value==="boolean")return JSON.stringify(value);
  if(typeof value==="number"){if(!Number.isFinite(value))throw new TypeError("non-finite canonical number");return JSON.stringify(value)}
  if(Array.isArray(value))return`[${value.map(canonical).join(",")}]`;
  if(typeof value==="object"){const entries=Object.entries(value as Record<string,unknown>).filter(([key])=>key!=="runtimeReference"&&key!=="canonicalFingerprint").sort(([a],[b])=>a.localeCompare(b));return`{${entries.map(([key,item])=>`${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`}
  throw new TypeError("unsupported canonical value");
}
export function canonicalJson(value:unknown):string{return canonical(value)}
export function fingerprintCanonical(value:unknown):string{return createHash("sha256").update(canonical(value)).digest("hex")}
