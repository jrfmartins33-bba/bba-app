-- ============================================================
-- BBA APP — MIGRATION 202506290005
-- Tributos sobre renda (LP/LR), ISS, ICMS interestaduais,
-- Indicadores econômicos, Retenções na fonte
-- Fontes: Receita Federal, CONFAZ, CGSN, BACEN
-- Atualizado: Junho 2025
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. ref_lucro_presumido_percentuais
-- Percentuais de presunção do Lucro Presumido
-- Fonte: Art. 15 e 20 Lei 9.249/1995 + RIR Decreto 9.580/2018
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_lucro_presumido_percentuais (
  id              SERIAL PRIMARY KEY,
  atividade       VARCHAR(200)  NOT NULL,
  percentual_irpj NUMERIC(5,2)  NOT NULL,  -- presunção base IRPJ
  percentual_csll NUMERIC(5,2)  NOT NULL,  -- presunção base CSLL
  base_legal      VARCHAR(100),
  observacao      TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_lucro_presumido_percentuais IS 'Percentuais de presunção do Lucro Presumido — Art. 15 Lei 9.249/1995 e RIR Decreto 9.580/2018. Vigente 2025.';

INSERT INTO ref_lucro_presumido_percentuais (atividade, percentual_irpj, percentual_csll, base_legal, observacao) VALUES
('Revenda de combustíveis para consumo', 1.60, 12.00, 'Art. 15 I Lei 9.249/1995', 'Apenas para distribuidoras e postos de combustíveis.'),
('Comércio em geral (venda de mercadorias)', 8.00, 12.00, 'Art. 15 Lei 9.249/1995', 'Base IRPJ: 8% da receita bruta. Base CSLL: 12%.'),
('Transporte de cargas', 8.00, 12.00, 'Art. 15 §1 Lei 9.249/1995', NULL),
('Serviços hospitalares, laboratoriais e similares (com ANVISA)', 8.00, 12.00, 'Art. 15 §1 VI Lei 9.249/1995', 'Serviços hospitalares e atendimento ambulatorial com alvará sanitário.'),
('Atividades imobiliárias (loteamento, incorporação, compra e venda)', 8.00, 12.00, 'Art. 15 §4 Lei 9.249/1995', NULL),
('Indústria em geral', 8.00, 12.00, 'Art. 15 Lei 9.249/1995', 'Fabricação de bens em geral.'),
('Transporte de passageiros', 16.00, 12.00, 'Art. 15 §1 II Lei 9.249/1995', 'Ônibus, táxi, transporte urbano.'),
('Serviços em geral não especificados', 32.00, 32.00, 'Art. 15 §1 III Lei 9.249/1995', 'Regra geral para serviços. Inclui consultorias, assessorias, TI, etc.'),
('Serviços de profissões regulamentadas', 32.00, 32.00, 'Art. 15 §1 III d Lei 9.249/1995', 'Médicos, advogados, engenheiros, contadores, psicólogos etc. — prestados por PJ.'),
('Administração, locação e cessão de bens e direitos (excl. imóveis)', 32.00, 32.00, 'Art. 15 §1 IV Lei 9.249/1995', NULL),
('Intermediação de negócios', 32.00, 32.00, 'Art. 15 §1 III Lei 9.249/1995', 'Agentes, representantes, corretores.'),
('Construção por empreitada com material', 8.00, 12.00, 'Art. 15 §1 VI Lei 9.249/1995', 'Quando a construtora fornece o material.'),
('Construção por empreitada de mão de obra (sem material)', 32.00, 32.00, 'Art. 15 §1 III Lei 9.249/1995', 'Apenas mão de obra — sem material.'),
('Factoring', 32.00, 32.00, 'Art. 15 §1 III Lei 9.249/1995', NULL),
('Agências de publicidade e propaganda', 32.00, 32.00, 'Art. 15 §1 III Lei 9.249/1995', NULL),
('Bancos e financeiras (Lucro Real obrigatório)', 0.00, 0.00, 'Art. 14 Lei 9.718/1998', 'Instituições financeiras são obrigadas ao Lucro Real.');

-- ────────────────────────────────────────────────────────────
-- 2. ref_aliquotas_irpj_csll
-- Alíquotas IRPJ e CSLL — Lucro Presumido e Real
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_aliquotas_irpj_csll (
  id              SERIAL PRIMARY KEY,
  ano             SMALLINT      NOT NULL,
  tributo         VARCHAR(10)   NOT NULL CHECK (tributo IN ('IRPJ','CSLL')),
  regime          VARCHAR(20)   NOT NULL CHECK (regime IN ('Lucro Presumido','Lucro Real','Ambos')),
  faixa           SMALLINT      NOT NULL DEFAULT 1,
  base_de         NUMERIC(14,2) NOT NULL DEFAULT 0,
  base_ate        NUMERIC(14,2),              -- NULL = sem limite
  periodicidade   VARCHAR(10)   NOT NULL CHECK (periodicidade IN ('Mensal','Trimestral','Anual')),
  aliquota        NUMERIC(5,2)  NOT NULL,
  adicional       NUMERIC(5,2)  DEFAULT 0,    -- adicional de IRPJ acima de R$ 20k/mês
  base_legal      VARCHAR(100),
  observacao      TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_aliquotas_irpj_csll IS 'Alíquotas IRPJ e CSLL — Receita Federal. Vigente 2025.';

INSERT INTO ref_aliquotas_irpj_csll (ano, tributo, regime, faixa, base_de, base_ate, periodicidade, aliquota, adicional, base_legal, observacao) VALUES
-- IRPJ — regra geral
(2025,'IRPJ','Ambos',       1,      0.00, 20000.00,'Mensal',    15.00, 0.00, 'Art. 3 Lei 9.249/1995', 'Alíquota normal: 15% sobre lucro (LP ou LR)'),
(2025,'IRPJ','Ambos',       2,  20000.01,     NULL,'Mensal',    15.00,10.00, 'Art. 3 §1 Lei 9.249/1995', 'Adicional IRPJ: 10% sobre o que exceder R$ 20.000/mês ou R$ 60.000/trimestre'),
-- CSLL
(2025,'CSLL','Lucro Presumido',1, 0.00, NULL,'Trimestral',  9.00, 0.00, 'Art. 22 Lei 8.212/1991 + Lei 7.689/1988', 'CSLL: 9% sobre base de cálculo presumida ou real. Instituições financeiras: 20%.'),
(2025,'CSLL','Lucro Real',  1,      0.00,     NULL,'Mensal',     9.00, 0.00, 'Lei 7.689/1988', 'CSLL normal: 9%. Financeiras/seguradoras: 20%.'),
-- PIS e COFINS — Lucro Presumido (cumulativo)
(2025,'IRPJ','Lucro Presumido',1, 0.00, NULL,'Trimestral', 15.00, 0.00, 'Lei 9.249/1995', 'LP: alíquota 15% sobre base presumida. Adicional 10% acima de R$ 60k/trimestre');

-- ────────────────────────────────────────────────────────────
-- 3. ref_pis_cofins
-- Alíquotas PIS e COFINS — cumulativo e não-cumulativo
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_pis_cofins (
  id              SERIAL PRIMARY KEY,
  ano             SMALLINT      NOT NULL,
  regime          VARCHAR(30)   NOT NULL CHECK (regime IN ('Cumulativo','Não-Cumulativo')),
  tributo         VARCHAR(10)   NOT NULL CHECK (tributo IN ('PIS','COFINS')),
  aliquota_geral  NUMERIC(5,3)  NOT NULL,
  aliquota_mono   NUMERIC(5,3),              -- monofásico (quando aplicável)
  base_legal      VARCHAR(100),
  observacao      TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_pis_cofins IS 'Alíquotas PIS/COFINS — Leis 10.637/2002 e 10.833/2003. Vigente 2025.';

INSERT INTO ref_pis_cofins (ano, regime, tributo, aliquota_geral, aliquota_mono, base_legal, observacao) VALUES
(2025,'Cumulativo',    'PIS',    0.650, NULL, 'Lei 9.715/1998 + Dec. 4.524/2002', 'Lucro Presumido: PIS 0,65% sobre receita bruta. Não permite créditos.'),
(2025,'Cumulativo',    'COFINS', 3.000, NULL, 'Lei 9.718/1998',                   'Lucro Presumido: COFINS 3,00% sobre receita bruta. Não permite créditos.'),
(2025,'Não-Cumulativo','PIS',    1.650, NULL, 'Lei 10.637/2002',                  'Lucro Real: PIS 1,65% sobre receita. Permite créditos sobre insumos, ativos, etc.'),
(2025,'Não-Cumulativo','COFINS', 7.600, NULL, 'Lei 10.833/2003',                  'Lucro Real: COFINS 7,60% sobre receita. Permite créditos.');

-- ────────────────────────────────────────────────────────────
-- 4. ref_iss_aliquotas
-- ISS — Lei Complementar 116/2003 (lista de serviços)
-- Faixas mínimas e máximas; municípios definem dentro dos limites
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_iss_aliquotas (
  id                SERIAL PRIMARY KEY,
  item_lista        VARCHAR(10)   NOT NULL,   -- ex: 1.01, 10.02
  descricao_servico VARCHAR(300)  NOT NULL,
  aliquota_minima   NUMERIC(5,2)  NOT NULL DEFAULT 2.00,
  aliquota_maxima   NUMERIC(5,2)  NOT NULL DEFAULT 5.00,
  isencao_exportacao BOOLEAN      NOT NULL DEFAULT TRUE,
  retencao_fonte    BOOLEAN       NOT NULL DEFAULT FALSE,
  base_legal        VARCHAR(100),
  observacao        TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_iss_aliquotas IS 'Lista de serviços LC 116/2003 + LC 157/2016. Alíquota mínima: 2% (EC 37/2002). Alíquota máxima: 5% (LC 116/2003 art. 8). Municípios definem dentro desses limites.';

INSERT INTO ref_iss_aliquotas (item_lista, descricao_servico, aliquota_minima, aliquota_maxima, retencao_fonte, base_legal, observacao) VALUES
('1.01','Análise e desenvolvimento de sistemas',2.00,5.00,FALSE,'LC 116/2003','TI — pode ser Anexo III ou V Simples Nacional'),
('1.02','Programação',2.00,5.00,FALSE,'LC 116/2003','Desenvolvimento de software'),
('1.03','Processamento, armazenamento ou hospedagem de dados, textos, imagens, vídeos, páginas eletrônicas, aplicativos e sistemas de informação',2.00,5.00,FALSE,'LC 116/2003 + LC 157/2016',NULL),
('1.04','Elaboração de programas de computadores, inclusive de jogos eletrônicos',2.00,5.00,FALSE,'LC 116/2003',NULL),
('1.05','Licenciamento ou cessão de direito de uso de programas de computação',2.00,5.00,FALSE,'LC 116/2003',NULL),
('1.06','Assessoria e consultoria em informática',2.00,5.00,FALSE,'LC 116/2003',NULL),
('1.07','Suporte técnico em informática',2.00,5.00,FALSE,'LC 116/2003',NULL),
('1.08','Planejamento, confecção, manutenção e atualização de páginas eletrônicas',2.00,5.00,FALSE,'LC 116/2003',NULL),
('2.01','Serviços de pesquisas e desenvolvimento de qualquer natureza',2.00,5.00,FALSE,'LC 116/2003',NULL),
('4.01','Medicina e biomedicina',2.00,5.00,FALSE,'LC 116/2003','Retenção na fonte pode ser exigida pelo município'),
('4.02','Análises clínicas, patologia, eletricidade médica, radioterapia, quimioterapia, ultra-sonografia, ressonância magnética, radiologia, tomografia e congêneres',2.00,5.00,FALSE,'LC 116/2003',NULL),
('4.03','Hospitais, clínicas, laboratórios, sanatórios, manicômios, casas de saúde, prontos-socorros, ambulatórios e congêneres',2.00,5.00,FALSE,'LC 116/2003',NULL),
('4.06','Enfermagem, inclusive serviços auxiliares',2.00,5.00,FALSE,'LC 116/2003',NULL),
('4.07','Serviços farmacêuticos',2.00,5.00,FALSE,'LC 116/2003',NULL),
('4.08','Serviço de nutrição',2.00,5.00,FALSE,'LC 116/2003',NULL),
('4.11','Obstetrícia',2.00,5.00,FALSE,'LC 116/2003',NULL),
('4.12','Odontologia',2.00,5.00,FALSE,'LC 116/2003',NULL),
('4.13','Ortóptica',2.00,5.00,FALSE,'LC 116/2003',NULL),
('4.14','Próteses sob encomenda',2.00,5.00,FALSE,'LC 116/2003',NULL),
('4.15','Psicanálise',2.00,5.00,FALSE,'LC 116/2003',NULL),
('4.16','Psicologia',2.00,5.00,FALSE,'LC 116/2003',NULL),
('4.17','Casas de repouso e de recuperação, creches, asilos e congêneres',2.00,5.00,FALSE,'LC 116/2003',NULL),
('5.01','Medicina veterinária e zootecnia',2.00,5.00,FALSE,'LC 116/2003',NULL),
('6.01','Barbearia, cabeleireiros, manicuros, pedicuros e congêneres',2.00,5.00,FALSE,'LC 116/2003',NULL),
('6.02','Esteticistas, tratamento de pele, depilação e congêneres',2.00,5.00,FALSE,'LC 116/2003',NULL),
('6.04','Ginástica, dança, esportes, natação, artes marciais e demais atividades físicas',2.00,5.00,FALSE,'LC 116/2003','Academias de ginástica'),
('6.05','Centros de emagrecimento, spa e congêneres',2.00,5.00,FALSE,'LC 116/2003',NULL),
('7.02','Execução, por administração, empreitada ou subempreitada, de obras de construção civil, hidráulica ou elétrica e de outras obras semelhantes',2.00,5.00,FALSE,'LC 116/2003','ATENÇÃO: ISS no local da obra, não sede da empresa'),
('7.04','Demolição',2.00,5.00,FALSE,'LC 116/2003',NULL),
('7.05','Reparação, conservação e reforma de edifícios, estradas, pontes, portos e congêneres',2.00,5.00,FALSE,'LC 116/2003',NULL),
('7.09','Varrição, coleta, remoção, incineração, tratamento, reciclagem, separação e destinação final de lixo, rejeitos e outros resíduos quaisquer',2.00,5.00,FALSE,'LC 116/2003',NULL),
('7.10','Limpeza, manutenção e conservação de vias e logradouros públicos, imóveis, chaminés, piscinas, parques, jardins e congêneres',2.00,5.00,FALSE,'LC 116/2003',NULL),
('8.01','Ensino regular pré-escolar, fundamental, médio e superior',2.00,5.00,FALSE,'LC 116/2003',NULL),
('8.02','Instrução, treinamento, orientação pedagógica e educacional, avaliação de conhecimentos de qualquer natureza',2.00,5.00,FALSE,'LC 116/2003','Cursos livres, treinamentos corporativos'),
('10.01','Agenciamento, corretagem ou intermediação de câmbio, de seguros, de cartões de crédito, de planos de saúde e de planos de previdência privada',2.00,5.00,FALSE,'LC 116/2003',NULL),
('10.02','Agenciamento, corretagem ou intermediação de títulos em geral, valores mobiliários e contratos quaisquer',2.00,5.00,FALSE,'LC 116/2003',NULL),
('10.03','Agenciamento, corretagem ou intermediação de direitos de propriedade industrial, artística ou literária',2.00,5.00,FALSE,'LC 116/2003',NULL),
('10.04','Agenciamento, corretagem ou intermediação de contratos de arrendamento mercantil (leasing), de franquia (franchising) e de faturização (factoring)',2.00,5.00,FALSE,'LC 116/2003',NULL),
('10.05','Agenciamento, corretagem ou intermediação de bens móveis ou imóveis, não abrangidos em outros itens ou subitens, inclusive aqueles realizados no âmbito de Bolsas de Mercadorias e Futuros, por quaisquer meios',2.00,5.00,FALSE,'LC 116/2003',NULL),
('13.03','Fotografia e cinematografia',2.00,5.00,FALSE,'LC 116/2003',NULL),
('14.01','Lubrificação, limpeza, lustração, revisão, carga e recarga, conserto, restauração, blindagem, manutenção e conservação de máquinas, veículos, aparelhos, equipamentos, motores, elevadores ou de qualquer objeto',2.00,5.00,FALSE,'LC 116/2003','Oficinas mecânicas, eletricistas, manutenção geral'),
('14.02','Assistência técnica',2.00,5.00,FALSE,'LC 116/2003',NULL),
('14.05','Restauração, recondicionamento, acondicionamento, pintura, beneficiamento, lavagem, secagem, tingimento, galvanoplastia, anodização, corte, recorte, plastificação, costura, acabamento, polimento e congêneres de objetos quaisquer',2.00,5.00,FALSE,'LC 116/2003',NULL),
('16.01','Serviços de transporte de natureza municipal (táxi, escolar, mototáxi)',2.00,5.00,FALSE,'LC 116/2003',NULL),
('17.01','Assessoria ou consultoria de qualquer natureza',2.00,5.00,FALSE,'LC 116/2003','Consultoria empresarial, financeira, tributária, jurídica, etc.'),
('17.02','Análise, exame, pesquisa, coleta, compilação e fornecimento de dados e informações de qualquer natureza',2.00,5.00,FALSE,'LC 116/2003',NULL),
('17.03','Planejamento, coordenação, programação ou organização técnica, financeira ou administrativa',2.00,5.00,FALSE,'LC 116/2003',NULL),
('17.04','Recrutamento, agenciamento, seleção e colocação de mão-de-obra',2.00,5.00,FALSE,'LC 116/2003',NULL),
('17.06','Propaganda e publicidade, inclusive promoção de vendas, planejamento de campanhas ou sistemas de publicidade',2.00,5.00,FALSE,'LC 116/2003',NULL),
('17.09','Perícias, laudos, exames técnicos e análises técnicas',2.00,5.00,FALSE,'LC 116/2003',NULL),
('17.10','Planejamento, organização e administração de feiras, exposições, congressos e congêneres',2.00,5.00,FALSE,'LC 116/2003',NULL),
('17.11','Organização de festas e recepções; bufê',2.00,5.00,FALSE,'LC 116/2003',NULL),
('17.13','Distribuição e entrega de encomendas e documentos e remessa de valores',2.00,5.00,FALSE,'LC 116/2003',NULL),
('17.14','Cobrança e recebimento por conta de terceiros',2.00,5.00,FALSE,'LC 116/2003',NULL),
('17.16','Florestamento, reflorestamento, semeadura, adubação, reparação de solo, plantio, silagem, colheita, corte e descascamento de árvores, silvicultura, exploração florestal e dos serviços congêneres',2.00,5.00,FALSE,'LC 116/2003',NULL),
('17.17','Escoramento, contenção de encostas e serviços congêneres',2.00,5.00,FALSE,'LC 116/2003',NULL),
('17.18','Limpeza e dragagem de rios, portos, canais, baías, lagos, lagoas, represas, açudes e congêneres',2.00,5.00,FALSE,'LC 116/2003',NULL),
('17.19','Acompanhamento e fiscalização da execução de obras de engenharia, arquitetura e urbanismo',2.00,5.00,FALSE,'LC 116/2003',NULL),
('17.20','Aerofotogrametria (inclusive interpretação), cartografia, mapeamento, levantamentos topográficos, batimétricos, geodésicos, geológicos, geofísicos e congêneres',2.00,5.00,FALSE,'LC 116/2003',NULL),
('17.22','Datilografia, digitação, estenografia, expediente, secretaria em geral, resposta audível, redação, edição, interpretação, revisão, tradução, apoio e infra-estrutura administrativa e congêneres',2.00,5.00,FALSE,'LC 116/2003',NULL),
('17.23','Serviços de chaveiros, confecção de carimbos, placas, sinalização visual, banners, adesivos e congêneres',2.00,5.00,FALSE,'LC 116/2003',NULL),
('17.24','Serviços funerários',2.00,5.00,FALSE,'LC 116/2003',NULL),
('17.25','Gás encanado',2.00,5.00,FALSE,'LC 116/2003',NULL),
('21.01','Serviços de registros públicos, cartorários e notariais',2.00,5.00,FALSE,'LC 116/2003',NULL),
('22.01','Serviços de exploração de rodovias mediante cobrança de preço ou pedágio dos usuários, envolvendo execução de serviços de conservação, manutenção, melhoramentos para adequação de capacidade e segurança de trânsito',2.00,5.00,FALSE,'LC 116/2003',NULL),
('25.01','Serviços veterinários (assistência técnica)',2.00,5.00,FALSE,'LC 116/2003',NULL),
('26.01','Serviços de coleta e armazenagem de energia, inclusive por baterias, pilhas, usinas, barragens e congêneres, exceto energia elétrica',2.00,5.00,FALSE,'LC 116/2003',NULL),
('33.01','Serviços de acesso a redes de computadores, inclusive à rede mundial de computadores (internet)',2.00,5.00,FALSE,'LC 116/2003 + LC 157/2016',NULL),
('40.01','Obras de arte sob encomenda',2.00,5.00,FALSE,'LC 116/2003',NULL);

-- ────────────────────────────────────────────────────────────
-- 5. ref_icms_aliquotas_interestaduais
-- Alíquotas ICMS interestaduais — CONFAZ
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_icms_aliquotas_interestaduais (
  id              SERIAL PRIMARY KEY,
  uf_origem       CHAR(2)      NOT NULL,
  uf_destino      CHAR(2)      NOT NULL,
  aliquota        NUMERIC(5,2) NOT NULL,
  observacao      TEXT,
  base_legal      VARCHAR(100),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_icms_aliquotas_interestaduais IS 'Alíquotas ICMS interestaduais — Resolução Senado Federal 22/1989. Regra geral: 12% Sul/Sudeste → Norte/Nordeste/CO; 7% Norte/Nordeste/CO → Sul/Sudeste; 12% entre iguais. Exceção: 4% para importados (Res. SF 13/2012).';

-- Regra geral interestadual
-- Sul/Sudeste para Norte/Nordeste/Centro-Oeste: 12%
-- Norte/Nordeste/Centro-Oeste para Sul/Sudeste: 12%
-- Sul/Sudeste entre si: 12%
-- Norte/Nordeste/CO entre si: 12%
-- EXCEÇÃO: operações com produtos importados sem similar nacional: 4% (Res. SF 13/2012)

INSERT INTO ref_icms_aliquotas_interestaduais (uf_origem, uf_destino, aliquota, base_legal, observacao) VALUES
-- SP → todos (exceto ES que tem tratamento similar)
('SP','AC',12.00,'Res. SF 22/1989','SP → Norte'),
('SP','AL',12.00,'Res. SF 22/1989','SP → Nordeste'),
('SP','AM',12.00,'Res. SF 22/1989','SP → Norte'),
('SP','AP',12.00,'Res. SF 22/1989','SP → Norte'),
('SP','BA',12.00,'Res. SF 22/1989','SP → Nordeste'),
('SP','CE',12.00,'Res. SF 22/1989','SP → Nordeste'),
('SP','DF',12.00,'Res. SF 22/1989','SP → Centro-Oeste'),
('SP','ES',12.00,'Res. SF 22/1989','SP → Sudeste (ES)'),
('SP','GO',12.00,'Res. SF 22/1989','SP → Centro-Oeste'),
('SP','MA',12.00,'Res. SF 22/1989','SP → Nordeste'),
('SP','MG',12.00,'Res. SF 22/1989','SP → Sudeste'),
('SP','MS',12.00,'Res. SF 22/1989','SP → Centro-Oeste'),
('SP','MT',12.00,'Res. SF 22/1989','SP → Centro-Oeste'),
('SP','PA',12.00,'Res. SF 22/1989','SP → Norte'),
('SP','PB',12.00,'Res. SF 22/1989','SP → Nordeste'),
('SP','PE',12.00,'Res. SF 22/1989','SP → Nordeste'),
('SP','PI',12.00,'Res. SF 22/1989','SP → Nordeste'),
('SP','PR',12.00,'Res. SF 22/1989','SP → Sul'),
('SP','RJ',12.00,'Res. SF 22/1989','SP → Sudeste'),
('SP','RN',12.00,'Res. SF 22/1989','SP → Nordeste'),
('SP','RO',12.00,'Res. SF 22/1989','SP → Norte'),
('SP','RR',12.00,'Res. SF 22/1989','SP → Norte'),
('SP','RS',12.00,'Res. SF 22/1989','SP → Sul'),
('SP','SC',12.00,'Res. SF 22/1989','SP → Sul'),
('SP','SE',12.00,'Res. SF 22/1989','SP → Nordeste'),
('SP','TO',12.00,'Res. SF 22/1989','SP → Norte'),
-- Operações com importados (4% — Resolução SF 13/2012)
('SP','AC', 4.00,'Res. SF 13/2012','SP → Norte — produto importado sem similar nacional'),
('SP','RJ', 4.00,'Res. SF 13/2012','SP → RJ — produto importado'),
('SP','MG', 4.00,'Res. SF 13/2012','SP → MG — produto importado'),
-- DIFAL — Emenda Constitucional 87/2015 (consumidor final não contribuinte)
-- O DIFAL foi reorganizado pela LC 190/2022. Inclui-se nota para referência.
('SP','SP', 0.00,'Interna SP','Operação interna SP — alíquota interna SP define (geralmente 18% ou 12% conforme produto)');

-- ────────────────────────────────────────────────────────────
-- 6. ref_icms_aliquotas_internas
-- Alíquotas ICMS internas por UF (regra geral + produtos específicos)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_icms_aliquotas_internas (
  id              SERIAL PRIMARY KEY,
  uf_sigla        CHAR(2)      NOT NULL,
  produto         VARCHAR(100) NOT NULL DEFAULT 'Geral',
  aliquota        NUMERIC(5,2) NOT NULL,
  base_legal      VARCHAR(100),
  observacao      TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_icms_aliquotas_internas IS 'Alíquotas ICMS internas por UF — alíquota geral e produtos selecionados. Fonte: legislação estadual. Dados base 2025.';

INSERT INTO ref_icms_aliquotas_internas (uf_sigla, produto, aliquota, base_legal, observacao) VALUES
-- Alíquotas gerais por UF (mercadorias em geral)
('AC','Geral',17.00,'Lei 1.058/1994 AC',NULL),
('AL','Geral',17.00,'RICMS AL Decreto 35.245/1991',NULL),
('AP','Geral',18.00,'RICMS AP',NULL),
('AM','Geral',20.00,'RICMS AM',NULL),
('BA','Geral',20.50,'RICMS BA Decreto 13.780/2012','Alíquota geral majorada'),
('CE','Geral',20.00,'RICMS CE Decreto 24.569/1997',NULL),
('DF','Geral',18.00,'RICMS DF Decreto 18.955/1997',NULL),
('ES','Geral',17.00,'RICMS ES Decreto 1.090-R/2002',NULL),
('GO','Geral',17.00,'RICMS GO Decreto 4.852/1997',NULL),
('MA','Geral',20.00,'RICMS MA Decreto 19.714/2003',NULL),
('MT','Geral',17.00,'RICMS MT Decreto 2.212/2014',NULL),
('MS','Geral',17.00,'RICMS MS Decreto 9.203/1998',NULL),
('MG','Geral',18.00,'RICMS MG Decreto 43.080/2002',NULL),
('PA','Geral',19.00,'RICMS PA Decreto 4.676/2001',NULL),
('PB','Geral',20.00,'RICMS PB Decreto 18.930/1997','Alíquota geral PB'),
('PE','Geral',20.50,'RICMS PE Decreto 14.876/1991','Alíquota geral majorada'),
('PI','Geral',21.00,'RICMS PI Decreto 13.500/2008',NULL),
('PR','Geral',19.00,'RICMS PR Decreto 7.871/2017',NULL),
('RJ','Geral',20.00,'RICMS RJ Decreto 27.427/2000','Inclui adicional FECP 2%'),
('RN','Geral',20.00,'RICMS RN Decreto 13.640/1997',NULL),
('RO','Geral',17.50,'RICMS RO Decreto 22.177/2017',NULL),
('RR','Geral',17.00,'RICMS RR Decreto 4.335/2001',NULL),
('RS','Geral',18.00,'RICMS RS Decreto 37.699/1997',NULL),
('SC','Geral',17.00,'RICMS SC Decreto 2.870/2001',NULL),
('SE','Geral',19.00,'RICMS SE Decreto 21.400/2002',NULL),
('SP','Geral',18.00,'RICMS SP Decreto 45.490/2000','Alíquota geral SP 18%'),
('SP','Alimentos básicos',12.00,'RICMS SP Decreto 45.490/2000','Arroz, feijão, fubá, farinha, leite, pão, açúcar, ovos, óleo, manteiga'),
('SP','Energia elétrica residencial ≤ 200kWh',12.00,'RICMS SP','Tarifa social'),
('SP','Energia elétrica acima 200kWh',25.00,'RICMS SP',NULL),
('SP','Combustíveis (gasolina)',25.00,'RICMS SP',NULL),
('SP','Serviços de comunicação',25.00,'RICMS SP',NULL),
('SP','Bebidas alcoólicas',25.00,'RICMS SP',NULL),
('SP','Cigarros e derivados de tabaco',25.00,'RICMS SP',NULL),
('SP','Vestuário',18.00,'RICMS SP',NULL),
('SP','Medicamentos',12.00,'RICMS SP','Alíquota reduzida para medicamentos essenciais'),
('TO','Geral',20.00,'RICMS TO Decreto 2.912/2006',NULL);

-- ────────────────────────────────────────────────────────────
-- 7. ref_retencoes_fonte
-- Retenções na fonte — IRRF, PIS, COFINS, CSLL, INSS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_retencoes_fonte (
  id              SERIAL PRIMARY KEY,
  ano             SMALLINT      NOT NULL,
  tributo         VARCHAR(20)   NOT NULL,
  tipo_servico    VARCHAR(100)  NOT NULL,
  aliquota        NUMERIC(5,3)  NOT NULL,
  valor_minimo    NUMERIC(10,2),             -- valor mínimo para reter
  quem_retém      VARCHAR(60),
  base_legal      VARCHAR(100),
  observacao      TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_retencoes_fonte IS 'Retenções na fonte — IRRF, PIS, COFINS, CSLL (IN RFB 1.234/2012) e INSS. Vigente 2025.';

INSERT INTO ref_retencoes_fonte (ano, tributo, tipo_servico, aliquota, valor_minimo, quem_retém, base_legal, observacao) VALUES
-- IRRF sobre serviços (IN RFB 1.234/2012)
(2025,'IRRF','Serviços profissionais em geral (PJ)',1.500,666.00,'Pessoas jurídicas','Art. 649 RIR + IN RFB 1.234/2012','Retido na fonte quando PJ paga serviços a outra PJ. Min: R$ 10,00 de IRRF.'),
(2025,'IRRF','Serviços de limpeza, conservação, segurança, vigilância, locação de mão-de-obra',1.000,666.00,'Pessoas jurídicas','Art. 649 RIR','Alíquota 1%'),
(2025,'IRRF','Serviços de propaganda e publicidade',1.500,666.00,'Pessoas jurídicas','Art. 649 RIR',NULL),
(2025,'IRRF','Transporte de carga',0.000,0.00,'Pessoas jurídicas','Art. 651 RIR','IRRF zero para transporte de carga PJ'),
(2025,'IRRF','Transporte de passageiros',0.000,0.00,'Pessoas jurídicas','Art. 651 RIR','IRRF zero para transporte de passageiros PJ'),
(2025,'IRRF','Rendimento de trabalho assalariado (CLT)',0.000,0.00,'Empregador','Tabela progressiva','Vide tabela ref_irpf_faixas para alíquotas progressivas'),
(2025,'IRRF','Pró-labore de sócio',0.000,0.00,'Empresa','Tabela progressiva','Retenção IRRF sobre pró-labore pelo valor pago ao sócio'),
(2025,'IRRF','Aluguéis PF',0.000,0.00,'PJ pagante','Tabela progressiva','IRRF na fonte quando PJ paga aluguel a PF'),
(2025,'IRRF','Serviços médicos, odontológicos, fisioterapia, psicologia (PF)',1.500,0.00,'PJ pagante','Art. 649 RIR','Quando PJ contrata PF autônomo'),
-- Retenções PCC (PIS 0,65% + COFINS 3% + CSLL 1%) — IN RFB 1.234/2012
(2025,'PIS/COFINS/CSLL','Serviços sujeitos à retenção (regra geral PJ)',4.650,215.05,'PJ obrigada','IN RFB 1.234/2012','Retenção conjunta: CSLL 1% + COFINS 3% + PIS 0,65% = 4,65%. Mínimo: R$ 10,00 de cada tributo na NF.'),
(2025,'CSLL','Serviços sujeitos à retenção',1.000,215.05,'PJ obrigada','IN RFB 1.234/2012',NULL),
(2025,'COFINS','Serviços sujeitos à retenção',3.000,215.05,'PJ obrigada','IN RFB 1.234/2012',NULL),
(2025,'PIS','Serviços sujeitos à retenção',0.650,215.05,'PJ obrigada','IN RFB 1.234/2012',NULL),
-- INSS retido na fonte
(2025,'INSS','Cessão de mão-de-obra (substituto tributário)',11.000,0.00,'Tomador de serviços','Art. 31 Lei 8.212/1991','Retenção 11% sobre NF de serviços com cessão/locação de mão-de-obra. Empresa cedente desconta 11% da NFS-e.'),
(2025,'INSS','Construção civil — empreitada de mão-de-obra',11.000,0.00,'Contratante','Art. 31 Lei 8.212/1991','Contratante retém 11% sobre NF do construtor quando fornece apenas mão-de-obra.');

-- ────────────────────────────────────────────────────────────
-- 8. ref_indicadores_economia
-- SELIC, IPCA, CDI, TR, INPC — histórico
-- Fonte: BACEN / IBGE
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_indicadores_economia (
  id              SERIAL PRIMARY KEY,
  indicador       VARCHAR(10)   NOT NULL CHECK (indicador IN ('SELIC','CDI','IPCA','INPC','TR','IGPM','TJLP')),
  competencia     DATE          NOT NULL,  -- primeiro dia do mês de referência
  valor_mensal    NUMERIC(10,6) NOT NULL,  -- em percentual (ex: 0.940000 = 0,94%)
  valor_acumulado NUMERIC(10,4),           -- acumulado 12 meses em %
  fonte           VARCHAR(50),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  UNIQUE (indicador, competencia)
);

COMMENT ON TABLE ref_indicadores_economia IS 'Indicadores econômicos mensais — BACEN e IBGE. SELIC/CDI: meta COPOM. IPCA/INPC: IBGE. TR: BACEN.';

-- SELIC meta acumulada mensalmente (valores aproximados 2023-2025)
INSERT INTO ref_indicadores_economia (indicador, competencia, valor_mensal, valor_acumulado, fonte) VALUES
-- SELIC 2023
('SELIC','2023-01-01',1.1260,13.75,'BACEN'),
('SELIC','2023-02-01',1.1260,13.75,'BACEN'),
('SELIC','2023-03-01',1.1260,13.75,'BACEN'),
('SELIC','2023-04-01',1.0700,13.75,'BACEN'),
('SELIC','2023-05-01',1.0700,13.75,'BACEN'),
('SELIC','2023-06-01',1.0700,13.75,'BACEN'),
('SELIC','2023-07-01',1.0700,13.25,'BACEN'),
('SELIC','2023-08-01',1.0130,13.25,'BACEN'),
('SELIC','2023-09-01',1.0130,12.75,'BACEN'),
('SELIC','2023-10-01',0.9710,12.75,'BACEN'),
('SELIC','2023-11-01',0.9710,12.25,'BACEN'),
('SELIC','2023-12-01',0.9290,11.75,'BACEN'),
-- SELIC 2024
('SELIC','2024-01-01',0.9290,11.75,'BACEN'),
('SELIC','2024-02-01',0.8870,11.25,'BACEN'),
('SELIC','2024-03-01',0.8870,10.75,'BACEN'),
('SELIC','2024-04-01',0.8620,10.50,'BACEN'),
('SELIC','2024-05-01',0.8620,10.50,'BACEN'),
('SELIC','2024-06-01',0.8620,10.50,'BACEN'),
('SELIC','2024-07-01',0.8620,10.50,'BACEN'),
('SELIC','2024-08-01',0.8620,10.50,'BACEN'),
('SELIC','2024-09-01',0.8710,10.75,'BACEN'),
('SELIC','2024-10-01',0.9200,11.25,'BACEN'),
('SELIC','2024-11-01',1.0000,11.25,'BACEN'),
('SELIC','2024-12-01',1.0000,12.25,'BACEN'),
-- SELIC 2025
('SELIC','2025-01-01',1.0920,13.25,'BACEN'),
('SELIC','2025-02-01',1.1670,14.25,'BACEN'),
('SELIC','2025-03-01',1.2440,14.75,'BACEN'),
('SELIC','2025-04-01',1.2440,14.75,'BACEN'),
('SELIC','2025-05-01',1.2440,14.75,'BACEN'),
('SELIC','2025-06-01',1.2440,14.75,'BACEN'),
-- IPCA 2024 (IBGE)
('IPCA','2024-01-01',0.4200, NULL,'IBGE'),
('IPCA','2024-02-01',0.8300, NULL,'IBGE'),
('IPCA','2024-03-01',0.1600, NULL,'IBGE'),
('IPCA','2024-04-01',0.3800, NULL,'IBGE'),
('IPCA','2024-05-01',0.4600, NULL,'IBGE'),
('IPCA','2024-06-01',0.2000, NULL,'IBGE'),
('IPCA','2024-07-01',0.3800, NULL,'IBGE'),
('IPCA','2024-08-01',-0.0200,NULL,'IBGE'),
('IPCA','2024-09-01',0.4400, NULL,'IBGE'),
('IPCA','2024-10-01',0.5600, NULL,'IBGE'),
('IPCA','2024-11-01',0.3900, NULL,'IBGE'),
('IPCA','2024-12-01',0.5200, 4.83,'IBGE'),
-- IPCA 2025 (até junho/2025 — projeção BACEN para restante)
('IPCA','2025-01-01',0.1600, NULL,'IBGE'),
('IPCA','2025-02-01',1.3100, NULL,'IBGE'),
('IPCA','2025-03-01',0.5600, NULL,'IBGE'),
('IPCA','2025-04-01',0.4300, NULL,'IBGE'),
('IPCA','2025-05-01',0.5000, NULL,'IBGE'),
-- INPC 2024
('INPC','2024-12-01',0.4800, 4.77,'IBGE'),
-- CDI (referência diária — valor mensal aproximado)
('CDI','2025-01-01',1.0900,NULL,'BACEN'),
('CDI','2025-02-01',1.1650,NULL,'BACEN'),
('CDI','2025-03-01',1.2430,NULL,'BACEN'),
('CDI','2025-04-01',1.2430,NULL,'BACEN'),
('CDI','2025-05-01',1.2430,NULL,'BACEN'),
-- TR — geralmente próxima de zero nos últimos anos
('TR','2024-01-01',0.0000,NULL,'BACEN'),
('TR','2024-12-01',0.0000,NULL,'BACEN'),
('TR','2025-01-01',0.0000,NULL,'BACEN'),
-- IGPM FGV
('IGPM','2024-12-01',0.9600, 6.54,'FGV'),
('IGPM','2025-01-01',0.1400, NULL,'FGV'),
('IGPM','2025-02-01',1.0600, NULL,'FGV'),
('IGPM','2025-03-01',0.2400, NULL,'FGV');

-- ────────────────────────────────────────────────────────────
-- RLS — Leitura pública para autenticados
-- ────────────────────────────────────────────────────────────
ALTER TABLE ref_lucro_presumido_percentuais     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_aliquotas_irpj_csll             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_pis_cofins                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_iss_aliquotas                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_icms_aliquotas_interestaduais   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_icms_aliquotas_internas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_retencoes_fonte                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_indicadores_economia            ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ref_lp_read"         ON ref_lucro_presumido_percentuais   FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_irpjcsll_read"   ON ref_aliquotas_irpj_csll           FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_piscof_read"     ON ref_pis_cofins                    FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_iss_read"        ON ref_iss_aliquotas                 FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_icmsinter_read"  ON ref_icms_aliquotas_interestaduais FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_icmsinterna_read"ON ref_icms_aliquotas_internas       FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_retencao_read"   ON ref_retencoes_fonte               FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_indicadores_read"ON ref_indicadores_economia          FOR SELECT TO authenticated USING (true);
