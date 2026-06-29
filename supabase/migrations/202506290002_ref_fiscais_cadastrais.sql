-- ============================================================
-- BBA APP — MIGRATION 202506290002
-- Tabelas de Referência Fiscais Cadastrais
-- Fontes: Receita Federal, IBGE CONCLA, SEFAZ
-- Atualizado: Junho 2025
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. ref_regimes_tributarios
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_regimes_tributarios (
  id          SERIAL PRIMARY KEY,
  codigo      VARCHAR(10)  NOT NULL UNIQUE,
  nome        VARCHAR(80)  NOT NULL,
  descricao   TEXT,
  ativo       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_regimes_tributarios IS 'Regimes tributários — fonte Receita Federal';

INSERT INTO ref_regimes_tributarios (codigo, nome, descricao) VALUES
('MEI',  'Microempreendedor Individual',      'Receita bruta anual até R$ 81.000. INSS fixo + ISS e/ou ICMS fixo. Registrado no CNPJ como MEI. LC 123/2006.'),
('SN',   'Simples Nacional',                  'Regime unificado de arrecadação. Receita bruta anual até R$ 4.800.000. LC 123/2006.'),
('LP',   'Lucro Presumido',                   'Receita bruta anual até R$ 78.000.000. Base de cálculo presumida. Decreto 9.580/2018.'),
('LR',   'Lucro Real',                        'Obrigatório para receita > R$ 78.000.000 ou atividades específicas. IRPJ/CSLL sobre lucro real apurado.'),
('LA',   'Lucro Arbitrado',                   'Aplicado quando a escrituração do contribuinte é imprestável ou quando recusa-se à exibição de livros.'),
('ISENTO','Entidade Isenta / Imune',          'Entidades sem fins lucrativos, templos, partidos políticos, entidades de educação e assistência social. Art. 150 CF.')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 2. ref_naturezas_juridicas
-- Fonte: IBGE CONCLA — Classificação das Naturezas Jurídicas 2021
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_naturezas_juridicas (
  id          SERIAL PRIMARY KEY,
  codigo      CHAR(4)      NOT NULL UNIQUE,
  descricao   VARCHAR(200) NOT NULL,
  categoria   VARCHAR(60),
  ativo       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_naturezas_juridicas IS 'Naturezas Jurídicas — IBGE CONCLA 2021';

INSERT INTO ref_naturezas_juridicas (codigo, descricao, categoria) VALUES
-- Administração Pública
('1015','Órgão Público do Poder Executivo Federal ou do Distrito Federal','Administração Pública'),
('1023','Órgão Público do Poder Executivo Estadual ou do Distrito Federal','Administração Pública'),
('1031','Órgão Público do Poder Executivo Municipal','Administração Pública'),
('1040','Órgão Público do Poder Legislativo Federal','Administração Pública'),
('1058','Órgão Público do Poder Legislativo Estadual ou do Distrito Federal','Administração Pública'),
('1066','Órgão Público do Poder Legislativo Municipal','Administração Pública'),
('1074','Órgão Público do Poder Judiciário Federal','Administração Pública'),
('1082','Órgão Público do Poder Judiciário Estadual','Administração Pública'),
('1104','Autarquia Federal','Administração Pública'),
('1112','Autarquia Estadual ou do Distrito Federal','Administração Pública'),
('1120','Autarquia Municipal','Administração Pública'),
('1139','Fundação Pública de Direito Público Federal','Administração Pública'),
('1147','Fundação Pública de Direito Público Estadual ou do Distrito Federal','Administração Pública'),
('1155','Fundação Pública de Direito Público Municipal','Administração Pública'),
('1163','Órgão Público Autônomo Federal','Administração Pública'),
('1171','Órgão Público Autônomo Estadual ou do Distrito Federal','Administração Pública'),
('1180','Órgão Público Autônomo Municipal','Administração Pública'),
('1198','Comissão Polinacional','Administração Pública'),
-- Entidades Empresariais
('2011','Empresa Pública','Entidade Empresarial'),
('2038','Sociedade de Economia Mista','Entidade Empresarial'),
('2046','Sociedade Anônima Aberta','Entidade Empresarial'),
('2054','Sociedade Anônima Fechada','Entidade Empresarial'),
('2062','Sociedade Empresária Limitada','Entidade Empresarial'),
('2080','Sociedade Empresária em Nome Coletivo','Entidade Empresarial'),
('2097','Sociedade Empresária em Comandita Simples','Entidade Empresarial'),
('2111','Empresa Individual de Responsabilidade Limitada (EIRELI)','Entidade Empresarial'),
('2127','Empresa Individual Imobiliária','Entidade Empresarial'),
('2135','Sociedade em Conta de Participação','Entidade Empresarial'),
('2143','Empresário (Individual)','Entidade Empresarial'),
('2151','Cooperativa','Entidade Empresarial'),
('2160','Consórcio de Sociedades','Entidade Empresarial'),
('2232','Sociedade Simples Pura','Entidade Empresarial'),
('2240','Sociedade Simples Limitada','Entidade Empresarial'),
('2259','Sociedade Simples em Nome Coletivo','Entidade Empresarial'),
('2267','Sociedade Simples em Comandita Simples','Entidade Empresarial'),
('2291','Sociedade Unipessoal de Advogados','Entidade Empresarial'),
('2305','Sociedade de Advogados','Entidade Empresarial'),
('2313','Sociedade de Contadores','Entidade Empresarial'),
('2321','Sociedade de Dentistas','Entidade Empresarial'),
('2330','Sociedade de Economistas','Entidade Empresarial'),
('2348','Sociedade de Médicos','Entidade Empresarial'),
('2356','Sociedade Civil Brasileira com Porte de EPP','Entidade Empresarial'),
-- MEI
-- Revisado: linha removida por duplicar codigo 2305
-- Revisado: linha removida por duplicar codigo 2313
-- Entidades sem fins lucrativos
('3069','Fundação Privada','Entidade sem Fins Lucrativos'),
('3077','Serviço Social Autônomo','Entidade sem Fins Lucrativos'),
('3085','Condomínio Edilício','Entidade sem Fins Lucrativos'),
('3107','Organização Social (OS)','Entidade sem Fins Lucrativos'),
('3115','Organização da Sociedade Civil de Interesse Público (OSCIP)','Entidade sem Fins Lucrativos'),
('3131','Entidade de Mediação e Arbitragem','Entidade sem Fins Lucrativos'),
('3140','Partido Político','Entidade sem Fins Lucrativos'),
('3158','Entidade Sindical','Entidade sem Fins Lucrativos'),
('3174','Associação Privada','Entidade sem Fins Lucrativos'),
('3999','Outras Formas de Associação','Entidade sem Fins Lucrativos'),
-- MEI (código oficial Receita)
('4120','Microempreendedor Individual - MEI','MEI')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 3. ref_tipos_documento_fiscal
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_tipos_documento_fiscal (
  id          SERIAL PRIMARY KEY,
  codigo      VARCHAR(10)  NOT NULL UNIQUE,
  nome        VARCHAR(60)  NOT NULL,
  descricao   TEXT,
  ambiente    VARCHAR(20)  CHECK (ambiente IN ('Federal','Estadual','Municipal','Todos')),
  ativo       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_tipos_documento_fiscal IS 'Tipos de documentos fiscais eletrônicos';

INSERT INTO ref_tipos_documento_fiscal (codigo, nome, descricao, ambiente) VALUES
('NFE',   'NF-e',    'Nota Fiscal Eletrônica de produtos (ICMS). Modelo 55. AJUSTE SINIEF 07/2005.','Estadual'),
('NFSE',  'NFS-e',   'Nota Fiscal de Serviços Eletrônica (ISS). Padrão ABRASF.','Municipal'),
('NFCE',  'NFC-e',   'Nota Fiscal de Consumidor Eletrônica. Modelo 65. Para varejo.','Estadual'),
('CTE',   'CT-e',    'Conhecimento de Transporte Eletrônico. Modelo 57.','Federal'),
('MDFE',  'MDF-e',   'Manifesto Eletrônico de Documentos Fiscais. Modelo 58.','Federal'),
('NFEC',  'NF-e Complementar','NF-e emitida para complementar documento anterior.','Estadual'),
('CCE',   'CC-e',    'Carta de Correção Eletrônica. Corrige dados da NF-e.','Estadual'),
('DANFE', 'DANFE',   'Documento Auxiliar da NF-e. Representação gráfica da NF-e.','Estadual'),
('DACTF', 'DANFSe',  'Documento Auxiliar da NFS-e.','Municipal'),
('SAT',   'CF-e SAT','Cupom Fiscal Eletrônico — SAT. SP/CE.','Estadual'),
('BPEP',  'BP-e',    'Bilhete de Passagem Eletrônico. Modelo 63.','Federal'),
('GTVE',  'GTV-e',   'Guia de Transporte de Valores Eletrônica.','Federal'),
('NFP',   'NF de Produtor','Nota Fiscal de Produtor Rural.','Estadual'),
('RECIBO','Recibo',  'Recibo de pagamento — não é documento fiscal.','Todos')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 4. ref_cnae
-- Fonte: IBGE CONCLA — CNAE 2.3 (vigente 2025)
-- Seed com seções e divisões completas + classes principais
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_cnae (
  id            SERIAL PRIMARY KEY,
  codigo        VARCHAR(9)   NOT NULL UNIQUE, -- ex: 4751-2/01
  codigo_limpo  VARCHAR(7)   NOT NULL,        -- ex: 4751201
  secao         CHAR(1)      NOT NULL,
  divisao       CHAR(2)      NOT NULL,
  grupo         CHAR(3),
  classe        VARCHAR(6),
  subclasse     VARCHAR(9),
  descricao     VARCHAR(300) NOT NULL,
  nivel         VARCHAR(10)  NOT NULL CHECK (nivel IN ('Secao','Divisao','Grupo','Classe','Subclasse')),
  ativo         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_cnae IS 'Classificação Nacional de Atividades Econômicas — CNAE 2.3 IBGE/CONCLA. Vigente 2025.';

CREATE INDEX IF NOT EXISTS idx_cnae_codigo      ON ref_cnae(codigo);
CREATE INDEX IF NOT EXISTS idx_cnae_divisao     ON ref_cnae(divisao);
CREATE INDEX IF NOT EXISTS idx_cnae_descricao   ON ref_cnae USING gin(to_tsvector('portuguese', descricao));

-- Seções (nível mais alto)
INSERT INTO ref_cnae (codigo, codigo_limpo, secao, divisao, descricao, nivel) VALUES
('A','A','A','A','Agricultura, Pecuária, Produção Florestal, Pesca e Aquicultura','Secao'),
('B','B','B','B','Indústrias Extrativas','Secao'),
('C','C','C','C','Indústrias de Transformação','Secao'),
('D','D','D','D','Eletricidade e Gás','Secao'),
('E','E','E','E','Água, Esgoto, Atividades de Gestão de Resíduos e Descontaminação','Secao'),
('F','F','F','F','Construção','Secao'),
('G','G','G','G','Comércio
ON CONFLICT DO NOTHING; Reparação de Veículos Automotores e Motocicletas','Secao'),
('H','H','H','H','Transporte, Armazenagem e Correio','Secao'),
('I','I','I','I','Alojamento e Alimentação','Secao'),
('J','J','J','J','Informação e Comunicação','Secao'),
('K','K','K','K','Atividades Financeiras, de Seguros e Serviços Relacionados','Secao'),
('L','L','L','L','Atividades Imobiliárias','Secao'),
('M','M','M','M','Atividades Profissionais, Científicas e Técnicas','Secao'),
('N','N','N','N','Atividades Administrativas e Serviços Complementares','Secao'),
('O','O','O','O','Administração Pública, Defesa e Seguridade Social','Secao'),
('P','P','P','P','Educação','Secao'),
('Q','Q','Q','Q','Saúde Humana e Serviços Sociais','Secao'),
('R','R','R','R','Artes, Cultura, Esporte e Recreação','Secao'),
('S','S','S','S','Outras Atividades de Serviços','Secao'),
('T','T','T','T','Serviços Domésticos','Secao'),
('U','U','U','U','Organismos Internacionais e Outras Instituições Extraterritoriais','Secao');

-- CNAEs mais relevantes para MEIs e PMEs (subclasses)
INSERT INTO ref_cnae (codigo, codigo_limpo, secao, divisao, grupo, classe, subclasse, descricao, nivel) VALUES
-- Comércio varejista
('4711-3/01','4711301','G','47','471','4711-3','4711-3/01','Comércio varejista de mercadorias em geral, com predominância de produtos alimentícios - hipermercados','Subclasse'),
('4711-3/02','4711302','G','47','471','4711-3','4711-3/02','Comércio varejista de mercadorias em geral, com predominância de produtos alimentícios - supermercados','Subclasse'),
('4712-1/00','4712100','G','47','471','4712-1','4712-1/00','Comércio varejista de mercadorias em geral, com predominância de produtos alimentícios - minimercados, mercearias e armazéns','Subclasse'),
('4721-1/01','4721101','G','47','472','4721-1','4721-1/01','Padaria e confeitaria com predominância de produção própria','Subclasse'),
('4721-1/02','4721102','G','47','472','4721-1','4721-1/02','Padaria e confeitaria com predominância de revenda','Subclasse'),
('4729-6/01','4729601','G','47','472','4729-6','4729-6/01','Tabacaria','Subclasse'),
('4731-8/00','4731800','G','47','473','4731-8','4731-8/00','Comércio varejista de combustíveis para veículos automotores','Subclasse'),
('4741-5/00','4741500','G','47','474','4741-5','4741-5/00','Comércio varejista de tintas e materiais para pintura','Subclasse'),
('4742-3/00','4742300','G','47','474','4742-3','4742-3/00','Comércio varejista de material elétrico','Subclasse'),
('4744-0/01','4744001','G','47','474','4744-0','4744-0/01','Comércio varejista de ferragens e ferramentas','Subclasse'),
('4744-0/02','4744002','G','47','474','4744-0','4744-0/02','Comércio varejista de madeira e artefatos','Subclasse'),
('4744-0/05','4744005','G','47','474','4744-0','4744-0/05','Comércio varejista de materiais de construção não especificados anteriormente','Subclasse'),
('4751-2/01','4751201','G','47','475','4751-2','4751-2/01','Comércio varejista especializado de equipamentos e suprimentos de informática','Subclasse'),
('4751-2/02','4751202','G','47','475','4751-2','4751-2/02','Recarga de cartuchos para equipamentos de informática','Subclasse'),
('4752-1/00','4752100','G','47','475','4752-1','4752-1/00','Comércio varejista especializado de equipamentos de telefonia e comunicação','Subclasse'),
('4753-9/00','4753900','G','47','475','4753-9','4753-9/00','Comércio varejista especializado de eletrodomésticos e equipamentos de áudio e vídeo','Subclasse'),
('4754-7/01','4754701','G','47','475','4754-7','4754-7/01','Comércio varejista de móveis','Subclasse'),
('4755-5/01','4755501','G','47','475','4755-5','4755-5/01','Comércio varejista de tecidos','Subclasse'),
('4761-0/01','4761001','G','47','476','4761-0','4761-0/01','Comércio varejista de livros','Subclasse'),
('4762-8/00','4762800','G','47','476','4762-8','4762-8/00','Comércio varejista de discos, CDs, DVDs e fitas','Subclasse'),
('4763-6/01','4763601','G','47','476','4763-6','4763-6/01','Comércio varejista de brinquedos e artigos recreativos','Subclasse'),
('4771-7/01','4771701','G','47','477','4771-7','4771-7/01','Comércio varejista de produtos farmacêuticos, sem manipulação de fórmulas','Subclasse'),
('4771-7/02','4771702','G','47','477','4771-7','4771-7/02','Comércio varejista de produtos farmacêuticos, com manipulação de fórmulas','Subclasse'),
('4772-5/00','4772500','G','47','477','4772-5','4772-5/00','Comércio varejista de cosméticos, produtos de perfumaria e de higiene pessoal','Subclasse'),
('4781-4/00','4781400','G','47','478','4781-4','4781-4/00','Comércio varejista de artigos do vestuário e acessórios','Subclasse'),
('4782-2/01','4782201','G','47','478','4782-2','4782-2/01','Comércio varejista de calçados','Subclasse'),
('4789-0/01','4789001','G','47','478','4789-0','4789-0/01','Comércio varejista de suvenires, bijuterias e artesanatos','Subclasse'),
('4789-0/04','4789004','G','47','478','4789-0','4789-0/04','Comércio varejista de animais vivos e de artigos e alimentos para animais de estimação','Subclasse'),
('4789-0/99','4789099','G','47','478','4789-0','4789-0/99','Comércio varejista de outros produtos não especificados anteriormente','Subclasse'),
-- Alimentação
('5611-2/01','5611201','I','56','561','5611-2','5611-2/01','Restaurantes e similares','Subclasse'),
('5611-2/03','5611203','I','56','561','5611-2','5611-2/03','Lanchonetes, casas de chá, de sucos e similares','Subclasse'),
('5611-2/04','5611204','I','56','561','5611-2','5611-2/04','Bares e outros estabelecimentos especializados em servir bebidas, sem entretenimento','Subclasse'),
('5612-1/00','5612100','I','56','561','5612-1','5612-1/00','Serviços ambulantes de alimentação','Subclasse'),
('5620-1/01','5620101','I','56','562','5620-1','5620-1/01','Fornecimento de alimentos preparados preponderantemente para empresas (catering)','Subclasse'),
('5620-1/02','5620102','I','56','562','5620-1','5620-1/02','Serviços de alimentação para eventos e recepções - bufê','Subclasse'),
-- TI / Tecnologia
('6201-5/00','6201500','J','62','620','6201-5','6201-5/00','Desenvolvimento de programas de computador sob encomenda','Subclasse'),
('6202-3/00','6202300','J','62','620','6202-3','6202-3/00','Desenvolvimento e licenciamento de programas de computador customizáveis','Subclasse'),
('6203-1/00','6203100','J','62','620','6203-1','6203-1/00','Desenvolvimento e licenciamento de programas de computador não-customizáveis','Subclasse'),
('6204-0/00','6204000','J','62','620','6204-0','6204-0/00','Consultoria em tecnologia da informação','Subclasse'),
('6209-1/00','6209100','J','62','620','6209-1','6209-1/00','Suporte técnico, manutenção e outros serviços em tecnologia da informação','Subclasse'),
('6311-9/00','6311900','J','63','631','6311-9','6311-9/00','Tratamento de dados, provedores de serviços de aplicação e serviços de hospedagem na internet','Subclasse'),
('6319-4/00','6319400','J','63','631','6319-4','6319-4/00','Portais, provedores de conteúdo e outros serviços de informação na internet','Subclasse'),
('6391-7/00','6391700','J','63','639','6391-7','6391-7/00','Agências de notícias','Subclasse'),
('6399-2/00','6399200','J','63','639','6399-2','6399-2/00','Outras atividades de prestação de serviços de informação não especificadas anteriormente','Subclasse'),
-- Construção
('4110-7/00','4110700','F','41','411','4110-7','4110-7/00','Incorporação de empreendimentos imobiliários','Subclasse'),
('4120-4/00','4120400','F','41','412','4120-4','4120-4/00','Construção de edifícios','Subclasse'),
('4211-1/01','4211101','F','42','421','4211-1','4211-1/01','Construção de rodovias e ferrovias','Subclasse'),
('4212-0/00','4212000','F','42','421','4212-0','4212-0/00','Construção de obras de arte especiais','Subclasse'),
('4213-8/00','4213800','F','42','421','4213-8','4213-8/00','Obras de urbanização - ruas, praças e calçadas','Subclasse'),
('4221-9/01','4221901','F','42','422','4221-9','4221-9/01','Construção de barragens e represas para geração de energia elétrica','Subclasse'),
('4221-9/02','4221902','F','42','422','4221-9','4221-9/02','Construção de estações e redes de distribuição de energia elétrica','Subclasse'),
('4221-9/03','4221903','F','42','422','4221-9','4221-9/03','Manutenção de redes de distribuição de energia elétrica','Subclasse'),
('4221-9/04','4221904','F','42','422','4221-9','4221-9/04','Construção de estações e redes de telecomunicações','Subclasse'),
('4222-7/01','4222701','F','42','422','4222-7','4222-7/01','Construção de redes de abastecimento de água, coleta de esgoto e construções correlatas, exceto obras de irrigação','Subclasse'),
('4291-0/00','4291000','F','42','429','4291-0','4291-0/00','Obras portuárias, marítimas e fluviais','Subclasse'),
('4292-8/01','4292801','F','42','429','4292-8','4292-8/01','Montagem de estruturas metálicas','Subclasse'),
('4299-5/99','4299599','F','42','429','4299-5','4299-5/99','Outras obras de engenharia civil não especificadas anteriormente','Subclasse'),
('4311-8/01','4311801','F','43','431','4311-8','4311-8/01','Demolição de edifícios e outras estruturas','Subclasse'),
('4321-5/00','4321500','F','43','432','4321-5','4321-5/00','Instalação e manutenção elétrica','Subclasse'),
('4329-1/04','4329104','F','43','432','4329-1','4329-1/04','Montagem e instalação de sistemas e equipamentos de iluminação e sinalização em vias públicas, portos e aeroportos','Subclasse'),
('4330-4/02','4330402','F','43','433','4330-4','4330-4/02','Instalação de portas, janelas, tetos, divisórias e armários embutidos de qualquer material','Subclasse'),
('4330-4/05','4330405','F','43','433','4330-4','4330-4/05','Telhamento (incluindo trabalhos em telhados)','Subclasse'),
('4391-6/00','4391600','F','43','439','4391-6','4391-6/00','Obras de fundações','Subclasse'),
('4399-1/03','4399103','F','43','439','4399-1','4399-1/03','Obras de alvenaria','Subclasse'),
-- Consultoria e serviços profissionais
('6920-6/01','6920601','K','69','692','6920-6','6920-6/01','Atividades de contabilidade','Subclasse'),
('6920-6/02','6920602','K','69','692','6920-6','6920-6/02','Atividades de consultoria e auditoria contábil e tributária','Subclasse'),
('7020-4/00','7020400','M','70','702','7020-4','7020-4/00','Atividades de consultoria em gestão empresarial, exceto consultoria técnica específica','Subclasse'),
('7111-1/00','7111100','M','71','711','7111-1','7111-1/00','Serviços de arquitetura','Subclasse'),
('7112-0/00','7112000','M','71','711','7112-0','7112-0/00','Serviços de engenharia','Subclasse'),
('7119-7/01','7119701','M','71','711','7119-7','7119-7/01','Serviços de cartografia, topografia e geodésia','Subclasse'),
('7210-0/00','7210000','M','72','721','7210-0','7210-0/00','Pesquisa e desenvolvimento experimental em ciências físicas e naturais','Subclasse'),
('7310-5/00','7310500','M','73','731','7310-5','7310-5/00','Agências de publicidade','Subclasse'),
('7319-0/02','7319002','M','73','731','7319-0','7319-0/02','Promoção de vendas','Subclasse'),
('7319-0/99','7319099','M','73','731','7319-0','7319-0/99','Outras atividades de publicidade não especificadas anteriormente','Subclasse'),
('7320-3/00','7320300','M','73','732','7320-3','7320-3/00','Pesquisas de mercado e de opinião pública','Subclasse'),
('7410-2/02','7410202','M','74','741','7410-2','7410-2/02','Design de interiores','Subclasse'),
('7410-2/03','7410203','M','74','741','7410-2','7410-2/03','Design de produto','Subclasse'),
('7490-1/01','7490101','M','74','749','7490-1','7490-1/01','Serviços de tradução, interpretação e similares','Subclasse'),
('7490-1/04','7490104','M','74','749','7490-1','7490-1/04','Atividades de intermediação e agenciamento de serviços e negócios em geral, exceto imobiliários','Subclasse'),
-- Saúde
('8610-1/01','8610101','Q','86','861','8610-1','8610-1/01','Atividades de atendimento hospitalar, exceto pronto-socorro e unidades para atendimento a urgências','Subclasse'),
('8630-5/01','8630501','Q','86','863','8630-5','8630-5/01','Atividade médica ambulatorial com recursos para realização de procedimentos cirúrgicos','Subclasse'),
('8630-5/02','8630502','Q','86','863','8630-5','8630-5/02','Atividade médica ambulatorial com recursos para realização de exames complementares','Subclasse'),
('8630-5/03','8630503','Q','86','863','8630-5','8630-5/03','Atividade médica ambulatorial restrita a consultas','Subclasse'),
('8640-2/02','8640202','Q','86','864','8640-2','8640-2/02','Laboratórios clínicos','Subclasse'),
('8650-0/01','8650001','Q','86','865','8650-0','8650-0/01','Atividades de enfermagem','Subclasse'),
('8660-7/00','8660700','Q','86','866','8660-7','8660-7/00','Atividades de apoio à gestão de saúde','Subclasse'),
-- Educação
('8511-2/00','8511200','P','85','851','8511-2','8511-2/00','Educação infantil - creche','Subclasse'),
('8512-1/00','8512100','P','85','851','8512-1','8512-1/00','Educação infantil - pré-escola','Subclasse'),
('8513-9/00','8513900','P','85','851','8513-9','8513-9/00','Ensino fundamental','Subclasse'),
('8541-4/00','8541400','P','85','854','8541-4','8541-4/00','Educação profissional de nível técnico','Subclasse'),
('8599-6/04','8599604','P','85','859','8599-6','8599-6/04','Treinamento em desenvolvimento profissional e gerencial','Subclasse'),
-- Transporte
('4921-3/01','4921301','H','49','492','4921-3','4921-3/01','Transporte rodoviário coletivo de passageiros, com itinerário fixo, municipal','Subclasse'),
('4923-0/02','4923002','H','49','492','4923-0','4923-0/02','Serviço de táxi','Subclasse'),
('4929-9/02','4929902','H','49','492','4929-9','4929-9/02','Transporte escolar','Subclasse'),
('4930-2/01','4930201','H','49','493','4930-2','4930-2/01','Transporte rodoviário de carga, exceto produtos perigosos e mudanças, municipal','Subclasse'),
('4930-2/02','4930202','H','49','493','4930-2','4930-2/02','Transporte rodoviário de carga, exceto produtos perigosos e mudanças, intermunicipal, interestadual e internacional','Subclasse'),
-- Imobiliário
('6810-2/01','6810201','L','68','681','6810-2','6810-2/01','Compra e venda de imóveis próprios','Subclasse'),
('6810-2/02','6810202','L','68','681','6810-2','6810-2/02','Aluguel de imóveis próprios','Subclasse'),
('6821-8/01','6821801','L','68','682','6821-8','6821-8/01','Corretagem na compra e venda e avaliação de imóveis','Subclasse'),
('6821-8/02','6821802','L','68','682','6821-8','6821-8/02','Corretagem no aluguel de imóveis','Subclasse'),
-- Beleza e estética
('9602-5/01','9602501','S','96','960','9602-5','9602-5/01','Cabeleireiros','Subclasse'),
('9602-5/02','9602502','S','96','960','9602-5','9602-5/02','Outras atividades de tratamento de beleza','Subclasse'),
('9603-3/04','9603304','S','96','960','9603-3','9603-3/04','Serviços de tatuagem e colocação de piercing','Subclasse'),
-- Serviços gerais MEI
('9601-7/01','9601701','S','96','960','9601-7','9601-7/01','Lavanderias','Subclasse'),
('9601-7/02','9601702','S','96','960','9601-7','9601-7/02','Tinturarias','Subclasse'),
('8121-4/00','8121400','N','81','812','8121-4','8121-4/00','Limpeza em prédios e em domicílios','Subclasse'),
('8122-2/00','8122200','N','81','812','8122-2','8122-2/00','Imunização e controle de pragas urbanas','Subclasse'),
('8129-0/00','8129000','N','81','812','8129-0','8129-0/00','Outras atividades de limpeza não especificadas anteriormente','Subclasse')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 5. ref_cfop
-- Fonte: CONFAZ / SEFAZ — Tabela CFOP vigente 2025
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_cfop (
  id            SERIAL PRIMARY KEY,
  codigo        VARCHAR(5)   NOT NULL UNIQUE,
  descricao     VARCHAR(200) NOT NULL,
  tipo          CHAR(1)      NOT NULL CHECK (tipo IN ('E','S')), -- E=Entrada S=Saída
  aplicacao     VARCHAR(100),
  ativo         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_cfop IS 'Código Fiscal de Operações e Prestações — CONFAZ. Vigente 2025.';
CREATE INDEX IF NOT EXISTS idx_cfop_codigo ON ref_cfop(codigo);

INSERT INTO ref_cfop (codigo, descricao, tipo, aplicacao) VALUES
-- Entradas Estaduais/Internas (1.xxx)
('1.101','Compra para industrialização ou produção rural','E','Aquisição de insumos para produção'),
('1.102','Compra para comercialização','E','Compra de mercadoria para revenda - mesmo estado'),
('1.111','Compra para industrialização de mercadoria recebida anteriormente em consignação industrial','E','Consignação industrial'),
('1.113','Compra para comercialização, de mercadoria recebida anteriormente em consignação mercantil','E','Consignação mercantil'),
('1.116','Compra para industrialização originada de encomenda para recebimento futuro','E','Encomenda futura'),
('1.117','Compra para comercialização originada de encomenda para recebimento futuro','E','Encomenda futura revenda'),
('1.118','Compra de mercadoria para comercialização pelo adquirente originário, com entrega ao destinatário (operação triangular)','E','Triangular'),
('1.120','Compra para industrialização, em venda à ordem, já recebida do vendedor remetente','E','Venda à ordem industrial'),
('1.121','Compra para comercialização, em venda à ordem, já recebida do vendedor remetente','E','Venda à ordem revenda'),
('1.122','Compra para industrialização em que a mercadoria foi remetida pelo fornecedor ao industrializador sem transitar pelo estabelecimento adquirente','E','Industrial sem trânsito'),
('1.124','Industrialização efetuada por outra empresa','E','Industrialização terceiros'),
('1.125','Industrialização efetuada por outra empresa quando a mercadoria remetida para utilização no processo de industrialização não transitar pelo estabelecimento adquirente do serviço','E','Industrial sem trânsito terceiros'),
('1.151','Transferência para industrialização ou produção rural','E','Transferência entre filiais'),
('1.152','Transferência para comercialização','E','Transferência revenda'),
('1.201','Devolução de venda de produção do estabelecimento','E','Devolução de venda'),
('1.202','Devolução de venda de mercadoria adquirida e recebida para comercialização','E','Devolução compra revenda'),
('1.411','Devolução de venda de produção do estabelecimento em operação com produto sujeito ao regime de substituição tributária','E','Devolução ST produção'),
('1.556','Compra de bem para o ativo imobilizado','E','Ativo imobilizado'),
('1.601','Recebimento, por transferência, de saldo crédito de ICMS de outro estabelecimento da mesma empresa','E','Crédito ICMS transferência'),
('1.603','Ressarcimento de ICMS retido por substituição tributária','E','Ressarcimento ST'),
('1.605','Recebimento, por transferência, de saldo devedor de ICMS de outro estabelecimento da mesma empresa, para efetivação de desoneração prevista em lei complementar','E','Desoneração LC'),
('1.900','Entrada de mercadoria, bem ou aquisição de serviço não especificado','E','Outros entradas'),
-- Entradas Interestaduais (2.xxx)
('2.101','Compra para industrialização ou produção rural','E','Compra interestadual industrial'),
('2.102','Compra para comercialização','E','Compra interestadual revenda'),
('2.111','Compra para industrialização de mercadoria recebida anteriormente em consignação industrial','E','Consignação industrial interestadual'),
('2.201','Devolução de venda de produção do estabelecimento','E','Devolução interestadual'),
('2.202','Devolução de venda de mercadoria adquirida e recebida para comercialização','E','Devolução compra interestadual'),
('2.556','Compra de bem para o ativo imobilizado','E','Ativo interestadual'),
('2.900','Entrada de mercadoria, bem ou aquisição de serviço não especificado','E','Outros entradas interestaduais'),
-- Entradas Exterior (3.xxx)
('3.101','Compra para industrialização ou produção rural','E','Importação industrial'),
('3.102','Compra para comercialização','E','Importação revenda'),
('3.127','Compra para utilização na prestação de serviço sujeita ao ISSQN','E','Importação serviço ISS'),
('3.201','Devolução de venda de produção do estabelecimento','E','Devolução exportação'),
('3.900','Entrada de mercadoria ou aquisição de serviço não especificado','E','Outros entradas importação'),
-- Saídas Estaduais/Internas (5.xxx)
('5.101','Venda de produção do estabelecimento','S','Venda de produção própria - mesmo estado'),
('5.102','Venda de mercadoria adquirida ou recebida de terceiros','S','Venda de mercadoria - mesmo estado'),
('5.103','Venda de produção do estabelecimento, efetuada fora do estabelecimento','S','Venda fora estabelecimento produção'),
('5.104','Venda de mercadoria adquirida ou recebida de terceiros, efetuada fora do estabelecimento','S','Venda fora estabelecimento revenda'),
('5.105','Venda de produção do estabelecimento que não deva por ela transitar','S','Venda sem trânsito'),
('5.106','Venda de mercadoria adquirida ou recebida de terceiros, que não deva por ela transitar','S','Venda revenda sem trânsito'),
('5.109','Venda de produção do estabelecimento, destinada à Zona Franca de Manaus ou Áreas de Livre Comércio','S','Venda ZFM produção'),
('5.110','Venda de mercadoria, adquirida ou recebida de terceiros, destinada à Zona Franca de Manaus ou Áreas de Livre Comércio','S','Venda ZFM revenda'),
('5.111','Venda de produção do estabelecimento remetida anteriormente em consignação industrial','S','Consignação industrial saída'),
('5.113','Venda de mercadoria adquirida ou recebida de terceiros, remetida anteriormente em consignação mercantil','S','Consignação mercantil saída'),
('5.114','Venda de produção do estabelecimento remetida anteriormente em consignação mercantil','S','Consignação produção saída'),
('5.115','Venda de mercadoria adquirida ou recebida de terceiros, remetida anteriormente em consignação industrial','S','Consignação industrial revenda saída'),
('5.116','Venda de produção do estabelecimento originada de encomenda para entrega futura','S','Encomenda futura produção'),
('5.117','Venda de mercadoria adquirida ou recebida de terceiros, originada de encomenda para entrega futura','S','Encomenda futura revenda'),
('5.118','Venda de produção do estabelecimento entregue ao destinatário por conta e ordem do adquirente originário, em venda à ordem','S','Venda à ordem produção'),
('5.119','Venda de mercadoria adquirida ou recebida de terceiros entregue ao destinatário por conta e ordem do adquirente originário em venda à ordem','S','Venda à ordem revenda'),
('5.120','Venda de mercadoria adquirida ou recebida de terceiros entregue ao destinatário pelo vendedor remetente em venda à ordem','S','Venda à ordem remetente'),
('5.122','Venda de produção do estabelecimento remetida para industrialização, por conta e ordem do adquirente, sem transitar pelo estabelecimento do adquirente','S','Industrial sem trânsito adquirente'),
('5.124','Industrialização efetuada para outra empresa','S','Industrialização terceiros saída'),
('5.125','Industrialização efetuada para outra empresa quando a mercadoria recebida para utilização no processo de industrialização não transitar pelo estabelecimento adquirente do serviço','S','Industrial serviço sem trânsito'),
('5.151','Transferência de produção do estabelecimento','S','Transferência produção'),
('5.152','Transferência de mercadoria adquirida ou recebida de terceiros','S','Transferência revenda'),
('5.155','Transferência de bem do ativo imobilizado','S','Transferência ativo imobilizado'),
('5.201','Devolução de compra para industrialização ou produção rural','S','Devolução compra industrial'),
('5.202','Devolução de compra para comercialização','S','Devolução compra revenda'),
('5.210','Devolução de compra para utilização na prestação de serviço','S','Devolução compra serviço'),
('5.302','Saídas de mercadorias sujeitas ao regime de substituição tributária - ST','S','Substituição tributária ST'),
('5.401','Venda de produção do estabelecimento em operação com produto sujeito ao regime de substituição tributária, na condição de contribuinte substituto','S','ST contribuinte substituto'),
('5.402','Venda de produção do estabelecimento de produto sujeito ao regime de substituição tributária, em operação entre contribuintes substitutos do mesmo produto','S','ST contribuintes substitutos'),
('5.403','Venda de mercadoria adquirida ou recebida de terceiros em operação com mercadoria sujeita ao regime de substituição tributária, na condição de contribuinte substituto','S','ST substituto revenda'),
('5.405','Venda de mercadoria adquirida ou recebida de terceiros em operação com mercadoria sujeita ao regime de substituição tributária, na condição de contribuinte substituído','S','ST substituído'),
('5.501','Remessa de produção do estabelecimento, com fim específico de exportação','S','Remessa exportação produção'),
('5.502','Remessa de mercadoria adquirida ou recebida de terceiros, com fim específico de exportação','S','Remessa exportação revenda'),
('5.551','Venda de bem do ativo imobilizado','S','Venda ativo imobilizado'),
('5.552','Transferência de bem do ativo imobilizado','S','Transferência ativo imobilizado'),
('5.553','Devolução de compra de bem para o ativo imobilizado','S','Devolução ativo imobilizado'),
('5.554','Remessa de bem do ativo imobilizado para uso fora do estabelecimento','S','Remessa ativo externo'),
('5.555','Remessa de bem do ativo imobilizado para conserto ou reparo','S','Conserto ativo'),
('5.556','Devolução de bem do ativo imobilizado de terceiro, recebido para conserto ou reparo','S','Devolução conserto'),
('5.600','Crédito outorgado ou recebido por transferência de outro estabelecimento','S','Crédito ICMS'),
('5.900','Saída de mercadoria, bem ou prestação de serviço não especificado','S','Outros saídas'),
-- Saídas Interestaduais (6.xxx)
('6.101','Venda de produção do estabelecimento','S','Venda interestadual produção'),
('6.102','Venda de mercadoria adquirida ou recebida de terceiros','S','Venda interestadual revenda'),
('6.107','Venda de produção do estabelecimento, destinada à Zona Franca de Manaus ou Áreas de Livre Comércio','S','Venda ZFM interestadual'),
('6.108','Venda de mercadoria adquirida ou recebida de terceiros, destinada à Zona Franca de Manaus ou Áreas de Livre Comércio','S','Venda ZFM revenda interestadual'),
('6.201','Devolução de compra para industrialização ou produção rural','S','Devolução industrial interestadual'),
('6.202','Devolução de compra para comercialização','S','Devolução revenda interestadual'),
('6.401','Venda de produção do estabelecimento em operação com produto sujeito ao regime de substituição tributária, na condição de contribuinte substituto','S','ST interestadual'),
('6.403','Venda de mercadoria adquirida ou recebida de terceiros em operação com mercadoria sujeita ao regime de substituição tributária, na condição de contribuinte substituto','S','ST revenda interestadual'),
('6.500','Remessa com fim específico de exportação e eventuais devoluções','S','Exportação direta'),
('6.501','Remessa de produção do estabelecimento, com fim específico de exportação','S','Remessa exportação produção interestadual'),
('6.502','Remessa de mercadoria adquirida ou recebida de terceiros, com fim específico de exportação','S','Remessa exportação revenda interestadual'),
('6.551','Venda de bem do ativo imobilizado','S','Venda ativo interestadual'),
('6.900','Saída de mercadoria ou prestação de serviço não especificada','S','Outros saídas interestaduais'),
-- Saídas Exterior (7.xxx)
('7.101','Venda de produção do estabelecimento','S','Exportação produção'),
('7.102','Venda de mercadoria adquirida ou recebida de terceiros','S','Exportação revenda'),
('7.201','Devolução de compra para industrialização realizada em outro país','S','Devolução importação industrial'),
('7.900','Saída de mercadoria ou prestação de serviço não especificada','S','Outros exportação')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 6. ref_ncm (amostra das principais — seed completo via ETL)
-- Fonte: Receita Federal — TIPI vigente 2025
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_ncm (
  id              SERIAL PRIMARY KEY,
  codigo          VARCHAR(10)  NOT NULL UNIQUE, -- ex: 8471.30.19
  codigo_limpo    VARCHAR(8)   NOT NULL,         -- ex: 84713019
  descricao       VARCHAR(400) NOT NULL,
  unidade_trib    VARCHAR(10),                   -- UN, KG, L, M2, etc.
  ipi_aliquota    NUMERIC(5,2) DEFAULT 0,
  ii_aliquota     NUMERIC(5,2) DEFAULT 0,
  capitulo        VARCHAR(2)   NOT NULL,
  posicao         VARCHAR(4),
  subposicao      VARCHAR(7),
  item            VARCHAR(10),
  subitem         VARCHAR(10),
  ativo           BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_ncm IS 'Nomenclatura Comum do Mercosul — TIPI Decreto 11.158/2022 e atualizações 2025. Seed com NCMs mais utilizados por MEIs e PMEs. Carga completa (~11.000 itens) via ETL Receita Federal.';

CREATE INDEX IF NOT EXISTS idx_ncm_codigo     ON ref_ncm(codigo);
CREATE INDEX IF NOT EXISTS idx_ncm_descricao  ON ref_ncm USING gin(to_tsvector('portuguese', descricao));
CREATE INDEX IF NOT EXISTS idx_ncm_capitulo   ON ref_ncm(capitulo);

INSERT INTO ref_ncm (codigo, codigo_limpo, descricao, unidade_trib, ipi_aliquota, capitulo, posicao, subposicao) VALUES
-- Capítulo 84 — Máquinas e equipamentos
('8471.30.19','84713019','Outras máquinas para processamento de dados, portáteis, de peso <= 10kg, com unidade central, teclado e monitor','UN',0,'84','8471','8471.30'),
('8471.41.10','84714110','Outras máquinas para processamento de dados — que contenham, na mesma unidade, uma unidade central de processamento e, num mesmo gabinete, um dispositivo de entrada e um de saída','UN',0,'84','8471','8471.41'),
('8471.50.10','84715010','Unidades de processamento, exceto as das subposições 8471.41 ou 8471.49 (desktops)','UN',0,'84','8471','8471.50'),
('8471.60.54','84716054','Teclados','UN',0,'84','8471','8471.60'),
('8471.70.11','84717011','Unidades de memória de disco magnético','UN',0,'84','8471','8471.70'),
('8471.70.91','84717091','Impressoras de jato de tinta','UN',0,'84','8471','8471.70'),
('8517.12.31','85171231','Telefones para redes celulares — smartphones','UN',0,'85','8517','8517.12'),
('8517.62.62','85176262','Aparelhos de switching para redes com fio (switches)','UN',0,'85','8517','8517.62'),
-- Capítulo 22 — Bebidas
('2201.10.00','22011000','Águas minerais e águas gaseificadas','L',0,'22','2201','2201.10'),
('2202.10.00','22021000','Água, incluída a água mineral e a água gaseificada, adicionada de açúcar ou de outros edulcorantes ou aromatizadas','L',5,'22','2202','2202.10'),
('2203.00.00','22030000','Cerveja de malte','L',40,'22','2203','2203.00'),
('2204.21.90','22042190','Outros vinhos de uvas frescas (em recipientes até 2L)','L',15,'22','2204','2204.21'),
('2208.40.00','22084000','Rum e outras aguardentes de melaço','L',20,'22','2208','2208.40'),
-- Capítulo 33 — Cosméticos
('3303.00.10','33030010','Perfumes (extratos)','UN',15,'33','3303','3303.00'),
('3304.10.00','33041000','Produtos de maquiagem para os lábios','UN',0,'33','3304','3304.10'),
('3304.20.00','33042000','Produtos de maquiagem para os olhos','UN',0,'33','3304','3304.20'),
('3305.10.00','33051000','Xampus','UN',0,'33','3305','3305.10'),
('3305.30.00','33053000','Laquês para o cabelo','UN',0,'33','3305','3305.30'),
('3306.10.00','33061000','Dentifrícios','UN',0,'33','3306','3306.10'),
('3307.20.10','33072010','Desodorantes corporais e antiperspirantes — líquidos','UN',0,'33','3307','3307.20'),
-- Capítulo 61/62 — Vestuário
('6109.10.00','61091000','T-shirts e camisetas de malha, de algodão','UN',0,'61','6109','6109.10'),
('6203.42.00','62034200','Calças, jardineiras, bermudas e shorts, de algodão, para homens ou rapazes','UN',0,'62','6203','6203.42'),
('6204.62.00','62046200','Calças, jardineiras, bermudas e shorts, de algodão, para mulheres ou raparigas','UN',0,'62','6204','6204.62'),
('6401.99.00','64019900','Calçados impermeáveis','UN',0,'64','6401','6401.99'),
('6403.91.90','64039190','Outros calçados com sola exterior de borracha, plástico, couro natural ou reconstituído e parte superior de couro natural','UN',0,'64','6403','6403.91'),
-- Capítulo 04 — Laticínios
('0401.10.10','04011010','Leite integral, UHT, em embalagens <= 2L','L',0,'04','0401','0401.10'),
('0406.10.10','04061010','Queijo fresco (incluindo soro de leite) e requeijão','KG',0,'04','0406','0406.10'),
-- Capítulo 19 — Produtos alimentícios
('1901.20.00','19012000','Misturas e pastas para a preparação de produtos de padaria, pastelaria e biscoitos','KG',0,'19','1901','1901.20'),
('1905.31.00','19053100','Bolachas e biscoitos, adicionados de edulcorantes','KG',0,'19','1905','1905.31'),
-- Capítulo 94 — Mobiliário
('9401.61.00','94016100','Assentos com armação de madeira, estofados (sofás, cadeiras)','UN',0,'94','9401','9401.61'),
('9403.30.00','94033000','Móveis de madeira utilizados em escritórios','UN',0,'94','9403','9403.30'),
('9403.60.00','94036000','Outros móveis de madeira','UN',0,'94','9403','9403.60'),
-- Capítulo 30 — Farmacêutico
('3004.90.99','30049099','Outros medicamentos (misturas ou não) preparados para fins terapêuticos ou profiláticos, em doses ou em embalagens para venda a retalho','UN',0,'30','3004','3004.90'),
-- Capítulo 73 — Ferro e aço
('7308.90.10','73089010','Portas, janelas e seus caixilhos, alizares e soleiras, de ferro fundido, ferro ou aço','KG',0,'73','7308','7308.90'),
-- Capítulo 27 — Combustíveis
('2710.12.59','27101259','Outras gasolinas','L',0,'27','2710','2710.12'),
('2710.19.21','27101921','Óleo diesel','L',0,'27','2710','2710.19'),
-- Serviços (para NFS-e — código específico por município, mas NCM não se aplica a serviços puro)
-- Produtos agropecuários
('0102.29.90','01022990','Outros bovinos vivos','UN',0,'01','0102','0102.29'),
('0201.30.00','02013000','Carnes de bovino, desossadas, frescas ou refrigeradas','KG',0,'02','0201','0201.30'),
('0701.90.00','07019000','Outras batatas, frescas ou refrigeradas','KG',0,'07','0701','0701.90'),
('0803.90.00','08039000','Outras bananas, frescas ou secas','KG',0,'08','0803','0803.90'),
('1001.19.00','10011900','Outros trigos, exceto durum, e trigos misturados com centeio','KG',0,'10','1001','1001.19'),
('1005.90.10','10059010','Milho em grão, exceto semente','KG',0,'10','1005','1005.90'),
('1201.90.00','12019000','Outras sementes de soja, mesmo trituradas','KG',0,'12','1201','1201.90')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 7. ref_origem_mercadoria
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_origem_mercadoria (
  id          SERIAL PRIMARY KEY,
  codigo      CHAR(1)      NOT NULL UNIQUE,
  descricao   VARCHAR(200) NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_origem_mercadoria IS 'Tabela de Origem da Mercadoria (campo CST/CSOSN)';

INSERT INTO ref_origem_mercadoria (codigo, descricao) VALUES
('0','Nacional, exceto as indicadas nos códigos 3, 4, 5 e 8'),
('1','Estrangeira - Importação direta, exceto a indicada no código 6'),
('2','Estrangeira - Adquirida no mercado interno, exceto a indicada no código 7'),
('3','Nacional, mercadoria ou bem com Conteúdo de Importação superior a 40% e inferior ou igual a 70%'),
('4','Nacional, cuja produção tenha sido feita em conformidade com os processos produtivos básicos de que tratam as legislações citadas nos Ajustes'),
('5','Nacional, mercadoria ou bem com Conteúdo de Importação inferior ou igual a 40%'),
('6','Estrangeira - Importação direta, sem similar nacional, constante em lista da CAMEX e gás natural'),
('7','Estrangeira - Adquirida no mercado interno, sem similar nacional, constante em lista da CAMEX e gás natural'),
('8','Nacional, mercadoria ou bem com Conteúdo de Importação superior a 70%')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 8. ref_cst_icms
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_cst_icms (
  id            SERIAL PRIMARY KEY,
  codigo        VARCHAR(3)   NOT NULL UNIQUE,
  descricao     VARCHAR(200) NOT NULL,
  tipo          VARCHAR(10)  NOT NULL CHECK (tipo IN ('CST','CSOSN')),
  regime        VARCHAR(30), -- Lucro Real/Presumido ou Simples Nacional
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_cst_icms IS 'Códigos de Situação Tributária do ICMS — CST (regime normal) e CSOSN (Simples Nacional). Tabela A + B do Convênio SINIEF s/n 1970 e Res. CGSN 140/2018.';

INSERT INTO ref_cst_icms (codigo, descricao, tipo, regime) VALUES
-- CST — Regime Normal (Lucro Presumido / Lucro Real)
('00','Tributada integralmente','CST','Normal'),
('10','Tributada e com cobrança do ICMS por substituição tributária','CST','Normal'),
('20','Com redução de base de cálculo','CST','Normal'),
('30','Isenta ou não tributada e com cobrança do ICMS por substituição tributária','CST','Normal'),
('40','Isenta','CST','Normal'),
('41','Não tributada','CST','Normal'),
('50','Suspensão','CST','Normal'),
('51','Diferimento','CST','Normal'),
('60','ICMS cobrado anteriormente por substituição tributária','CST','Normal'),
('70','Com redução de base de cálculo e cobrança do ICMS por substituição tributária','CST','Normal'),
('90','Outros','CST','Normal'),
-- CSOSN — Simples Nacional
('101','Tributada pelo Simples Nacional com permissão de crédito','CSOSN','Simples Nacional'),
('102','Tributada pelo Simples Nacional sem permissão de crédito','CSOSN','Simples Nacional'),
('103','Isenção do ICMS no Simples Nacional para faixa de receita bruta','CSOSN','Simples Nacional'),
('201','Tributada pelo Simples Nacional com permissão de crédito e com cobrança do ICMS por ST','CSOSN','Simples Nacional'),
('202','Tributada pelo Simples Nacional sem permissão de crédito e com cobrança do ICMS por ST','CSOSN','Simples Nacional'),
('203','Isenção do ICMS no Simples Nacional para faixa de receita bruta e com cobrança do ICMS por ST','CSOSN','Simples Nacional'),
('300','Imune','CSOSN','Simples Nacional'),
('400','Não tributada pelo Simples Nacional','CSOSN','Simples Nacional'),
('500','ICMS cobrado anteriormente por substituição tributária (substituído) ou por antecipação','CSOSN','Simples Nacional'),
('900','Outros','CSOSN','Simples Nacional')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 9. ref_cst_pis_cofins
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_cst_pis_cofins (
  id          SERIAL PRIMARY KEY,
  codigo      VARCHAR(3)   NOT NULL UNIQUE,
  descricao   VARCHAR(200) NOT NULL,
  tipo        VARCHAR(20)  CHECK (tipo IN ('Cumulativo','Não-Cumulativo','Ambos')),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_cst_pis_cofins IS 'CST PIS/COFINS — Instrução Normativa RFB 1.009/2010 e atualizações 2025';

INSERT INTO ref_cst_pis_cofins (codigo, descricao, tipo) VALUES
('01','Operação tributável com alíquota básica','Não-Cumulativo'),
('02','Operação tributável com alíquota diferenciada','Não-Cumulativo'),
('03','Operação tributável com alíquota por unidade de medida de produto','Não-Cumulativo'),
('04','Operação tributável monofásica - Revenda a alíquota zero','Ambos'),
('05','Operação tributável por substituição tributária','Não-Cumulativo'),
('06','Operação tributável a alíquota zero','Ambos'),
('07','Operação isenta da contribuição','Ambos'),
('08','Operação sem incidência da contribuição','Ambos'),
('09','Operação com suspensão da contribuição','Ambos'),
('49','Outras operações de saída','Não-Cumulativo'),
('50','Operação com direito a crédito - vinculada exclusivamente a receita tributada no mercado interno','Não-Cumulativo'),
('51','Operação com direito a crédito - vinculada exclusivamente a receita não tributada no mercado interno','Não-Cumulativo'),
('52','Operação com direito a crédito - vinculada exclusivamente a receita de exportação','Não-Cumulativo'),
('53','Operação com direito a crédito - vinculada a receitas tributadas e não-tributadas no mercado interno','Não-Cumulativo'),
('54','Operação com direito a crédito - vinculada a receitas tributadas no mercado interno e de exportação','Não-Cumulativo'),
('55','Operação com direito a crédito - vinculada a receitas não-tributadas no mercado interno e de exportação','Não-Cumulativo'),
('56','Operação com direito a crédito - vinculada a receitas tributadas e não-tributadas no mercado interno e de exportação','Não-Cumulativo'),
('60','Crédito presumido - operação de aquisição vinculada exclusivamente a receita tributada no mercado interno','Não-Cumulativo'),
('61','Crédito presumido - operação de aquisição vinculada exclusivamente a receita não-tributada no mercado interno','Não-Cumulativo'),
('62','Crédito presumido - operação de aquisição vinculada exclusivamente a receita de exportação','Não-Cumulativo'),
('63','Crédito presumido - operação de aquisição vinculada a receitas tributadas e não-tributadas no mercado interno','Não-Cumulativo'),
('64','Crédito presumido - operação de aquisição vinculada a receitas tributadas no mercado interno e de exportação','Não-Cumulativo'),
('65','Crédito presumido - operação de aquisição vinculada a receitas não-tributadas no mercado interno e de exportação','Não-Cumulativo'),
('66','Crédito presumido - operação de aquisição vinculada a receitas tributadas e não-tributadas no mercado interno e de exportação','Não-Cumulativo'),
('67','Crédito presumido - outras operações','Não-Cumulativo'),
('70','Operação de aquisição sem direito a crédito','Ambos'),
('71','Operação de aquisição com isenção','Ambos'),
('72','Operação de aquisição com suspensão','Ambos'),
('73','Operação de aquisição a alíquota zero','Ambos'),
('74','Operação de aquisição sem incidência da contribuição','Ambos'),
('75','Operação de aquisição por substituição tributária','Ambos'),
('98','Outras operações de entrada','Não-Cumulativo'),
('99','Outras operações','Ambos')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 10. ref_cst_ipi
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_cst_ipi (
  id          SERIAL PRIMARY KEY,
  codigo      VARCHAR(3)   NOT NULL UNIQUE,
  descricao   VARCHAR(200) NOT NULL,
  tipo        CHAR(1)      NOT NULL CHECK (tipo IN ('E','S')), -- E=Entrada S=Saída
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_cst_ipi IS 'CST IPI — Tabela de Código de Situação Tributária do IPI. RIPI Decreto 7.212/2010.';

INSERT INTO ref_cst_ipi (codigo, descricao, tipo) VALUES
-- Entradas
('00','Entrada com recuperação de crédito','E'),
('01','Entrada tributada com alíquota zero','E'),
('02','Entrada isenta','E'),
('03','Entrada não-tributada','E'),
('04','Entrada imune','E'),
('05','Entrada com suspensão','E'),
('49','Outras entradas','E'),
-- Saídas
('50','Saída tributada','S'),
('51','Saída tributada com alíquota zero','S'),
('52','Saída isenta','S'),
('53','Saída não-tributada','S'),
('54','Saída imune','S'),
('55','Saída com suspensão','S'),
('99','Outras saídas','S')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 11. ref_modalidades_frete
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_modalidades_frete (
  id          SERIAL PRIMARY KEY,
  codigo      CHAR(1)      NOT NULL UNIQUE,
  nome        VARCHAR(60)  NOT NULL,
  descricao   TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_modalidades_frete IS 'Modalidades de frete para NF-e — campo modFrete';

INSERT INTO ref_modalidades_frete (codigo, nome, descricao) VALUES
('0','Contratação do Frete por conta do Remetente (CIF)','O remetente/vendedor paga o frete. Risco do transporte é do vendedor até a entrega.'),
('1','Contratação do Frete por conta do Destinatário (FOB)','O destinatário/comprador paga o frete. Risco passa ao comprador na saída do estoque.'),
('2','Contratação do Frete por conta de Terceiros','Terceiro contrata e paga o frete.'),
('3','Transporte Próprio por conta do Remetente','O próprio remetente realiza o transporte com veículo próprio.'),
('4','Transporte Próprio por conta do Destinatário','O destinatário busca a mercadoria com veículo próprio.'),
('9','Sem Ocorrência de Transporte','Operação sem movimentação física de mercadoria (ex: serviços, transferência de propriedade).')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- RLS — Leitura pública para autenticados
-- ────────────────────────────────────────────────────────────
ALTER TABLE ref_regimes_tributarios      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_naturezas_juridicas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_tipos_documento_fiscal   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_cnae                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_cfop                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_ncm                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_origem_mercadoria        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_cst_icms                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_cst_pis_cofins           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_cst_ipi                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_modalidades_frete        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ref_regimes_read"      ON ref_regimes_tributarios     FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_naturezas_read"    ON ref_naturezas_juridicas     FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_tipdoc_read"       ON ref_tipos_documento_fiscal  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_cnae_read"         ON ref_cnae                    FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_cfop_read"         ON ref_cfop                    FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_ncm_read"          ON ref_ncm                     FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_origem_read"       ON ref_origem_mercadoria       FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_cst_icms_read"     ON ref_cst_icms                FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_cst_piscofins_read"ON ref_cst_pis_cofins          FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_cst_ipi_read"      ON ref_cst_ipi                 FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_modalfrete_read"   ON ref_modalidades_frete       FOR SELECT TO authenticated USING (true);
