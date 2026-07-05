"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Card } from "../Card";
import { DecisionSection } from "./DecisionSection";
import { DecisionPlaceholder } from "./DecisionPlaceholder";

export interface DecisionInsightCardSection {
  /** e.g. "Onde está o desvio?", "Nível de confiança". */
  title: string;
  /** Placeholder text only — never invented data (see PRINCIPLE 001). */
  placeholder: string;
}

export interface DecisionInsightCardProps {
  /** Which Engine is speaking through the Advisor, e.g. "Planning Engine". Rendered above the Advisor identity — the module names the context, the Advisor does the talking. */
  engineLabel: string;
  /** One-line status, e.g. "🟢 Dentro do prazo" — include the emoji, matching the platform's existing status convention. Rendered as a badge. */
  status: string;
  /** Conversational executive summary, one short sentence per line, shown even when collapsed — e.g. ["Analisei o cronograma desta obra.", "Encontrei um ponto que merece sua atenção."]. Never a form field label; the Advisor speaks like a specialist, not a form. */
  message: string[];
  /** Full Traceability sections (PRINCIPLE 001), rendered as an accordion — only one open at a time — once expanded. */
  sections: DecisionInsightCardSection[];
  /** Whether the panel starts expanded. Defaults to `false` — Progressive Disclosure (PRINCIPLE 003) always starts collapsed. */
  defaultExpanded?: boolean;
  className?: string;
}

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

/**
 * The official **BBA Advisor Decision Panel** (Release 1.1 — see
 * `README.md` in this folder, PRINCIPLE 003 — Progressive Disclosure —
 * in `packages/bdos-core/docs/BDS_ARCHITECTURE_PRINCIPLES.md`).
 *
 * Hierarchy: `engineLabel` names which Engine is behind the analysis
 * (e.g. "Planning Engine"); "BBA Advisor" is the one constant identity
 * that speaks, in every Engine, in every screen — never a prop, since
 * it must never drift between consumers.
 *
 * Starts collapsed, showing only `status` and the conversational
 * `message` — an executive summary a specialist would say out loud,
 * not a form label. Clicking "Ver análise" reveals the Full
 * Traceability sections as an accordion (only one open at a time,
 * keeping the expanded panel compact) in the same card: no modal, no
 * drawer, no navigation. The button becomes "Ocultar análise".
 *
 * This is the only component in `packages/ui/src/decision/` that holds
 * state — `expanded` (panel) and `openSectionIndex` (accordion). Every
 * other component here remains stateless, controlled by this one. The
 * page consuming this component stays a Server Component: it only ever
 * passes static props, never functions, so nothing crosses the
 * Server→Client boundary that React can't serialize.
 *
 * Reused as-is (same props, same states, same "BBA Advisor" identity)
 * by every future Engine: Planning, Execution, Geospatial, Evidence,
 * Measurement, Finance and the Executive Dashboard — see "BBA Advisor
 * UX Pattern" in `README.md`.
 *
 * Motion: the accordion content and the sections list fade in on
 * mount, reusing the existing `motion-fade-in` keyframe/tokens
 * (`packages/ui/src/motion/`, mirrored in `apps/web/app/bba-globals.css`)
 * — no new animation primitive was introduced for this.
 */
export function DecisionInsightCard({
  engineLabel,
  status,
  message,
  sections,
  defaultExpanded = false,
  className
}: DecisionInsightCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [openSectionIndex, setOpenSectionIndex] = useState(0);

  return (
    <Card
      action={<span className="status-badge status-badge--active">{status}</span>}
      className={cx("decision-insight-card", className)}
    >
      <span className="decision-insight-card__engine-label">{engineLabel}</span>

      <div className="decision-insight-card__advisor">
        <Sparkles aria-hidden="true" className="decision-insight-card__advisor-icon" size={18} />
        <span className="decision-insight-card__advisor-name">BBA Advisor</span>
      </div>

      <div className="decision-insight-card__message">
        {message.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>

      {expanded && (
        <div className="decision-insight-card__sections">
          {sections.map((section, index) => (
            <DecisionSection
              isOpen={openSectionIndex === index}
              key={section.title}
              onToggle={() => setOpenSectionIndex((current) => (current === index ? -1 : index))}
              title={section.title}
            >
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
        {expanded ? "Ocultar análise" : "Ver análise"}
      </button>
    </Card>
  );
}
