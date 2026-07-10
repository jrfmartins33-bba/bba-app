-- Epic 19, Sprint 3 (Measurement Bulletin Import) — correção
-- arquitetural sobre 20260711000000_bdos_measurement_bulletin_import.sql
-- (já aplicada em produção; não editada retroativamente, ver
-- packages/bdos-core/docs/EPIC_19_SPRINT_3_PERSISTENCE_ARCHITECTURE.md).
--
-- Decisão: imutabilidade de measurement_bulletins após finalização não
-- pode depender só da camada de repository (a disciplina simples de
-- planning_imports/execution_tasks não é suficiente para um documento
-- contratual formal). RLS continua responsável só por autorização de
-- linha e isolamento por company_id -- "quem pode acessar esta
-- linha", nunca "o que pode ser alterado depois de finalizado". Essa
-- segunda regra é invariante de domínio e vive no banco via trigger,
-- não via RLS WITH CHECK (que não compara OLD contra NEW de forma
-- confiável para este caso).
--
-- Regra: enquanto OLD.finalized_at IS NULL, qualquer UPDATE segue
-- liberado ao workflow (RLS já filtra por company_id), incluindo a
-- própria transição para Finalized. A partir do momento em que
-- OLD.finalized_at IS NOT NULL, qualquer novo UPDATE na mesma linha é
-- recusado -- sem exceção para is_bba_admin(). Finalized significa
-- "documento congelado pelo BDOS", nunca "certificado pela
-- fiscalização" nem "autorizado para faturamento" (ver COMMENT ON
-- COLUMN measurement_bulletins.status na migration anterior). Uma
-- correção depois da finalização exige um novo boletim ou um
-- mecanismo formal futuro de substituição/cancelamento -- nunca
-- edição in place.

CREATE OR REPLACE FUNCTION prevent_measurement_bulletin_update_after_finalization()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.finalized_at IS NOT NULL THEN
    RAISE EXCEPTION
      'measurement_bulletins.id=%: finalized bulletins are immutable -- create a new bulletin or a future formal replacement, never edit in place',
      OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS measurement_bulletins_prevent_update_after_finalization ON measurement_bulletins;
CREATE TRIGGER measurement_bulletins_prevent_update_after_finalization
BEFORE UPDATE ON measurement_bulletins
FOR EACH ROW
EXECUTE FUNCTION prevent_measurement_bulletin_update_after_finalization();
