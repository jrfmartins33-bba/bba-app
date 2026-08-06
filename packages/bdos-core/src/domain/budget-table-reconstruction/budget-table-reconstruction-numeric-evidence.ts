import { rational } from "./budget-table-reconstruction-exact-rational";
import type { ExactRational, ParsedNumericEvidence, SourceFragmentReference } from "./budget-table-reconstruction.types";

function decimalValue(sign:string,whole:string,fraction:string):ExactRational{const digits=`${whole}${fraction}`;const n=BigInt(digits||"0")*(sign==="-"?-1n:1n);return rational(n,10n**BigInt(fraction.length))}
function candidate(text:string,decimal:"."|","):ExactRational|null{const other=decimal==="."?",":".";const escaped=decimal==="."?"\\.":",";const pattern=new RegExp(`^([+-]?)(\\d{1,3}(?:\\${other}\\d{3})*|\\d+)(?:${escaped}(\\d+))?$`);const match=pattern.exec(text);if(!match)return null;return decimalValue(match[1]??"",(match[2]??"").split(other).join(""),match[3]??"")}
export function parseNumericEvidence(rawText:string,sourceFragments:ReadonlyArray<SourceFragmentReference>,grammarHint:"decimal_comma"|"decimal_point"|null=null):ParsedNumericEvidence{
 const normalizedText=rawText.normalize("NFKC").replace(/(?:R\$|%)/gi,"").replace(/\s+/g,"").trim();
 const separator=[...normalizedText].filter(c=>c==="."||c===",");
 const scale=separator.length===0?0:normalizedText.length-normalizedText.lastIndexOf(separator[separator.length-1]??"")-1;
 const comma=candidate(normalizedText,","); const point=candidate(normalizedText,".");
 let values=[comma,point].filter((v):v is ExactRational=>v!==null).filter((v,i,a)=>a.findIndex(x=>x.numerator===v.numerator&&x.denominator===v.denominator)===i);
 if(grammarHint!==null){const selected=grammarHint==="decimal_comma"?comma:point;values=selected?[selected]:[]}
 const ambiguous=grammarHint===null&&/^[-+]?\d{1,3}[.,]\d{3}$/.test(normalizedText)&&values.length>1;
 return{rawText,normalizedText,displayedScale:scale,grammarId:grammarHint??(ambiguous?"ambiguous-single-separator-v1":comma&&normalizedText.includes(",")?"decimal-comma-v1":"decimal-point-v1"),exactValue:values.length===1&&!ambiguous?values[0]!:null,alternativeValues:ambiguous?values:[],status:ambiguous?"ambiguous":values.length===1?"resolved":"invalid",sourceFragments};
}
