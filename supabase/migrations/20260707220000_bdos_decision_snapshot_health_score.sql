-- BDOS Decision Snapshot — Health Score (Sprint 13.10, Home "Hoje")
--
-- O Advisor de Engenharia (Home) precisa mostrar tendência ("Health
-- Score subiu de 72 para 81"), o que exige comparar o snapshot atual
-- com o anterior — não dá para recalcular isso depois, porque
-- decision_snapshots não guarda os campos que a fórmula de Health
-- Score usa (facts, warnings, criticalPath, spatialObjects; só
-- decisions/recommendations são persistidos). Por isso o score é
-- calculado uma vez, no momento da gravação (mesma fórmula já
-- existente e documentada em
-- apps/web/components/bba-project/bba-project-insights.ts,
-- computeHealthScore — nenhuma lógica nova, só passou a ser
-- congelada), e vive congelado aqui, coerente com o resto da tabela
-- (memória técnica imutável).
ALTER TABLE public.decision_snapshots
  ADD COLUMN IF NOT EXISTS health_score INT,
  ADD COLUMN IF NOT EXISTS health_score_level TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'decision_snapshots_health_score_range'
  ) THEN
    ALTER TABLE public.decision_snapshots
      ADD CONSTRAINT decision_snapshots_health_score_range
      CHECK (health_score IS NULL OR (health_score >= 0 AND health_score <= 100));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'decision_snapshots_health_score_level_check'
  ) THEN
    ALTER TABLE public.decision_snapshots
      ADD CONSTRAINT decision_snapshots_health_score_level_check
      CHECK (health_score_level IS NULL OR health_score_level IN ('healthy', 'attention', 'risk', 'critical'));
  END IF;
END $$;

COMMENT ON COLUMN public.decision_snapshots.health_score IS
  'Congelado no momento do cálculo via computeHealthScore() (apps/web/components/bba-project/bba-project-insights.ts) — nunca recalculado depois. NULL para snapshots gravados antes desta coluna existir.';
