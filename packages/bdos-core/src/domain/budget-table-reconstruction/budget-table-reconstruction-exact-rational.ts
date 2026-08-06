import type { ExactRational } from "./budget-table-reconstruction.types";

function gcd(a: bigint, b: bigint): bigint { let x=a<0n?-a:a; let y=b<0n?-b:b; while(y!==0n){const r=x%y;x=y;y=r} return x===0n?1n:x }
export function rational(numerator:bigint,denominator:bigint):ExactRational{if(denominator===0n)throw new RangeError("exact rational denominator is zero");const sign=denominator<0n?-1n:1n;const divisor=gcd(numerator,denominator);return{numerator:((numerator/divisor)*sign).toString(),denominator:((denominator/divisor)*sign).toString()}}
export function addExact(left:ExactRational,right:ExactRational):ExactRational{return rational(BigInt(left.numerator)*BigInt(right.denominator)+BigInt(right.numerator)*BigInt(left.denominator),BigInt(left.denominator)*BigInt(right.denominator))}
export function multiplyExact(left:ExactRational,right:ExactRational):ExactRational{return rational(BigInt(left.numerator)*BigInt(right.numerator),BigInt(left.denominator)*BigInt(right.denominator))}
export function divideExact(left:ExactRational,right:ExactRational):ExactRational{return rational(BigInt(left.numerator)*BigInt(right.denominator),BigInt(left.denominator)*BigInt(right.numerator))}
export function equalExact(left:ExactRational,right:ExactRational):boolean{return left.numerator===right.numerator&&left.denominator===right.denominator}
export function exactFraction(present:number,applicable:number):ExactRational|null{return applicable===0?null:rational(BigInt(present),BigInt(applicable))}
