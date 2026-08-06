import { fingerprintCanonical } from "./budget-table-reconstruction-fingerprint";
import type { BudgetColumnRole,BudgetTableReconstructionInput,ReconstructedBudgetTablePage,ResolvedColumn } from "./budget-table-reconstruction.types";
import { BUDGET_TABLE_RECONSTRUCTION_PROFILE } from "./budget-table-reconstruction-profile";
function plain(text:string):string{return text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").replace(/\s+/g," ").trim()}
function roles(text:string):BudgetColumnRole[]{const normalized=plain(text);const entries=Object.entries(BUDGET_TABLE_RECONSTRUCTION_PROFILE.headerVocabulary) as Array<[Exclude<BudgetColumnRole,"unknown">,readonly string[]]>;return entries.filter(([,words])=>words.some(word=>normalized===word||normalized.includes(word))).map(([role])=>role)}
export function resolveColumns(input:BudgetTableReconstructionInput,pages:ReadonlyArray<ReconstructedBudgetTablePage>):Map<number,ReadonlyArray<ResolvedColumn>>{
 const result=new Map<number,ReadonlyArray<ResolvedColumn>>();if(input.columnEvidence.availability==="unavailable")return result;
 for(const pageEvidence of input.columnEvidence.result.groups.flatMap(group=>group.pages).sort((a,b)=>a.pageNumber-b.pageNumber)){
  const page=pages.find(value=>value.pageNumber===pageEvidence.pageNumber);if(!page)continue;
  const hypotheses=pageEvidence.regions.flatMap(region=>region.hypotheses).sort((a,b)=>a.leftPoints-b.leftPoints||a.rightPoints-b.rightPoints);
  const unique=hypotheses.filter((hypothesis,index,array)=>array.findIndex(other=>other.leftPoints===hypothesis.leftPoints&&other.rightPoints===hypothesis.rightPoints)===index);
  const columns=unique.map((hypothesis,index):ResolvedColumn=>{const supporting=page.segments.filter(segment=>segment.runtimeReference.segmentKey!==null&&hypothesis.segmentKeys.includes(segment.runtimeReference.segmentKey));const candidates=[...new Set(supporting.flatMap(segment=>roles(segment.rawText)))].sort();return{columnId:`column:${fingerprintCanonical({pageNumber:page.pageNumber,order:index+1,left:hypothesis.leftPoints,right:hypothesis.rightPoints})}`,pageNumber:page.pageNumber,horizontalOrder:index+1,leftPoints:hypothesis.leftPoints,rightPoints:hypothesis.rightPoints,candidateRoles:candidates.length===0?["unknown"]:candidates,role:candidates.length===1?candidates[0]!:"unknown",status:candidates.length===1?"resolved":candidates.length>1?"ambiguous":"insufficient_evidence",evidenceLocators:supporting.map(segment=>segment.locator)}});
  result.set(pageEvidence.pageNumber,columns);
 } return result;
}
