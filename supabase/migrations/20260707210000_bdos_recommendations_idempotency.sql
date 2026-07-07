-- BDOS Recommendations — idempotência (Sprint 13.9, Advisor persistente)
--
-- Regra central deste sprint: decision_snapshots = memória técnica
-- (imutável, uma linha nova a cada import/recálculo);
-- recommendations = memória operacional (como um humano está tratando
-- um risco ao longo do tempo); Advisor = camada de orquestração sobre
-- as duas, sem sincronizá-las automaticamente.
--
-- Ponto crítico: se o mesmo risco aparecer em N imports seguidos (ex.:
-- o mesmo objeto espacial continua com confiança baixa), o Advisor não
-- pode abrir N tarefas abertas idênticas. `recommendation_ref_id` é
-- estável entre reimports do mesmo conteúdo para o mesmo projeto (ver
-- apps/web/app/api/bba-project/import/route.ts — correlationId agora
-- é fixo por engineering_project_id, não mais por upload), então este
-- índice único parcial é a garantia de banco — não apenas de aplicação
-- — de que só pode existir uma recommendation ATIVA
-- (open/acknowledged/in_progress) por (projeto, referência). Uma
-- recommendation já resolved/dismissed não conta para esta restrição:
-- se o risco reaparecer depois de fechado, nasce uma linha nova (novo
-- capítulo), nunca reabre silenciosamente uma linha que um humano já
-- fechou.
CREATE UNIQUE INDEX IF NOT EXISTS recommendations_active_ref_unique
ON public.recommendations (engineering_project_id, recommendation_ref_id)
WHERE status IN ('open', 'acknowledged', 'in_progress');
