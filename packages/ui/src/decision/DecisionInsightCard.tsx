"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Card } from "../Card";
import { DecisionSection } from "./DecisionSection";
import { DecisionPlaceholder } from "./DecisionPlaceholder";

export interface DecisionInsightCardSection {
  /** e.g. "ONDE ESTÁ O DESVIO?", "NÍVEL DE CONFIANÇA". */
  title: string;
  /** Placeholder text only — never invented data (see PRINCIPLE 001). */
  placeholder: string;
}

export interface DecisionInsightCardProps {
  /** Typically "BBA Advisor" — every Engine uses the same panel identity. */
  title: string;
  /** What this specific panel is about, e.g. "Análise do Planejamento". */
  subtitle: string;
  /** One-line status, e.g. "Dentro do prazo". Rendered as a badge next to `title`. */
  status: string;
  /** One-line executive summary shown even when collapsed, e.g. "Existe 1 ponto que merece atenção." */
  insight: string;
  /** Full Traceability sections (PRINCIPLE 001), only rendered once expanded. */
  sections: DecisionInsightCardSection[];
  /** Whether the panel starts expanded. Defaults to `false` — Progressive Disclosure (PRINCIPLE 003) always starts collapsed. */
  defaultExpanded?: boolean;
  className?: string;
}

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

/**
 * The official **BBA Advisor Decision Panel** (UI Sprint M2.2 — see
 * `README.md` in this folder and PRINCIPLE 003 — Progressive Disclosure
 * — in `packages/bdos-core/docs/BDS_ARCHITECTURE_PRINCIPLES.md`).
 *
 * Starts collapsed, showing only `status` and `insight` — an executive
 * summary. Clicking "Expandir análise" reveals the full Full
 * Traceability structure (PRINCIPLE 001) in place, in the same card:
 * no modal, no drawer, no navigation. This supersedes UI Sprint M2.1's
 * "always fully expanded" pattern — Progressive Disclosure is now the
 * one official rule.
 *
 * This is the only component in `packages/ui/src/decision/` that holds
 * state (`useState` for `expanded`) — every other component here
 * remains a plain, stateless Server Component. The page consuming this
 * component stays a Server Component too: it only ever passes static
 * props, never functions, so nothing crosses the Server→Client
 * boundary that React can't serialize.
 *
 * Reused as-is (same props, same two states, same "BBA Advisor" framing
 * and icon) by every future Engine: Planning, Execution, Geospatial,
 * Evidence, Measurement, Finance, the Executive Dashboard and the BBA
 * Advisor itself — see "BBA Advisor Decision Panel" in `README.md`.
 *
 * Motion (prepared, not implemented): the expand/collapse transition
 * and the sections' reveal are plain conditional rendering today: no
 * `FadeIn`/`SlideUp`/Progressive Reveal animation
 * (`packages/ui/src/motion/`) is wired in yet.
 */
export function DecisionInsightCard({
  title,
  subtitle,
  status,
  insight,
  sections,
  defaultExpanded = false,
  className
}: DecisionInsightCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Card
      action={<span className="status-badge status-badge--active">{status}</span>}
      className={cx("decision-insight-card", className)}
      title={title}
    >
      <div className="decision-insight-card__icon" aria-hidden="true">
        <Sparkles size={20} />
      </div>

      <p className="decision-insight-card__subtitle">{subtitle}</p>
      <p className="decision-insight-card__insight">{insight}</p>

      {expanded && (
        <div className="decision-insight-card__sections">
          {sections.map((section) => (
            <DecisionSection key={section.title} title={section.title}>
              <DecisionPlaceholder>{section.placeholder}</DecisionPlaceholder>
            </DecisionSection>
          ))}
        </div>
      )}

      <button
        className="bba-button bba-button--ghost bba-button--sm"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        {expanded ? "Recolher análise" : "Expandir análise"}
      </button>
    </Card>
  );
}
