-- ============================================================
-- BBA APP — MIGRATION 202506290003
-- Tabelas de Referência Trabalhistas e Tributação sobre Renda
-- Fontes: Receita Federal, MTE, INSS, Caixa Econômica Federal
-- Atualizado: Junho 2025
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. ref_salario_minimo
-- Fonte: MTE / Lei — histórico completo relevante + 2025
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_salario_minimo (
  id                  SERIAL PRIMARY KEY,
  valor               NUMERIC(10,2) NOT NULL,
  data_vigencia_inicio DATE          NOT NULL,
  data_vigencia_fim    DATE,
  base_legal          VARCHAR(100),
  observacao          TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_salario_minimo IS 'Histórico do salário mínimo nacional — MTE. Vigente: R$ 1.518,00 (Jan/2025 - Decreto 12.302/2024)';

INSERT INTO ref_salario_minimo (valor, data_vigencia_inicio, data_vigencia_fim, base_legal, observacao) VALUES
(724.00,  '2014-01-01', '2015-01-31', 'Decreto 8.166/2013',  NULL),
(788.00,  '2015-01-01', '2016-01-31', 'Decreto 8.381/2015',  NULL),
(880.00,  '2016-01-01', '2017-01-31', 'Decreto 8.618/2015',  NULL),
(937.00,  '2017-01-01', '2018-01-31', 'Decreto 9.255/2017',  NULL),
(954.00,  '2018-01-01', '2019-01-31', 'Decreto 9.661/2018',  NULL),
(998.00,  '2019-01-01', '2020-01-31', 'Medida Provisória 892/2019', NULL),
(1045.00, '2020-02-01', '2021-01-31', 'Decreto 10.313/2020', NULL),
(1100.00, '2021-01-01', '2022-01-31', 'Decreto 10.587/2020', NULL),
(1212.00, '2022-01-01', '2023-05-01', 'Medida Provisória 1.109/2022', NULL),
(1320.00, '2023-05-01', '2024-01-01', 'Medida Provisória 1.172/2023', 'Reajuste antecipado para maio/2023'),
(1412.00, '2024-01-01', '2024-12-31', 'Decreto 11.864/2023', NULL),
(1518.00, '2025-01-01', NULL,         'Decreto 12.302/2024', 'Vigente em 2025. Aumento de 7,5% sobre 2024.');

-- ────────────────────────────────────────────────────────────
-- 2. ref_irpf_faixas
-- Fonte: Receita Federal — tabela IRPF 2025
-- Lei 14.848/2024 (tabela progressiva mensal e anual)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_irpf_faixas (
  id                    SERIAL PRIMARY KEY,
  ano_calendario        SMALLINT      NOT NULL,
  periodicidade         VARCHAR(10)   NOT NULL CHECK (periodicidade IN ('Mensal','Anual')),
  faixa                 SMALLINT      NOT NULL,
  base_calculo_de       NUMERIC(12,2) NOT NULL,  -- valor inicial da faixa
  base_calculo_ate      NUMERIC(12,2),            -- NULL = sem limite (última faixa)
  aliquota              NUMERIC(5,2)  NOT NULL,   -- em percentual (ex: 22.5)
  deducao_parcela       NUMERIC(12,2) NOT NULL,   -- parcela a deduzir do imposto
  deducao_dependente    NUMERIC(10,2),             -- dedução por dependente (anual/mensal)
  observacao            TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_irpf_faixas IS 'Tabela progressiva IRPF — Receita Federal. Lei 14.848/2024. Vigente 2025.';

-- Tabela Mensal IRPF 2025 (Lei 14.848/2024)
INSERT INTO ref_irpf_faixas (ano_calendario, periodicidade, faixa, base_calculo_de, base_calculo_ate, aliquota, deducao_parcela, deducao_dependente, observacao) VALUES
(2025,'Mensal',1,      0.00,  2428.80, 0.00,    0.00,    235.89, 'Isento. Limite de isenção: R$ 2.428,80/mês'),
(2025,'Mensal',2,  2428.81,  2826.65, 7.50,   182.16,   235.89, NULL),
(2025,'Mensal',3,  2826.66,  3751.05,15.00,   394.16,   235.89, NULL),
(2025,'Mensal',4,  3751.06,  4664.68,22.50,   675.49,   235.89, NULL),
(2025,'Mensal',5,  4664.69,      NULL,27.50,   908.74,   235.89, 'Alíquota máxima');

-- Tabela Anual IRPF 2025 (declaração ano-base 2024 — IN RFB 2.255/2024 e tabela progressiva anual)
INSERT INTO ref_irpf_faixas (ano_calendario, periodicidade, faixa, base_calculo_de, base_calculo_ate, aliquota, deducao_parcela, deducao_dependente, observacao) VALUES
(2025,'Anual',1,       0.00,  29142.00, 0.00,      0.00,  2275.08, 'Isento'),
(2025,'Anual',2,  29142.01,  33919.80, 7.50,   2185.50,   2275.08, NULL),
(2025,'Anual',3,  33919.81,  45012.60,15.00,   4706.82,   2275.08, NULL),
(2025,'Anual',4,  45012.61,  55976.16,22.50,   8078.50,   2275.08, NULL),
(2025,'Anual',5,  55976.17,       NULL,27.50,  10877.34,   2275.08, 'Alíquota máxima');

-- Tabela Mensal IRPF 2024 (ano-base para declaração entregue em 2025)
INSERT INTO ref_irpf_faixas (ano_calendario, periodicidade, faixa, base_calculo_de, base_calculo_ate, aliquota, deducao_parcela, deducao_dependente, observacao) VALUES
(2024,'Mensal',1,      0.00,  2259.20, 0.00,    0.00,    189.59, 'Isento até R$ 2.259,20/mês'),
(2024,'Mensal',2,  2259.21,  2826.65, 7.50,   169.44,   189.59, NULL),
(2024,'Mensal',3,  2826.66,  3751.05,15.00,   381.44,   189.59, NULL),
(2024,'Mensal',4,  3751.06,  4664.68,22.50,   662.77,   189.59, NULL),
(2024,'Mensal',5,  4664.69,      NULL,27.50,   896.00,   189.59, 'Alíquota máxima');

-- Tabela Anual IRPF 2024 (declaração ano-base 2023)
INSERT INTO ref_irpf_faixas (ano_calendario, periodicidade, faixa, base_calculo_de, base_calculo_ate, aliquota, deducao_parcela, deducao_dependente, observacao) VALUES
(2024,'Anual',1,       0.00,  27110.40, 0.00,      0.00,  2275.08, 'Isento'),
(2024,'Anual',2,  27110.41,  33919.80, 7.50,   2033.28,   2275.08, NULL),
(2024,'Anual',3,  33919.81,  45012.60,15.00,   4573.46,   2275.08, NULL),
(2024,'Anual',4,  45012.61,  55976.16,22.50,   7932.36,   2275.08, NULL),
(2024,'Anual',5,  55976.17,       NULL,27.50,  10720.36,   2275.08, 'Alíquota máxima');

-- Tabela Mensal IRPF 2023 (histórico)
INSERT INTO ref_irpf_faixas (ano_calendario, periodicidade, faixa, base_calculo_de, base_calculo_ate, aliquota, deducao_parcela, deducao_dependente, observacao) VALUES
(2023,'Mensal',1,      0.00,  2112.00, 0.00,    0.00,    189.59, 'Isento até R$ 2.112,00/mês (antes Medida Provisória 1.171/2023 de mai/2023)'),
(2023,'Mensal',2,  2112.01,  2826.65, 7.50,   158.40,   189.59, NULL),
(2023,'Mensal',3,  2826.66,  3751.05,15.00,   370.40,   189.59, NULL),
(2023,'Mensal',4,  3751.06,  4664.68,22.50,   651.73,   189.59, NULL),
(2023,'Mensal',5,  4664.69,      NULL,27.50,   884.96,   189.59, 'Alíquota máxima');

-- ────────────────────────────────────────────────────────────
-- 3. ref_irpf_deducoes
-- Deduções legais permitidas — IRPF 2025
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_irpf_deducoes (
  id                SERIAL PRIMARY KEY,
  ano_calendario    SMALLINT      NOT NULL,
  tipo_deducao      VARCHAR(60)   NOT NULL,
  valor_limite      NUMERIC(12,2),             -- NULL = sem limite (ilimitado)
  percentual        NUMERIC(5,2),              -- quando a dedução é percentual
  base_legal        VARCHAR(100),
  observacao        TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_irpf_deducoes IS 'Deduções permitidas na declaração IRPF — Receita Federal 2025';

INSERT INTO ref_irpf_deducoes (ano_calendario, tipo_deducao, valor_limite, percentual, base_legal, observacao) VALUES
(2025,'Dependente por pessoa',                 NULL,          NULL, 'Lei 14.848/2024', 'R$ 2.275,08/dependente por ano (tabela anual). R$ 189,59/mês.'),
(2025,'Educação por pessoa (própria ou dependente)', 3561.50, NULL, 'Lei 14.848/2024', 'Limite anual por pessoa. Inclui: ensino infantil, fundamental, médio, superior, técnico, pós-graduação.'),
(2025,'Saúde',                                 NULL,          NULL, 'Lei 14.848/2024', 'Sem limite. Médico, odontólogo, fisioterapeuta, hospital, plano de saúde.'),
(2025,'Previdência oficial (INSS)',             NULL,          NULL, 'Lei 14.848/2024', 'Sem limite. Contribuição ao INSS deduz integralmente da base.'),
(2025,'Previdência privada (PGBL)',             NULL,         12.00, 'Lei 14.848/2024', 'Limite: 12% da renda bruta tributável anual. Apenas PGBL (não VGBL).'),
(2025,'Pensão alimentícia judicial',            NULL,          NULL, 'Lei 14.848/2024', 'Sem limite. Obrigatória por decisão judicial ou acordo homologado.'),
(2025,'Livro-caixa (autônomo)',                 NULL,          NULL, 'Lei 14.848/2024', 'Despesas necessárias à percepção da renda e à manutenção da fonte produtora.'),
(2025,'Desconto simplificado',                  NULL,         20.00, 'Lei 14.848/2024', '20% da renda tributável, até R$ 16.754,34. Em substituição a todas as deduções legais.');

-- ────────────────────────────────────────────────────────────
-- 4. ref_inss_faixas
-- Fonte: Portaria MPS / IN RFB — INSS 2025
-- Portaria Interministerial MPS/MF 26/2025 + IN RFB 2.178/2024
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_inss_faixas (
  id                      SERIAL PRIMARY KEY,
  ano                     SMALLINT      NOT NULL,
  mes_inicio              SMALLINT      NOT NULL DEFAULT 1,
  mes_fim                 SMALLINT      NOT NULL DEFAULT 12,
  categoria               VARCHAR(30)   NOT NULL CHECK (categoria IN (
                            'Empregado','Empregado Doméstico','Avulso','Contribuinte Individual',
                            'Facultativo','MEI','Segurado Especial','Empresa')),
  faixa                   SMALLINT,
  salario_de              NUMERIC(12,2) NOT NULL,
  salario_ate             NUMERIC(12,2),           -- NULL = acima do teto
  aliquota                NUMERIC(5,2)  NOT NULL,  -- em percentual
  valor_fixo              NUMERIC(10,2),            -- para MEI e contribuição mínima
  teto_contribuicao       NUMERIC(10,2),            -- teto de contribuição mensal
  base_legal              VARCHAR(100),
  observacao              TEXT,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_inss_faixas IS 'Tabela de alíquotas e faixas INSS — Portaria Interministerial MPS/MF. Vigente 2025. Teto: R$ 7.786,02. Salário mínimo: R$ 1.518,00.';

-- INSS Empregado 2025 — Tabela progressiva (Lei 13.135/2015 + LC 150/2015)
-- Portaria Interministerial MPS/MF nº 26, de 15/01/2025
INSERT INTO ref_inss_faixas (ano, categoria, faixa, salario_de, salario_ate, aliquota, teto_contribuicao, base_legal, observacao) VALUES
(2025,'Empregado',         1,    0.00,  1518.00,  7.50, NULL, 'Portaria Interministerial MPS/MF 26/2025', 'Até 1 salário mínimo'),
(2025,'Empregado',         2, 1518.01,  2793.88,  9.00, NULL, 'Portaria Interministerial MPS/MF 26/2025', NULL),
(2025,'Empregado',         3, 2793.89,  4190.83, 12.00, NULL, 'Portaria Interministerial MPS/MF 26/2025', NULL),
(2025,'Empregado',         4, 4190.84,  7786.02, 14.00, NULL, 'Portaria Interministerial MPS/MF 26/2025', 'Acima deste limite: contribui apenas sobre R$ 7.786,02 (teto). Alíquota efetiva progressiva.'),
-- INSS Empresa (parte patronal) — 20% sobre folha (regra geral)
(2025,'Empresa',           1,    0.00,      NULL, 20.00, NULL, 'Art. 22 Lei 8.212/1991', 'Contribuição patronal sobre folha de salários + pró-labore. + RAT/GILRAT conforme atividade.'),
-- INSS Contribuinte Individual 2025 (autônomo, sócio pró-labore)
(2025,'Contribuinte Individual',1, 1518.00, 7786.02, 20.00, 1557.20, 'Art. 21 Lei 8.212/1991', 'Alíquota normal: 20%. Alíquota reduzida 11% sem aposentadoria por tempo de contribuição. Teto: R$ 7.786,02. Contribuição máxima: R$ 1.557,20.'),
(2025,'Contribuinte Individual',2, 1518.00, 7786.02, 11.00,  856.46, 'Art. 21 §2 Lei 8.212/1991', 'Alíquota reduzida: 11% (não tem direito a aposentadoria por tempo de contribuição).'),
-- INSS Facultativo 2025
(2025,'Facultativo',       1, 1518.00,  7786.02, 20.00, 1557.20, 'Art. 21 Lei 8.212/1991', 'Normal: 20%. Baixa renda: 5% (apenas para dona de casa de família de baixa renda).'),
(2025,'Facultativo',       2, 1518.00,  1518.00,  5.00,   75.90, 'Art. 21 §2 LC 123/2006', 'Exclusivo dona de casa baixa renda. Sem direito a aposentadoria por tempo.'),
-- MEI 2025
(2025,'MEI',               1, 1518.00,  1518.00,  5.00,   75.90, 'LC 123/2006 + Res. CGSN 140/2018', 'MEI: 5% sobre salário mínimo = R$ 75,90/mês. + R$ 1,00 ICMS e/ou R$ 5,00 ISS conforme atividade. Total DAS: R$ 76,90 a R$ 81,90.'),
-- INSS Doméstico Empregado 2025
(2025,'Empregado Doméstico',1,   0.00,  1518.00,  7.50, NULL, 'LC 150/2015 + Portaria MPS/MF 26/2025', 'Tabela progressiva igual empregado CLT'),
(2025,'Empregado Doméstico',2, 1518.01, 2793.88,  9.00, NULL, 'LC 150/2015', NULL),
(2025,'Empregado Doméstico',3, 2793.89, 4190.83, 12.00, NULL, 'LC 150/2015', NULL),
(2025,'Empregado Doméstico',4, 4190.84, 7786.02, 14.00, NULL, 'LC 150/2015', 'Teto: R$ 7.786,02');

-- INSS Empregado 2024 (histórico)
INSERT INTO ref_inss_faixas (ano, categoria, faixa, salario_de, salario_ate, aliquota, teto_contribuicao, base_legal, observacao) VALUES
(2024,'Empregado',         1,    0.00,  1412.00,  7.50, NULL, 'Portaria MPS/MF 20/2024', 'Até 1 salário mínimo 2024'),
(2024,'Empregado',         2, 1412.01,  2666.68,  9.00, NULL, 'Portaria MPS/MF 20/2024', NULL),
(2024,'Empregado',         3, 2666.69,  4000.03, 12.00, NULL, 'Portaria MPS/MF 20/2024', NULL),
(2024,'Empregado',         4, 4000.04,  7786.02, 14.00, NULL, 'Portaria MPS/MF 20/2024', 'Teto R$ 7.786,02 mantido em 2024'),
(2024,'MEI',               1, 1412.00,  1412.00,  5.00,   70.60, 'LC 123/2006', 'MEI 2024: 5% × R$ 1.412,00 = R$ 70,60 + fixos');

-- ────────────────────────────────────────────────────────────
-- 5. ref_inss_tetos
-- Tetos e bases do INSS por ano
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_inss_tetos (
  id                    SERIAL PRIMARY KEY,
  ano                   SMALLINT      NOT NULL UNIQUE,
  teto_beneficio        NUMERIC(10,2) NOT NULL,  -- teto do benefício previdenciário
  teto_contribuicao     NUMERIC(10,2) NOT NULL,  -- teto de contribuição (=teto benefício)
  salario_minimo_ref    NUMERIC(10,2) NOT NULL,
  base_legal            VARCHAR(100),
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

INSERT INTO ref_inss_tetos (ano, teto_beneficio, teto_contribuicao, salario_minimo_ref, base_legal) VALUES
(2025, 7786.02, 7786.02, 1518.00, 'Portaria Interministerial MPS/MF 26/2025'),
(2024, 7786.02, 7786.02, 1412.00, 'Portaria Interministerial MPS/MF 20/2024'),
(2023, 7507.49, 7507.49, 1320.00, 'Portaria MPS/MF 914/2023'),
(2022, 7087.22, 7087.22, 1212.00, 'Portaria PRTM 914/2022'),
(2021, 6433.57, 6433.57, 1100.00, 'Portaria PRTM 3.659/2021'),
(2020, 6101.06, 6101.06, 1045.00, 'Portaria MEC 3.659/2020');

-- ────────────────────────────────────────────────────────────
-- 6. ref_fgts
-- Fonte: Caixa Econômica Federal / Lei 8.036/1990
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_fgts (
  id                      SERIAL PRIMARY KEY,
  ano                     SMALLINT      NOT NULL,
  categoria               VARCHAR(40)   NOT NULL,
  aliquota_mensal         NUMERIC(5,2)  NOT NULL,  -- ex: 8.00
  aliquota_rescisao_sem_justa_causa NUMERIC(5,2),   -- multa rescisória %
  aliquota_rescisao_com_justa_causa NUMERIC(5,2),
  correcao_referencial    VARCHAR(10)   DEFAULT 'TR',
  juros_remuneracao       NUMERIC(5,2)  DEFAULT 3.00,
  base_legal              VARCHAR(100),
  observacao              TEXT,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_fgts IS 'Alíquotas FGTS — Lei 8.036/1990 e atualizações. Vigente 2025.';

INSERT INTO ref_fgts (ano, categoria, aliquota_mensal, aliquota_rescisao_sem_justa_causa, aliquota_rescisao_com_justa_causa, base_legal, observacao) VALUES
(2025,'Empregado CLT',              8.00, 40.00, 0.00, 'Lei 8.036/1990 + LC 110/2001', '8% sobre remuneração. Multa rescisória: 40% do saldo + 10% para o governo (LC 110/2001 — encargo social). Total efetivo: 50% do saldo.'),
(2025,'Empregado Doméstico',        8.00, 40.00, 0.00, 'LC 150/2015',               'FGTS doméstico obrigatório desde out/2015. Mesmas regras CLT.'),
(2025,'Trabalhador Avulso',         8.00, 40.00, 0.00, 'Lei 8.036/1990',            'Igual empregado CLT.'),
(2025,'Menor Aprendiz',             2.00,  0.00, 0.00, 'Art. 15 §7 Lei 8.036/1990','Alíquota reduzida de 2% durante período de aprendizagem.'),
(2025,'Empregado Rural',            8.00, 40.00, 0.00, 'Lei 8.036/1990',            'Mesmas regras empregado urbano.'),
(2024,'Empregado CLT',              8.00, 40.00, 0.00, 'Lei 8.036/1990',            'Valores 2024'),
(2023,'Empregado CLT',              8.00, 40.00, 0.00, 'Lei 8.036/1990',            'Valores 2023');

-- ────────────────────────────────────────────────────────────
-- 7. ref_inss_contribuicao_empresa
-- Encargos patronais detalhados (empresa/empregador)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_inss_contribuicao_empresa (
  id            SERIAL PRIMARY KEY,
  ano           SMALLINT      NOT NULL,
  encargo       VARCHAR(60)   NOT NULL,
  aliquota      NUMERIC(5,2)  NOT NULL,
  obrigatorio   BOOLEAN       NOT NULL DEFAULT TRUE,
  base_calculo  VARCHAR(100),
  base_legal    VARCHAR(100),
  observacao    TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_inss_contribuicao_empresa IS 'Encargos patronais sobre folha — INSS empresa. Vigente 2025.';

INSERT INTO ref_inss_contribuicao_empresa (ano, encargo, aliquota, obrigatorio, base_calculo, base_legal, observacao) VALUES
(2025,'INSS Patronal (regra geral)',        20.00, TRUE,  'Folha de salários + pró-labore', 'Art. 22 Lei 8.212/1991', 'Base: salários + adicionais + 13º + férias + horas extras.'),
(2025,'RAT/GILRAT — Risco leve (1%)',        1.00, TRUE,  'Folha de salários', 'Art. 22 II Lei 8.212/1991', 'Risco de Acidentes do Trabalho. Grau de risco leve: 1%. Médio: 2%. Grave: 3%. Multiplicado pelo FAP (0,5 a 2).'),
(2025,'RAT/GILRAT — Risco médio (2%)',       2.00, TRUE,  'Folha de salários', 'Art. 22 II Lei 8.212/1991', 'Grau médio de risco.'),
(2025,'RAT/GILRAT — Risco grave (3%)',       3.00, TRUE,  'Folha de salários', 'Art. 22 II Lei 8.212/1991', 'Grau grave de risco.'),
(2025,'SESC/SESI/SESCOOP (terceiros)',       1.50, TRUE,  'Folha de salários', 'Art. 240 CF + Decreto 2.318/1986', 'Varia por atividade: 0,60% a 2,50%.'),
(2025,'SENAI/SENAC/SENAT (terceiros)',       1.00, TRUE,  'Folha de salários', 'Decreto 2.318/1986', 'Varia por atividade.'),
(2025,'INCRA',                               0.20, TRUE,  'Folha de salários', 'Lei 2.613/1955', 'Para empresas rurais e agroindustriais.'),
(2025,'SEBRAE',                              0.60, TRUE,  'Folha de salários', 'Lei 8.029/1990', 'Para EPP e ME.'),
(2025,'Salário-Educação',                    2.50, TRUE,  'Folha de salários', 'Art. 212 §5 CF', 'Destinado ao FNDE.'),
(2025,'FGTS (sobre folha)',                  8.00, TRUE,  'Remuneração bruta', 'Lei 8.036/1990', 'Encargo patronal: 8% sobre remuneração total. Depositado mensalmente.'),
(2025,'Custo total estimado sobre salário', 70.00, FALSE, 'Estimativa global', 'Diversas', 'Estimativa geral de encargos totais sobre a folha de salários, incluindo INSS patronal, RAT, terceiros, FGTS, provisões (13º, férias, FGTS sobre provisões).');

-- ────────────────────────────────────────────────────────────
-- 8. ref_cbo
-- Fonte: MTE — CBO 2002 (última versão oficial)
-- Seed com grandes grupos + subgrupos principais + ocupações MEI/PME
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_cbo (
  id            SERIAL PRIMARY KEY,
  codigo        VARCHAR(7)   NOT NULL UNIQUE,  -- ex: 2521-05
  descricao     VARCHAR(200) NOT NULL,
  grande_grupo  VARCHAR(2)   NOT NULL,
  subgrupo      VARCHAR(3),
  familia       VARCHAR(4),
  nivel         VARCHAR(15)  NOT NULL CHECK (nivel IN ('GrandeGrupo','SubGrupo','GrupoBase','Familia','Ocupacao')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_cbo IS 'Classificação Brasileira de Ocupações — MTE CBO 2002. Seed com grandes grupos e ocupações mais comuns em MEIs e PMEs.';

CREATE INDEX IF NOT EXISTS idx_cbo_codigo     ON ref_cbo(codigo);
CREATE INDEX IF NOT EXISTS idx_cbo_descricao  ON ref_cbo USING gin(to_tsvector('portuguese', descricao));

INSERT INTO ref_cbo (codigo, descricao, grande_grupo, nivel) VALUES
('0','Forças Armadas, Policiais e Bombeiros Militares','0','GrandeGrupo'),
('1','Membros superiores do poder público, dirigentes de organizações de interesse público e de empresas e gerentes','1','GrandeGrupo'),
('2','Profissionais das ciências e das artes','2','GrandeGrupo'),
('3','Técnicos de nível médio','3','GrandeGrupo'),
('4','Trabalhadores de serviços administrativos','4','GrandeGrupo'),
('5','Trabalhadores dos serviços, vendedores do comércio em lojas e mercados','5','GrandeGrupo'),
('6','Trabalhadores agropecuários, florestais, da caça e pesca','6','GrandeGrupo'),
('7','Trabalhadores da produção de bens e serviços industriais — Grupo 7','7','GrandeGrupo'),
('8','Trabalhadores da produção de bens e serviços industriais — Grupo 8','8','GrandeGrupo'),
('9','Trabalhadores em serviços de reparação e manutenção','9','GrandeGrupo');

-- Ocupações mais relevantes para MEIs e PMEs
INSERT INTO ref_cbo (codigo, descricao, grande_grupo, subgrupo, familia, nivel) VALUES
-- Gerentes
('1231-05','Gerente de operações comerciais','1','12','1231','Ocupacao'),
('1232-05','Gerente de marketing','1','12','1232','Ocupacao'),
('1236-05','Gerente financeiro','1','12','1236','Ocupacao'),
('1411-05','Gerente de loja','1','14','1411','Ocupacao'),
-- Contabilidade e finanças
('2522-05','Contador','2','25','2522','Ocupacao'),
('2522-10','Auditor contábil','2','25','2522','Ocupacao'),
('2524-05','Analista financeiro','2','25','2524','Ocupacao'),
('3514-05','Auxiliar de contabilidade','3','35','3514','Ocupacao'),
('3514-10','Técnico em contabilidade','3','35','3514','Ocupacao'),
-- TI e tecnologia
('2124-05','Administrador de banco de dados','2','21','2124','Ocupacao'),
('2124-10','Administrador de redes','2','21','2124','Ocupacao'),
('2124-20','Analista de segurança da informação','2','21','2124','Ocupacao'),
('2521-05','Analista de sistemas','2','25','2521','Ocupacao'),
('2521-10','Analista de tecnologia da informação','2','25','2521','Ocupacao'),
('3172-05','Técnico de suporte ao usuário de tecnologia da informação','3','31','3172','Ocupacao'),
('2513-05','Analista de desenvolvimento de sistemas (programador)','2','25','2513','Ocupacao'),
-- Vendas e comércio
('3541-05','Representante comercial autônomo','3','35','3541','Ocupacao'),
('3542-05','Operador de vendas (telemarketing ativo)','3','35','3542','Ocupacao'),
('5211-05','Vendedor de comércio varejista','5','52','5211','Ocupacao'),
('5211-10','Operador de caixa','5','52','5211','Ocupacao'),
-- Administrativos
('4110-05','Assistente administrativo','4','41','4110','Ocupacao'),
('4120-05','Assistente de recursos humanos','4','41','4120','Ocupacao'),
('4151-05','Auxiliar de escritório','4','41','4151','Ocupacao'),
('4211-05','Recepcionista em geral','4','42','4211','Ocupacao'),
('4221-05','Agente de atendimento e informação (SAC)','4','42','4221','Ocupacao'),
-- Construção e engenharia
('1228-05','Diretor de obras de infraestrutura','1','12','1228','Ocupacao'),
('2142-05','Engenheiro civil','2','21','2142','Ocupacao'),
('2142-10','Engenheiro de infraestrutura','2','21','2142','Ocupacao'),
('2143-05','Engenheiro eletricista','2','21','2143','Ocupacao'),
('3112-05','Técnico de edificações','3','31','3112','Ocupacao'),
('7111-05','Pedreiro','7','71','7111','Ocupacao'),
('7121-05','Armador de estrutura de concreto','7','71','7121','Ocupacao'),
('7124-05','Eletricista de instalações','7','71','7124','Ocupacao'),
('7131-05','Encanador','7','71','7131','Ocupacao'),
('7152-05','Pintor de obras','7','71','7152','Ocupacao'),
-- Saúde
('2231-05','Médico clínico','2','22','2231','Ocupacao'),
('2232-05','Médico do trabalho','2','22','2232','Ocupacao'),
('2235-05','Nutricionista','2','22','2235','Ocupacao'),
('2236-05','Enfermeiro','2','22','2236','Ocupacao'),
('2237-05','Fisioterapeuta','2','22','2237','Ocupacao'),
('3222-05','Técnico de enfermagem','3','32','3222','Ocupacao'),
-- Educação
('2312-05','Professor de ensino fundamental (séries iniciais)','2','23','2312','Ocupacao'),
('2313-05','Professor de ensino fundamental (séries finais)','2','23','2313','Ocupacao'),
('2321-05','Professor de ensino médio','2','23','2321','Ocupacao'),
('2347-05','Instrutor de cursos livres','2','23','2347','Ocupacao'),
-- Alimentação e hospitalidade
('5132-10','Garçom','5','51','5132','Ocupacao'),
('5133-05','Atendente de lanchonete','5','51','5133','Ocupacao'),
('5141-05','Cozinheiro geral','5','51','5141','Ocupacao'),
('5142-05','Pizzaiolo','5','51','5142','Ocupacao'),
('5143-05','Confeiteiro','5','51','5143','Ocupacao'),
-- Beleza e estética
('5161-10','Cabeleireiro','5','51','5161','Ocupacao'),
('5161-15','Esteticista','5','51','5161','Ocupacao'),
('5162-05','Barbeiro','5','51','5162','Ocupacao'),
-- Transporte e logística
('7823-05','Motorista de caminhão','7','78','7823','Ocupacao'),
('7824-05','Motorista de veículo de cargas leves','7','78','7824','Ocupacao'),
('5191-20','Mototaxista','5','51','5191','Ocupacao'),
('4141-05','Operador de logística','4','41','4141','Ocupacao'),
-- Limpeza e conservação
('5143-40','Diarista','5','51','5143','Ocupacao'),
('5161-35','Auxiliar de limpeza','5','51','5161','Ocupacao'),
('5171-05','Zelador de edifício','5','51','5171','Ocupacao'),
-- Segurança
('5174-05','Vigilante','5','51','5174','Ocupacao'),
('5175-05','Porteiro','5','51','5175','Ocupacao');

-- ────────────────────────────────────────────────────────────
-- 9. ref_contribuicao_sindical
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_contribuicao_sindical (
  id            SERIAL PRIMARY KEY,
  ano           SMALLINT      NOT NULL,
  tipo          VARCHAR(20)   NOT NULL CHECK (tipo IN ('Empregado','Empregador','Autônomo')),
  base_calculo  VARCHAR(100),
  percentual    NUMERIC(5,2),
  desconto_mensal VARCHAR(50),
  obrigatorio   BOOLEAN       NOT NULL DEFAULT FALSE,
  base_legal    VARCHAR(100),
  observacao    TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_contribuicao_sindical IS 'Contribuição sindical — facultativa desde Reforma Trabalhista (Lei 13.467/2017)';

INSERT INTO ref_contribuicao_sindical (ano, tipo, base_calculo, percentual, desconto_mensal, obrigatorio, base_legal, observacao) VALUES
(2025,'Empregado',   'Um dia de salário por ano (desconto em março)', NULL, '1/30 do salário mensal', FALSE, 'Art. 578 CLT + Lei 13.467/2017', 'FACULTATIVA desde novembro/2017. Empregado deve autorizar expressamente o desconto. Sem autorização: não pode ser descontada.'),
(2025,'Empregador',  'Percentual sobre capital social / folha', 0.08,  NULL, FALSE, 'Art. 580 CLT + Lei 13.467/2017', 'FACULTATIVA. Varia conforme atividade e filiação ao sindicato patronal.'),
(2025,'Autônomo',    'Percentual sobre rendimento anual', 0.08,  NULL, FALSE, 'Art. 582 CLT + Lei 13.467/2017', 'FACULTATIVA. Profissionais liberais e autônomos.');

-- ────────────────────────────────────────────────────────────
-- RLS — Leitura pública para autenticados
-- ────────────────────────────────────────────────────────────
ALTER TABLE ref_salario_minimo              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_irpf_faixas                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_irpf_deducoes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_inss_faixas                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_inss_tetos                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_fgts                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_inss_contribuicao_empresa   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_cbo                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_contribuicao_sindical       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ref_salmin_read"    ON ref_salario_minimo            FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_irpf_read"      ON ref_irpf_faixas               FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_irpfded_read"   ON ref_irpf_deducoes             FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_inss_read"      ON ref_inss_faixas               FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_insteto_read"   ON ref_inss_tetos                FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_fgts_read"      ON ref_fgts                      FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_inssemp_read"   ON ref_inss_contribuicao_empresa FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_cbo_read"       ON ref_cbo                       FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_sindicato_read" ON ref_contribuicao_sindical     FOR SELECT TO authenticated USING (true);
