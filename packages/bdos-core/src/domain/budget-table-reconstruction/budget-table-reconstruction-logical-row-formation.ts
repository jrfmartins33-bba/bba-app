import { fingerprintCanonical } from "./budget-table-reconstruction-fingerprint";
import type { ReconstructedBudgetTablePage,ReconstructedLogicalRow,ReconstructedRowKind } from "./budget-table-reconstruction.types";
const ECONOMIC=new Set(["quantity","unit_cost","bdi_rate","unit_price","total_price"]);
function normalized(text:string):string{return text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim()}
export function formLogicalRows(page:ReconstructedBudgetTablePage):ReadonlyArray<ReconstructedLogicalRow>{const rows:ReconstructedLogicalRow[]=[];
 for(const line of page.lines){const cells=page.cells.filter(cell=>cell.rowLocator.lineVerticalOrder===line.locator.lineVerticalOrder);const texts=cells.map(cell=>normalized(cell.rawText??""));const header=(term:string)=>texts.some(text=>text===term||text.includes(term));let kind:ReconstructedRowKind="unclassified";
  if(["descricao","unidade","quantidade","preco"].filter(header).length>=2)kind="header";
  else if(cells.some(cell=>cell.role==="total_price"&&/\btotal\b/i.test(cell.rawText??"")))kind="total";
  else if(cells.some(cell=>cell.role==="total_price"&&/\bsubtotal\b/i.test(cell.rawText??"")))kind="subtotal";
  else if(cells.some(cell=>ECONOMIC.has(cell.role)&&/[0-9]/.test(cell.rawText??""))&&cells.some(cell=>cell.role==="description"))kind="service_item";
  else if(cells.filter(cell=>cell.state==="present").length===1&&cells.some(cell=>cell.state==="present"&&cell.role==="description"))kind=rows.some(row=>row.kind==="service_item")?"description_continuation":"unclassified";
  else if(cells.some(cell=>cell.role==="description")&&cells.some(cell=>cell.role==="item_code")&&!cells.some(cell=>ECONOMIC.has(cell.role)))kind="group";
  const description=cells.filter(cell=>cell.role==="description").map(cell=>cell.rawText).filter((value):value is string=>value!==null).join(" ").trim()||null;
  rows.push({rowId:`row:${fingerprintCanonical({locator:line.locator})}`,locator:line.locator,kind,status:kind==="unclassified"?"insufficient_evidence":cells.some(cell=>cell.state==="ambiguous")?"ambiguous":"resolved",cells,description,descriptionSourceRowIds:[]});
 }
 return rows.map((row,index,array)=>{if(row.kind!=="description_continuation")return row;const receivers=array.slice(0,index).filter(candidate=>candidate.locator.pageNumber===row.locator.pageNumber&&(candidate.kind==="service_item"||candidate.kind==="group"));const receiver=receivers.at(-1);if(!receiver)return{...row,kind:"unclassified",status:"insufficient_evidence"};return{...row,status:receivers.filter(candidate=>(candidate.locator.lineVerticalOrder??0)===(receiver.locator.lineVerticalOrder??0)).length===1?"resolved":"ambiguous",descriptionSourceRowIds:[receiver.rowId]}});
}
