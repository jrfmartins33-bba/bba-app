-- ============================================================
-- BBA APP — MIGRATION 202506290004
-- Simples Nacional — LC 123/2006 + Res. CGSN 140/2018
-- Vigente: 2025 (sublimites e faixas atualizados)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. ref_simples_nacional_parametros
-- Limites e parâmetros gerais do Simples Nacional
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_simples_nacional_parametros (
  id                    SERIAL PRIMARY KEY,
  ano                   SMALLINT       NOT NULL UNIQUE,
  limite_mei            NUMERIC(14,2)  NOT NULL,  -- Receita bruta anual MEI
  limite_me             NUMERIC(14,2)  NOT NULL,  -- Receita bruta anual ME
  limite_epp            NUMERIC(14,2)  NOT NULL,  -- Receita bruta anual EPP
  limite_sublimite_icms NUMERIC(14,2),            -- Sublimite ICMS/ISS estadual
  fator_r_minimo        NUMERIC(5,2)   DEFAULT 28.00, -- % mínimo para aplicar fator r
  base_legal            VARCHAR(100),
  observacao            TEXT,
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_simples_nacional_parametros IS 'Parâmetros e limites do Simples Nacional — LC 123/2006. Vigente 2025.';

INSERT INTO ref_simples_nacional_parametros (ano, limite_mei, limite_me, limite_epp, limite_sublimite_icms, base_legal, observacao) VALUES
(2025, 81000.00, 360000.00, 4800000.00, 3600000.00, 'LC 123/2006 + LC 155/2016 + LC 199/2023', 'MEI: R$ 81.000/ano (LC 199/2023 — vigente jan/2023). ME: até R$ 360.000/ano. EPP: até R$ 4.800.000/ano. Sublimite ICMS/ISS para estados com PIB < 1% do nacional: R$ 1.800.000.'),
(2024, 81000.00, 360000.00, 4800000.00, 3600000.00, 'LC 123/2006 + LC 155/2016 + LC 199/2023', 'Mesmos limites de 2025'),
(2023, 81000.00, 360000.00, 4800000.00, 3600000.00, 'LC 199/2023', 'LC 199/2023 elevou o limite do MEI de R$ 81.000 para R$ 81.000 (já era 81k). Para MEI Caminhoneiro: R$ 251.600/ano.')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 2. ref_simples_nacional_anexos
-- Descrição dos Anexos I a V
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_simples_nacional_anexos (
  id            SERIAL PRIMARY KEY,
  anexo         VARCHAR(5)    NOT NULL UNIQUE,  -- I, II, III, IV, V
  nome          VARCHAR(100)  NOT NULL,
  atividades    TEXT          NOT NULL,
  tem_fator_r   BOOLEAN       NOT NULL DEFAULT FALSE,
  observacao    TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_simples_nacional_anexos IS 'Anexos do Simples Nacional I a V — Res. CGSN 140/2018';

INSERT INTO ref_simples_nacional_anexos (anexo, nome, atividades, tem_fator_r, observacao) VALUES
('I',   'Comércio',
 'Comércio varejista em geral. Lojas, mercados, farmácias, papelarias, pet shops, livrarias, roupas, calçados, cosméticos, eletrônicos, autopeças, materiais de construção, joalherias, óticas.',
 FALSE,
 'Alíquotas de 4,00% a 19,00%. ICMS incluso para comércio de mercadorias.'),

('II',  'Indústria',
 'Indústria em geral (fábricas, manufatura, confecções, alimentos industrializados, gráficas, móveis, artefatos de madeira/metal/plástico). Inclui ICMS e IPI.',
 FALSE,
 'Alíquotas de 4,50% a 30,00%. Mais oneroso por incluir IPI.'),

('III', 'Serviços Gerais e Locação de Bens Móveis',
 'Instalação, reparos e manutenção. Agências de viagem. Academias. Laboratórios. Medicina veterinária. Serviços de TI (desenvolvimento de software, consultoria em TI) que possam migrar para Anexo V conforme fator r. Tradução. Organização de festas. Salões de beleza. Barbearias. Lavanderias. Bufê. Outros serviços não listados nos demais anexos.',
 TRUE,
 'Alíquotas de 6,00% a 33,00%. ATENÇÃO: fator r determina se TI vai para Anexo III (≥28%) ou Anexo V (<28%).'),

('IV',  'Serviços com ISS e sem CPP (contribuição previdenciária própria)',
 'Limpeza, vigilância, obras, construção civil, serviços advocatícios, odontologia (quando a CPP é paga separadamente via GPS/DARF fora do DAS). Manutenção e reparação de veículos. Transporte municipal.',
 FALSE,
 'Alíquotas de 4,50% a 33,00%. O Simples NÃO inclui CPP (previdência patronal) — deve ser recolhida separadamente ao INSS sobre o pró-labore.'),

('V',   'Serviços Intelectuais e de Alta Complexidade',
 'Auditoria, jornalismo, tecnologia (quando fator r < 28%), publicidade, engenharia, medicina, arquitetura, fisioterapia, psicologia, biologia, química, geologia, profissões regulamentadas de nível superior em geral. Design. Consultoria em gestão.',
 TRUE,
 'Alíquotas de 15,50% a 30,50%. Fator r: se folha de salários / receita bruta nos últimos 12 meses for ≥ 28%, tributa pelo Anexo III. Se < 28%, tributa pelo Anexo V.')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 3. ref_simples_nacional_faixas
-- Faixas de RBT12 e alíquotas por anexo
-- Fonte: Res. CGSN 140/2018 — tabelas vigentes 2025
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_simples_nacional_faixas (
  id                  SERIAL PRIMARY KEY,
  ano                 SMALLINT       NOT NULL DEFAULT 2025,
  anexo               VARCHAR(5)     NOT NULL REFERENCES ref_simples_nacional_anexos(anexo),
  faixa               SMALLINT       NOT NULL,
  rbt12_de            NUMERIC(14,2)  NOT NULL,   -- receita bruta 12 meses - início
  rbt12_ate           NUMERIC(14,2),              -- NULL = última faixa
  aliquota_nominal    NUMERIC(6,4)   NOT NULL,   -- em decimal (ex: 0.04 = 4%)
  parcela_deduzir     NUMERIC(12,2)  NOT NULL,   -- em R$
  observacao          TEXT,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  UNIQUE (ano, anexo, faixa)
);

COMMENT ON TABLE ref_simples_nacional_faixas IS 'Faixas do Simples Nacional por Anexo — Res. CGSN 140/2018. Fórmula alíquota efetiva: (RBT12 × Aliq. Nominal − Parcela Deduzir) / RBT12.';

-- ── ANEXO I — COMÉRCIO ──
INSERT INTO ref_simples_nacional_faixas (ano, anexo, faixa, rbt12_de, rbt12_ate, aliquota_nominal, parcela_deduzir, observacao) VALUES
(2025,'I',1,        0.00,   180000.00, 0.0400,      0.00, '4,00% — alíquota efetiva = nominal na 1ª faixa'),
(2025,'I',2,   180000.01,   360000.00, 0.0738,   5940.00, '7,38% nominal / efetiva ~4,00% a 6,00%'),
(2025,'I',3,   360000.01,   720000.00, 0.0982,  13860.00, '9,82% nominal'),
(2025,'I',4,   720000.01,  1800000.00, 0.1082,  22500.00, '10,82% nominal'),
(2025,'I',5,  1800000.01,  3600000.00, 0.1450,  87300.00, '14,50% nominal'),
(2025,'I',6,  3600000.01,  4800000.00, 0.1900, 378000.00, '19,00% nominal — faixa máxima EPP')
ON CONFLICT DO NOTHING;

-- ── ANEXO II — INDÚSTRIA ──
INSERT INTO ref_simples_nacional_faixas (ano, anexo, faixa, rbt12_de, rbt12_ate, aliquota_nominal, parcela_deduzir, observacao) VALUES
(2025,'II',1,       0.00,   180000.00, 0.0450,      0.00, '4,50%'),
(2025,'II',2,  180000.01,   360000.00, 0.0778,   5940.00, '7,78% nominal'),
(2025,'II',3,  360000.01,   720000.00, 0.1026,  13860.00, '10,26% nominal'),
(2025,'II',4,  720000.01,  1800000.00, 0.1126,  22500.00, '11,26% nominal'),
(2025,'II',5, 1800000.01,  3600000.00, 0.1500,  87300.00, '15,00% nominal'),
(2025,'II',6, 3600000.01,  4800000.00, 0.3000, 378000.00, '30,00% nominal')
ON CONFLICT DO NOTHING;

-- ── ANEXO III — SERVIÇOS GERAIS ──
INSERT INTO ref_simples_nacional_faixas (ano, anexo, faixa, rbt12_de, rbt12_ate, aliquota_nominal, parcela_deduzir, observacao) VALUES
(2025,'III',1,      0.00,   180000.00, 0.0600,      0.00, '6,00%'),
(2025,'III',2, 180000.01,   360000.00, 0.1122,   9360.00, '11,22% nominal'),
(2025,'III',3, 360000.01,   720000.00, 0.1350,  17640.00, '13,50% nominal'),
(2025,'III',4, 720000.01,  1800000.00, 0.1600,  35640.00, '16,00% nominal'),
(2025,'III',5,1800000.01,  3600000.00, 0.2100, 125640.00, '21,00% nominal'),
(2025,'III',6,3600000.01,  4800000.00, 0.3300, 648000.00, '33,00% nominal')
ON CONFLICT DO NOTHING;

-- ── ANEXO IV — SERVIÇOS SEM CPP ──
INSERT INTO ref_simples_nacional_faixas (ano, anexo, faixa, rbt12_de, rbt12_ate, aliquota_nominal, parcela_deduzir, observacao) VALUES
(2025,'IV',1,       0.00,   180000.00, 0.0450,      0.00, '4,50%'),
(2025,'IV',2,  180000.01,   360000.00, 0.0900,   8100.00, '9,00% nominal'),
(2025,'IV',3,  360000.01,   720000.00, 0.1020,  12420.00, '10,20% nominal'),
(2025,'IV',4,  720000.01,  1800000.00, 0.1440,  39780.00, '14,40% nominal'),
(2025,'IV',5, 1800000.01,  3600000.00, 0.2200, 183780.00, '22,00% nominal'),
(2025,'IV',6, 3600000.01,  4800000.00, 0.3300, 828000.00, '33,00% nominal')
ON CONFLICT DO NOTHING;

-- ── ANEXO V — SERVIÇOS INTELECTUAIS ──
INSERT INTO ref_simples_nacional_faixas (ano, anexo, faixa, rbt12_de, rbt12_ate, aliquota_nominal, parcela_deduzir, observacao) VALUES
(2025,'V',1,        0.00,   180000.00, 0.1550,      0.00, '15,50%'),
(2025,'V',2,   180000.01,   360000.00, 0.1800,   4500.00, '18,00% nominal'),
(2025,'V',3,   360000.01,   720000.00, 0.1950,   9900.00, '19,50% nominal'),
(2025,'V',4,   720000.01,  1800000.00, 0.2050,  17100.00, '20,50% nominal'),
(2025,'V',5,  1800000.01,  3600000.00, 0.2300,  62100.00, '23,00% nominal'),
(2025,'V',6,  3600000.01,  4800000.00, 0.3050, 540000.00, '30,50% nominal')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 4. ref_simples_nacional_partilha
-- Partilha dos tributos no DAS por anexo e faixa
-- Fonte: Res. CGSN 140/2018 — Anexo VI (percentuais de distribuição)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_simples_nacional_partilha (
  id          SERIAL PRIMARY KEY,
  anexo       VARCHAR(5)   NOT NULL,
  faixa       SMALLINT     NOT NULL,
  irpj        NUMERIC(6,4) NOT NULL DEFAULT 0,
  csll        NUMERIC(6,4) NOT NULL DEFAULT 0,
  cofins      NUMERIC(6,4) NOT NULL DEFAULT 0,
  pis         NUMERIC(6,4) NOT NULL DEFAULT 0,
  cpp         NUMERIC(6,4) NOT NULL DEFAULT 0,  -- Contribuição Previdenciária Patronal
  icms        NUMERIC(6,4) NOT NULL DEFAULT 0,
  iss         NUMERIC(6,4) NOT NULL DEFAULT 0,
  ipi         NUMERIC(6,4) NOT NULL DEFAULT 0,
  observacao  TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (anexo, faixa)
);

COMMENT ON TABLE ref_simples_nacional_partilha IS 'Distribuição dos tributos no DAS por Anexo e Faixa — Res. CGSN 140/2018 Anexo VI. Percentuais sobre a alíquota efetiva total.';

-- ANEXO I — Comércio (distribuição % dos tributos)
INSERT INTO ref_simples_nacional_partilha (anexo, faixa, irpj, csll, cofins, pis, cpp, icms) VALUES
('I',1, 0.0500, 0.0350, 0.1220, 0.0265, 0.4150, 0.3400),
('I',2, 0.0500, 0.0350, 0.1220, 0.0265, 0.4150, 0.3400),
('I',3, 0.0500, 0.0350, 0.1220, 0.0265, 0.4200, 0.3320),  -- ajuste faixa 3
('I',4, 0.0500, 0.0350, 0.1220, 0.0265, 0.4200, 0.3200),
('I',5, 0.0500, 0.0350, 0.1220, 0.0265, 0.4200, 0.3200),
('I',6, 0.1300, 0.1000, 0.2280, 0.1260, 0.4200, 0.0000)
ON CONFLICT DO NOTHING;  -- faixa 6: sem ICMS (substituto trib)

-- ANEXO II — Indústria
INSERT INTO ref_simples_nacional_partilha (anexo, faixa, irpj, csll, cofins, pis, cpp, icms, ipi) VALUES
('II',1, 0.0500, 0.0350, 0.1220, 0.0265, 0.4150, 0.3400, 0.0500),
('II',2, 0.0500, 0.0350, 0.1220, 0.0265, 0.4150, 0.3400, 0.0500),
('II',3, 0.0500, 0.0350, 0.1220, 0.0265, 0.4200, 0.3200, 0.0500),
('II',4, 0.0500, 0.0350, 0.1220, 0.0265, 0.4200, 0.3200, 0.0500),
('II',5, 0.0500, 0.0350, 0.1220, 0.0265, 0.4200, 0.3200, 0.0500),
('II',6, 0.1300, 0.1000, 0.2280, 0.1260, 0.4200, 0.0000, 0.0500)
ON CONFLICT DO NOTHING;

-- ANEXO III — Serviços Gerais
INSERT INTO ref_simples_nacional_partilha (anexo, faixa, irpj, csll, cofins, pis, cpp, iss) VALUES
('III',1, 0.0400, 0.0350, 0.1270, 0.0275, 0.4300, 0.3300),
('III',2, 0.0400, 0.0350, 0.1270, 0.0275, 0.4300, 0.3300),
('III',3, 0.0400, 0.0350, 0.1270, 0.0275, 0.4300, 0.3250),
('III',4, 0.0400, 0.0350, 0.1270, 0.0275, 0.4300, 0.3100),
('III',5, 0.0400, 0.0350, 0.1270, 0.0275, 0.4300, 0.3000),
('III',6, 0.3500, 0.1500, 0.1600, 0.0800, 0.2000, 0.0100)
ON CONFLICT DO NOTHING;

-- ANEXO IV — Serviços sem CPP (CPP não está no DAS)
INSERT INTO ref_simples_nacional_partilha (anexo, faixa, irpj, csll, cofins, pis, iss) VALUES
('IV',1, 0.1800, 0.1950, 0.2300, 0.0600, 0.3400),
('IV',2, 0.1800, 0.1950, 0.2300, 0.0600, 0.3400),
('IV',3, 0.1800, 0.1950, 0.2300, 0.0600, 0.3200),
('IV',4, 0.1800, 0.1950, 0.2300, 0.0600, 0.3000),
('IV',5, 0.1800, 0.1950, 0.2300, 0.0600, 0.3000),
('IV',6, 0.3300, 0.3200, 0.2200, 0.1600, 0.0000)
ON CONFLICT DO NOTHING;

-- ANEXO V — Serviços Intelectuais
INSERT INTO ref_simples_nacional_partilha (anexo, faixa, irpj, csll, cofins, pis, cpp, iss) VALUES
('V',1, 0.1500, 0.1500, 0.1680, 0.0720, 0.2850, 0.2250),
('V',2, 0.1500, 0.1500, 0.1680, 0.0720, 0.2850, 0.2250),
('V',3, 0.1600, 0.1500, 0.1700, 0.0800, 0.2800, 0.2100),
('V',4, 0.1600, 0.1500, 0.1700, 0.0800, 0.2800, 0.2100),
('V',5, 0.2100, 0.1500, 0.1600, 0.0800, 0.2000, 0.1000),
('V',6, 0.3500, 0.1500, 0.1600, 0.0800, 0.2000, 0.0600)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 5. ref_mei_das
-- Valores fixos do DAS-MEI por categoria — 2025
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_mei_das (
  id                SERIAL PRIMARY KEY,
  ano               SMALLINT       NOT NULL,
  categoria         VARCHAR(60)    NOT NULL,
  valor_inss        NUMERIC(8,2)   NOT NULL,  -- 5% sobre salário mínimo
  valor_icms        NUMERIC(6,2)   NOT NULL DEFAULT 0,
  valor_iss         NUMERIC(6,2)   NOT NULL DEFAULT 0,
  valor_total       NUMERIC(8,2)   NOT NULL,
  atividades        TEXT,
  base_legal        VARCHAR(100),
  observacao        TEXT,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_mei_das IS 'DAS-MEI fixo mensal — LC 123/2006 + LC 199/2023. Vigente 2025. Base: Salário Mínimo R$ 1.518,00.';

INSERT INTO ref_mei_das (ano, categoria, valor_inss, valor_icms, valor_iss, valor_total, atividades, base_legal, observacao) VALUES
(2025,'MEI Comércio e/ou Indústria',         75.90, 1.00, 0.00,  76.90, 'Comércio varejista, produção artesanal, pequena indústria. CNAE com ICMS.', 'LC 123/2006 art. 18-A', 'INSS: 5% × R$ 1.518,00 = R$ 75,90 + ICMS R$ 1,00'),
(2025,'MEI Serviços (ISS)',                  75.90, 0.00, 5.00,  80.90, 'Serviços em geral: beleza, manutenção, TI, alimentação, transporte. CNAE com ISS.', 'LC 123/2006 art. 18-A', 'INSS: R$ 75,90 + ISS R$ 5,00'),
(2025,'MEI Comércio + Serviços',             75.90, 1.00, 5.00,  81.90, 'Atividades mistas com ICMS e ISS simultaneamente.', 'LC 123/2006 art. 18-A', 'INSS: R$ 75,90 + ICMS R$ 1,00 + ISS R$ 5,00'),
(2025,'MEI Caminhoneiro (Transportador)',     75.90, 0.00, 5.00,  80.90, 'Transporte rodoviário de cargas. Limite anual especial: R$ 251.600,00 (LC 188/2021).', 'LC 188/2021', 'Limite de receita bruta anual: R$ 251.600,00 (não R$ 81.000,00)'),
(2024,'MEI Comércio e/ou Indústria',         70.60, 1.00, 0.00,  71.60, NULL, 'LC 123/2006', 'Base 2024: 5% × R$ 1.412,00 = R$ 70,60'),
(2024,'MEI Serviços (ISS)',                  70.60, 0.00, 5.00,  75.60, NULL, 'LC 123/2006', NULL),
(2024,'MEI Comércio + Serviços',             70.60, 1.00, 5.00,  76.60, NULL, 'LC 123/2006', NULL),
(2023,'MEI Comércio e/ou Indústria',         66.00, 1.00, 0.00,  67.00, NULL, 'LC 123/2006', 'Base mai/2023: 5% × R$ 1.320,00 = R$ 66,00'),
(2023,'MEI Serviços (ISS)',                  66.00, 0.00, 5.00,  71.00, NULL, 'LC 123/2006', NULL)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 6. ref_simples_nacional_atividades_vedadas
-- Atividades impedidas de optar pelo Simples Nacional
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_simples_nacional_vedacoes (
  id          SERIAL PRIMARY KEY,
  descricao   VARCHAR(300) NOT NULL,
  base_legal  VARCHAR(100),
  observacao  TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_simples_nacional_vedacoes IS 'Atividades vedadas ao Simples Nacional — Art. 17 LC 123/2006';

INSERT INTO ref_simples_nacional_vedacoes (descricao, base_legal, observacao) VALUES
('Receita bruta acumulada superior a R$ 4.800.000/ano','Art. 3 LC 123/2006', NULL),
('Sócio com participação em outra empresa Simples Nacional onde a soma da RBT12 supere o limite','Art. 17 §2 LC 123/2006', NULL),
('Empresa com sócio domiciliado no exterior','Art. 3 §4 LC 123/2006', NULL),
('Empresa cujo capital participe outra pessoa jurídica','Art. 3 §4 LC 123/2006', NULL),
('Banco comercial, de investimento ou de desenvolvimento','Art. 17 LC 123/2006', NULL),
('Cooperativa, exceto de consumo','Art. 17 LC 123/2006', NULL),
('Sociedade Anônima','Art. 3 §4 LC 123/2006', NULL),
('Atividade de factoring','Art. 17 LC 123/2006', NULL),
('Prestação de serviços de comunicação','Art. 17 LC 123/2006', NULL),
('Geração, transmissão, distribuição ou comercialização de energia elétrica','Art. 17 LC 123/2006', NULL),
('Importação ou fabricação de automóveis e motocicletas','Art. 17 LC 123/2006', NULL),
('Importação de combustíveis','Art. 17 LC 123/2006', NULL),
('Produção ou venda no atacado de cigarros, armas de fogo, munições, fogos artificiais','Art. 17 LC 123/2006', NULL),
('Atividade de cessão ou locação de mão-de-obra (com exceções)','Art. 17 LC 123/2006', 'Exceção: serviços de vigilância, limpeza, conservação e construção civil.'),
('Empresa com débito com INSS ou com Fazenda Pública Federal, Estadual ou Municipal','Art. 17 LC 123/2006', 'Irregularidade fiscal impede a opção ou causa exclusão.'),
('Empresa constituída sob a forma de empresa pública','Art. 3 §4 LC 123/2006', NULL)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────
ALTER TABLE ref_simples_nacional_parametros  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_simples_nacional_anexos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_simples_nacional_faixas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_simples_nacional_partilha    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_mei_das                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_simples_nacional_vedacoes    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ref_snparam_read"   ON ref_simples_nacional_parametros FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_snanexos_read"  ON ref_simples_nacional_anexos     FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_snfaixas_read"  ON ref_simples_nacional_faixas     FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_snpartilha_read"ON ref_simples_nacional_partilha   FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_meidas_read"    ON ref_mei_das                     FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_snvedacao_read" ON ref_simples_nacional_vedacoes   FOR SELECT TO authenticated USING (true);
