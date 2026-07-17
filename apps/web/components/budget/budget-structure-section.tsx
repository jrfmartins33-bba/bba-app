"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@bba/ui";
import type { BudgetDemonstrationData } from "@/lib/budget/budget-demonstration-data";

/**
 * Epic 21, Sprint 21.4B.1 — "Como o orçamento está organizado". A
 * hierarquia real (11 grupos → 25 subgrupos → 300 itens) vem só dos
 * totais confirmados — nenhum dos 300 itens reais é inventado ou
 * exposto aqui. O bloco "Exemplo de organização" é sintético, isolado,
 * expansível sob demanda (começa recolhido) e nunca somado aos
 * indicadores oficiais.
 */
export function BudgetStructureSection({ data }: { readonly data: BudgetDemonstrationData }) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();

  return (
    <Card className="span-12 workspace-card" title="Como o orçamento está organizado">
      <div className="budget-structure-diagram" aria-hidden="true">
        <span className="budget-structure-diagram__node">{data.groupCount} grupos</span>
        <span className="budget-structure-diagram__arrow">→</span>
        <span className="budget-structure-diagram__node">{data.subgroupCount} subgrupos</span>
        <span className="budget-structure-diagram__arrow">→</span>
        <span className="budget-structure-diagram__node">{data.serviceItemCount} itens de serviço</span>
      </div>

      <p className="workspace-card__description">
        A hierarquia do orçamento é mantida para que cada item continue ligado ao seu grupo, à sua
        origem e às decisões tomadas sobre ele.
      </p>

      <button
        aria-controls={contentId}
        aria-expanded={expanded}
        className="budget-structure-example__trigger"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <ChevronDown
          aria-hidden="true"
          className="budget-structure-example__chevron"
          data-expanded={expanded}
          size={16}
        />
        Ver exemplo de organização
      </button>

      {expanded ? (
        <div className="budget-structure-example" id={contentId}>
          <p className="budget-structure-example__disclaimer">
            Exemplo visual — estes itens não compõem os valores demonstrados acima.
          </p>
          <div className="budget-structure-example__groups">
            {data.structureExample.map((group) => (
              <div className="budget-structure-example__group" key={group.label}>
                <p className="budget-structure-example__group-label">{group.label}</p>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.label}>{item.label}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
