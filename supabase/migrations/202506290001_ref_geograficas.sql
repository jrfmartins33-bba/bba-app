-- ============================================================
-- BBA APP — MIGRATION 202506290001
-- Tabelas de Referência Geográficas
-- Fontes: IBGE, BACEN, Receita Federal
-- Atualizado: Junho 2025
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. ref_ufs
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_ufs (
  id            SERIAL PRIMARY KEY,
  codigo_ibge   CHAR(2)      NOT NULL UNIQUE,
  sigla         CHAR(2)      NOT NULL UNIQUE,
  nome          VARCHAR(50)  NOT NULL,
  regiao        VARCHAR(20)  NOT NULL CHECK (regiao IN ('Norte','Nordeste','Centro-Oeste','Sudeste','Sul')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_ufs IS 'Unidades Federativas do Brasil — fonte IBGE';

INSERT INTO ref_ufs (codigo_ibge, sigla, nome, regiao) VALUES
('12','AC','Acre','Norte'),
('27','AL','Alagoas','Nordeste'),
('16','AP','Amapá','Norte'),
('13','AM','Amazonas','Norte'),
('29','BA','Bahia','Nordeste'),
('23','CE','Ceará','Nordeste'),
('53','DF','Distrito Federal','Centro-Oeste'),
('32','ES','Espírito Santo','Sudeste'),
('52','GO','Goiás','Centro-Oeste'),
('21','MA','Maranhão','Nordeste'),
('51','MT','Mato Grosso','Centro-Oeste'),
('50','MS','Mato Grosso do Sul','Centro-Oeste'),
('31','MG','Minas Gerais','Sudeste'),
('15','PA','Pará','Norte'),
('25','PB','Paraíba','Nordeste'),
('41','PR','Paraná','Sul'),
('26','PE','Pernambuco','Nordeste'),
('22','PI','Piauí','Nordeste'),
('33','RJ','Rio de Janeiro','Sudeste'),
('24','RN','Rio Grande do Norte','Nordeste'),
('43','RS','Rio Grande do Sul','Sul'),
('11','RO','Rondônia','Norte'),
('14','RR','Roraima','Norte'),
('42','SC','Santa Catarina','Sul'),
('35','SP','São Paulo','Sudeste'),
('28','SE','Sergipe','Nordeste'),
('17','TO','Tocantins','Norte');

-- ────────────────────────────────────────────────────────────
-- 2. ref_paises
-- Fonte: BACEN — Resolução 3.568 e tabela de países
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_paises (
  id            SERIAL PRIMARY KEY,
  codigo_bacen  CHAR(4)      NOT NULL UNIQUE,
  codigo_iso2   CHAR(2),
  codigo_iso3   CHAR(3),
  nome_pt       VARCHAR(100) NOT NULL,
  nome_en       VARCHAR(100),
  ativo         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_paises IS 'Países — fonte BACEN tabela de países e territórios';

INSERT INTO ref_paises (codigo_bacen, codigo_iso2, codigo_iso3, nome_pt, nome_en) VALUES
('1058','BR','BRA','Brasil','Brazil'),
('2496','US','USA','Estados Unidos','United States'),
('2828','PT','PRT','Portugal','Portugal'),
('0628','DE','DEU','Alemanha','Germany'),
('0132','AR','ARG','Argentina','Argentina'),
('0175','AU','AUS','Austrália','Australia'),
('0289','BE','BEL','Bélgica','Belgium'),
('0353','BO','BOL','Bolívia','Bolivia'),
('0370','GB','GBR','Reino Unido','United Kingdom'),
('0418','CA','CAN','Canadá','Canada'),
('0531','CL','CHL','Chile','Chile'),
('0590','CN','CHN','China','China'),
('0698','CO','COL','Colômbia','Colombia'),
('0744','KP','PRK','Coreia do Norte','North Korea'),
('0752','KR','KOR','Coreia do Sul','South Korea'),
('0795','CR','CRI','Costa Rica','Costa Rica'),
('0833','CU','CUB','Cuba','Cuba'),
('0884','DK','DNK','Dinamarca','Denmark'),
('0973','EC','ECU','Equador','Ecuador'),
('1015','EG','EGY','Egito','Egypt'),
('1082','SV','SLV','El Salvador','El Salvador'),
('1104','AE','ARE','Emirados Árabes Unidos','United Arab Emirates'),
('1112','ES','ESP','Espanha','Spain'),
('1155','US','USA','Estados Unidos','United States'),
('1193','ET','ETH','Etiópia','Ethiopia'),
('1279','PH','PHL','Filipinas','Philippines'),
('1310','FI','FIN','Finlândia','Finland'),
('1378','FR','FRA','França','France'),
('1457','GR','GRC','Grécia','Greece'),
('1490','GT','GTM','Guatemala','Guatemala'),
('1546','GY','GUY','Guiana','Guyana'),
('1600','HN','HND','Honduras','Honduras'),
('1635','HK','HKG','Hong Kong','Hong Kong'),
('1651','HU','HUN','Hungria','Hungary'),
('1694','IN','IND','Índia','India'),
('1732','ID','IDN','Indonésia','Indonesia'),
('1775','IR','IRN','Irã','Iran'),
('1783','IQ','IRQ','Iraque','Iraq'),
('1791','IE','IRL','Irlanda','Ireland'),
('1830','IL','ISR','Israel','Israel'),
('1872','IT','ITA','Itália','Italy'),
('1902','JP','JPN','Japão','Japan'),
('1988','MX','MEX','México','Mexico'),
('2038','NO','NOR','Noruega','Norway'),
('2100','NZ','NZL','Nova Zelândia','New Zealand'),
('2143','PA','PAN','Panamá','Panama'),
('2160','PY','PRY','Paraguai','Paraguay'),
('2194','PE','PER','Peru','Peru'),
('2240','PL','POL','Polônia','Poland'),
('2356','RU','RUS','Rússia','Russia'),
('2399','SA','SAU','Arábia Saudita','Saudi Arabia'),
('2437','SE','SWE','Suécia','Sweden'),
('2445','CH','CHE','Suíça','Switzerland'),
('2453','SR','SUR','Suriname','Suriname'),
('2461','TH','THA','Tailândia','Thailand'),
('2534','TW','TWN','Taiwan','Taiwan'),
('2550','TR','TUR','Turquia','Turkey'),
('2593','UA','UKR','Ucrânia','Ukraine'),
('2674','UY','URY','Uruguai','Uruguay'),
('2712','VE','VEN','Venezuela','Venezuela'),
('2755','VN','VNM','Vietnã','Vietnam'),
('2780','ZA','ZAF','África do Sul','South Africa');

-- ────────────────────────────────────────────────────────────
-- 3. ref_municipios
-- Fonte: IBGE — 5.570 municípios
-- Seed: principais capitais + municípios estratégicos
-- Para carga completa: usar script de importação IBGE
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_municipios (
  id            SERIAL PRIMARY KEY,
  codigo_ibge   CHAR(7)      NOT NULL UNIQUE,
  nome          VARCHAR(100) NOT NULL,
  uf_sigla      CHAR(2)      NOT NULL REFERENCES ref_ufs(sigla),
  capital       BOOLEAN      NOT NULL DEFAULT FALSE,
  ddd           VARCHAR(5),
  cep_inicio    CHAR(8),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_municipios IS 'Municípios brasileiros — fonte IBGE SIDRA. Seed com capitais + principais municípios. Carga completa via script ETL IBGE.';

CREATE INDEX IF NOT EXISTS idx_municipios_uf ON ref_municipios(uf_sigla);
CREATE INDEX IF NOT EXISTS idx_municipios_nome ON ref_municipios(nome);

-- Capitais estaduais e principais municípios
INSERT INTO ref_municipios (codigo_ibge, nome, uf_sigla, capital, ddd) VALUES
-- Capitais
('1200401','Rio Branco','AC',TRUE,'68'),
('2704302','Maceió','AL',TRUE,'82'),
('1600303','Macapá','AP',TRUE,'96'),
('1302603','Manaus','AM',TRUE,'92'),
('2927408','Salvador','BA',TRUE,'71'),
('2304400','Fortaleza','CE',TRUE,'85'),
('5300108','Brasília','DF',TRUE,'61'),
('3205309','Vitória','ES',TRUE,'27'),
('5208707','Goiânia','GO',TRUE,'62'),
('2111300','São Luís','MA',TRUE,'98'),
('5103403','Cuiabá','MT',TRUE,'65'),
('5002704','Campo Grande','MS',TRUE,'67'),
('3106200','Belo Horizonte','MG',TRUE,'31'),
('1501402','Belém','PA',TRUE,'91'),
('2507507','João Pessoa','PB',TRUE,'83'),
('4106902','Curitiba','PR',TRUE,'41'),
('2611606','Recife','PE',TRUE,'81'),
('2211001','Teresina','PI',TRUE,'86'),
('3304557','Rio de Janeiro','RJ',TRUE,'21'),
('2408102','Natal','RN',TRUE,'84'),
('4314902','Porto Alegre','RS',TRUE,'51'),
('1100205','Porto Velho','RO',TRUE,'69'),
('1400100','Boa Vista','RR',TRUE,'95'),
('4209102','Florianópolis','SC',TRUE,'48'),
('3550308','São Paulo','SP',TRUE,'11'),
('2800308','Aracaju','SE',TRUE,'79'),
('1721000','Palmas','TO',TRUE,'63'),
-- Municípios relevantes SP
('3509502','Campinas','SP',FALSE,'19'),
('3548708','Santos','SP',FALSE,'13'),
('3543402','Ribeirão Preto','SP',FALSE,'16'),
('3518800','Guarulhos','SP',FALSE,'11'),
('3529401','Mogi das Cruzes','SP',FALSE,'11'),
('3506003','Bauru','SP',FALSE,'14'),
('3534401','Osasco','SP',FALSE,'11'),
('3547809','Santo André','SP',FALSE,'11'),
('3549805','São Bernardo do Campo','SP',FALSE,'11'),
('3548500','São Caetano do Sul','SP',FALSE,'11'),
('3513801','Diadema','SP',FALSE,'11'),
('3524402','Jundiaí','SP',FALSE,'11'),
('3552205','Sorocaba','SP',FALSE,'15'),
('3501608','Americana','SP',FALSE,'19'),
-- Municípios relevantes RJ
('3301009','Angra dos Reis','RJ',FALSE,'24'),
('3303500','Nova Iguaçu','RJ',FALSE,'21'),
('3300456','Belford Roxo','RJ',FALSE,'21'),
('3303302','Niterói','RJ',FALSE,'21'),
('3303401','Nilópolis','RJ',FALSE,'21'),
('3302205','Duque de Caxias','RJ',FALSE,'21'),
-- Municípios relevantes MG
('3170206','Uberlândia','MG',FALSE,'34'),
('3119401','Contagem','MG',FALSE,'31'),
('3118601','Betim','MG',FALSE,'31'),
('3143302','Montes Claros','MG',FALSE,'38'),
('3136702','Juiz de Fora','MG',FALSE,'32'),
-- Municípios relevantes RS
('4309209','Gramado','RS',FALSE,'54'),
('4304606','Caxias do Sul','RS',FALSE,'54'),
('4316907','Pelotas','RS',FALSE,'53'),
('4310801','Novo Hamburgo','RS',FALSE,'51'),
('4312401','Passo Fundo','RS',FALSE,'54'),
-- Municípios relevantes SC
('4205407','Joinville','SC',FALSE,'47'),
('4202404','Blumenau','SC',FALSE,'47'),
('4213500','São José','SC',FALSE,'48'),
-- Municípios relevantes PR
('4115200','Londrina','PR',FALSE,'43'),
('4113700','Maringá','PR',FALSE,'44'),
('4104808','Cascavel','PR',FALSE,'45'),
-- Municípios relevantes BA
('2910800','Feira de Santana','BA',FALSE,'75'),
('2927606','Vitória da Conquista','BA',FALSE,'77'),
('2908606','Camaçari','BA',FALSE,'71'),
-- Municípios relevantes CE
('2307650','Caucaia','CE',FALSE,'85'),
('2304659','Juazeiro do Norte','CE',FALSE,'88'),
-- Municípios relevantes PE
('2604106','Caruaru','PE',FALSE,'81'),
('2611101','Olinda','PE',FALSE,'81'),
-- Municípios relevantes GO
('5201405','Anápolis','GO',FALSE,'62'),
('5208004','Aparecida de Goiânia','GO',FALSE,'62'),
-- Municípios relevantes AM
('1301902','Parintins','AM',FALSE,'92'),
-- Municípios relevantes PA
('1505502','Santarém','PA',FALSE,'93'),
('1508100','Marabá','PA',FALSE,'94'),
-- Municípios relevantes MA
('2105302','Imperatriz','MA',FALSE,'99'),
-- Municípios relevantes MT
('5107602','Rondonópolis','MT',FALSE,'66'),
('5106752','Sinop','MT',FALSE,'66');

-- ────────────────────────────────────────────────────────────
-- 4. ref_bancos
-- Fonte: BACEN — lista de participantes STR/ISPB
-- Atualizado: 2025
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_bancos (
  id            SERIAL PRIMARY KEY,
  codigo_compe  CHAR(3)      UNIQUE,
  ispb          CHAR(8)      UNIQUE,
  nome          VARCHAR(100) NOT NULL,
  nome_curto    VARCHAR(30),
  tipo          VARCHAR(30)  CHECK (tipo IN ('Banco Comercial','Banco Múltiplo','Caixa Econômica','Cooperativa','Pagamento','Corretora','Financeira','Outro')),
  ativo         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ref_bancos IS 'Instituições financeiras — fonte BACEN ISPB/COMPE. Atualizado 2025.';

CREATE INDEX IF NOT EXISTS idx_bancos_nome ON ref_bancos(nome);

INSERT INTO ref_bancos (codigo_compe, ispb, nome, nome_curto, tipo) VALUES
('001','00000000','Banco do Brasil S.A.','BB','Banco Múltiplo'),
('003','57839805','Banco da Amazônia S.A.','BASA','Banco Múltiplo'),
('004','00360305','Banco do Nordeste do Brasil S.A.','BNB','Banco Múltiplo'),
('021','28127603','Banestes S.A. Banco do Estado do Espírito Santo','BANESTES','Banco Múltiplo'),
('025','03323840','Banco Alfa S.A.','ALFA','Banco Múltiplo'),
('033','90400888','Banco Santander (Brasil) S.A.','SANTANDER','Banco Múltiplo'),
('036','00558456','Banco Bradesco BBI S.A.','BBI','Banco Múltiplo'),
('037','04902979','Banco do Estado do Pará S.A.','BANPARÁ','Banco Múltiplo'),
('041','92702067','Banco do Estado do Rio Grande do Sul S.A.','BANRISUL','Banco Múltiplo'),
('047','13009717','Banco do Estado de Sergipe S.A.','BANESE','Banco Múltiplo'),
('062','03012230','Hipercard Banco Múltiplo S.A.','HIPERCARD','Banco Múltiplo'),
('069','00558456','Banco Crefisa S.A.','CREFISA','Banco Múltiplo'),
('070','00000208','BRB - Banco de Brasília S.A.','BRB','Banco Múltiplo'),
('077','00416968','Banco Inter S.A.','INTER','Banco Múltiplo'),
('084','02398976','Uniprime Norte do Paraná - CC Ltda','UNIPRIME','Cooperativa'),
('085','05463212','Cooperativa Central de Crédito - AILOS','AILOS','Cooperativa'),
('089','62109566','Cooperativa de Crédito Rural da Região da Mogiana','CREDISAN','Cooperativa'),
('097','04632856','Cooperativa Central de Crédito Noroeste Brasileiro Ltda','CECOOBANB','Cooperativa'),
('099','03046391','Uniprime Central - Central Interestadual de Cooperativas de Crédito Ltda','UNIPRIME CENTRAL','Cooperativa'),
('104','00360305','Caixa Econômica Federal','CEF','Caixa Econômica'),
('107','15114366','Banco Bocom BBM S.A.','BOCOM BBM','Banco Múltiplo'),
('119','10664513','Banco Western Union do Brasil S.A.','WESTERN UNION','Banco Múltiplo'),
('121','10664513','Banco Agibank S.A.','AGIBANK','Banco Múltiplo'),
('133','01027058','Cresol - Cooperativa Central de Crédito Rural com Interação Solidária','CRESOL','Cooperativa'),
('136','00315557','Unicred do Brasil','UNICRED','Cooperativa'),
('144','36947229','Bexs Banco de Câmbio S.A.','BEXS','Banco Múltiplo'),
('184','17351180','Banco Itaú BBA S.A.','ITAÚ BBA','Banco Múltiplo'),
('197','16501555','Stone Pagamentos S.A.','STONE','Pagamento'),
('208','33870163','Banco BTG Pactual S.A.','BTG PACTUAL','Banco Múltiplo'),
('212','92894922','Banco Original S.A.','ORIGINAL','Banco Múltiplo'),
('218','71027866','Banco BS2 S.A.','BS2','Banco Múltiplo'),
('224','75647891','Banco Fibra S.A.','FIBRA','Banco Múltiplo'),
('237','60746948','Banco Bradesco S.A.','BRADESCO','Banco Múltiplo'),
('241','31597552','Banco Clássico S.A.','CLÁSSICO','Banco Múltiplo'),
('243','73622748','Banco Máxima S.A.','MÁXIMA','Banco Múltiplo'),
('246','28195667','Banco ABC Brasil S.A.','ABC BRASIL','Banco Múltiplo'),
('249','61182408','Banco Investcred Unibanco S.A.','INVESTCRED','Banco Múltiplo'),
('254','14388334','Parana Banco S.A.','PARANÁ','Banco Múltiplo'),
('260','18236120','Nu Pagamentos S.A. - Nubank','NUBANK','Pagamento'),
('265','62421979','Banco Fator S.A.','FATOR','Banco Múltiplo'),
('266','90731688','Banco Cédula S.A.','CÉDULA','Banco Múltiplo'),
('269','53518684','HSBC Brasil S.A. - Banco de Investimento','HSBC','Banco Múltiplo'),
('290','80434565','PagBank - Pagseguro Internet S.A.','PAGBANK','Pagamento'),
('301','13370835','BPP Instituição de Pagamento S.A.','BPP','Pagamento'),
('318','71371686','Banco BMG S.A.','BMG','Banco Múltiplo'),
('320','07450604','China Construction Bank (Brasil) Banco Múltiplo S.A.','CCB','Banco Múltiplo'),
('336','13140088','Banco C6 S.A.','C6 BANK','Banco Múltiplo'),
('341','60701190','Itaú Unibanco S.A.','ITAÚ','Banco Múltiplo'),
('348','24074692','Banco XP S.A.','XP','Banco Múltiplo'),
('351','29030467','Órama Distribuidora de Títulos e Valores Mobiliários S.A.','ÓRAMA','Corretora'),
('352','00250699','Toro Corretora de Títulos e Valores Mobiliários S.A.','TORO','Corretora'),
('353','04814563','Santander Consumer S.A.','SANTANDER CONSUMER','Financeira'),
('355','34711506','Ótimo Sociedade de Crédito Direto S.A.','ÓTIMO','Financeira'),
('363','22896431','Socinal S.A. - Crédito, Financiamento e Investimento','SOCINAL','Financeira'),
('364','08357240','Gerencianet S.A.','EFÍ / GERENCIANET','Pagamento'),
('368','92874270','Banco CSF S.A.','CARREFOUR','Banco Múltiplo'),
('370','61190658','Banco Mizuho do Brasil S.A.','MIZUHO','Banco Múltiplo'),
('376','33853201','Banco J.P. Morgan S.A.','JP MORGAN','Banco Múltiplo'),
('380','17192451','PicPay Serviços S.A.','PICPAY','Pagamento'),
('381','60814191','Banco Mercedes-Benz do Brasil S.A.','MERCEDES','Financeira'),
('382','08200258','Fiducia Scmepp Ltda','FIDUCIA','Cooperativa'),
('383','00315557','Cooperativa de Crédito Rural de São Miguel do Oeste - SULCREDI/São Miguel','SULCREDI','Cooperativa'),
('389','17184037','Banco Mercantil do Brasil S.A.','MERCANTIL','Banco Múltiplo'),
('394','07207996','Banco Bradesco Financiamentos S.A.','BRADESCO FINANC.','Financeira'),
('396','21018182','Hub Pagamentos S.A.','HUB','Pagamento'),
('399','01522368','Kirton Bank S.A. - Banco Múltiplo','KIRTON','Banco Múltiplo'),
('403','05491313','Cora Sociedade de Crédito Direto S.A.','CORA','Financeira'),
('404','36864992','Sumup Sociedade de Crédito Direto S.A.','SUMUP','Financeira'),
('406','14388334','Accredito - Sociedade de Crédito Direto S.A.','ACCREDITO','Financeira'),
('412','28127603','Banco Capital S.A.','CAPITAL','Banco Múltiplo'),
('413','14511781','Banco BV S.A.','BV','Banco Múltiplo'),
('422','58497702','Banco Safra S.A.','SAFRA','Banco Múltiplo'),
('456','15489568','Banco MUFG Brasil S.A.','MUFG','Banco Múltiplo'),
('461','04831810','Asaas Gestão Financeira Instituição de Pagamento S.A.','ASAAS','Pagamento'),
('473','62232889','Banco Caixa Geral - Brasil S.A.','CAIXA GERAL','Banco Múltiplo'),
('477','46518205','Citibank N.A.','CITI','Banco Múltiplo'),
('479','60419645','Banco ItauBank S.A.','ITAUBANK','Banco Múltiplo'),
('487','62331228','Deutsche Bank S.A. - Banco Alemão','DEUTSCHE','Banco Múltiplo'),
('488','60814191','JPMorgan Chase Bank National Association','JPMC','Banco Múltiplo'),
('492','00558456','ING Bank N.V.','ING','Banco Múltiplo'),
('495','44189447','Banco de La Provincia de Buenos Aires','BAPRO','Banco Múltiplo'),
('505','32062580','Banco Credit Suisse (Brasil) S.A.','CREDIT SUISSE','Banco Múltiplo'),
('545','33040601','Senso Corretora de Câmbio e Valores Mobiliários S.A.','SENSO','Corretora'),
('600','59588111','Banco Luso Brasileiro S.A.','LUSO','Banco Múltiplo'),
('604','31872495','Banco Industrial do Brasil S.A.','INDUSTRIAL','Banco Múltiplo'),
('610','78626983','Banco VR S.A.','VR','Banco Múltiplo'),
('611','61820817','Banco Paulista S.A.','PAULISTA','Banco Múltiplo'),
('612','31880825','Banco Guanabara S.A.','GUANABARA','Banco Múltiplo'),
('613','60850229','Banco Omni S.A.','OMNI','Banco Múltiplo'),
('623','59588111','Banco Pan S.A.','PAN','Banco Múltiplo'),
('626','03311443','Banco Ficsa S.A.','FICSA','Banco Múltiplo'),
('630','00517645','Banco Smartbank S.A.','SMARTBANK','Banco Múltiplo'),
('633','68900810','Banco Rendimento S.A.','RENDIMENTO','Banco Múltiplo'),
('634','33526788','Banco Triângulo S.A.','TRIÂNGULO','Banco Múltiplo'),
('637','10371492','Banco Sofisa S.A.','SOFISA','Banco Múltiplo'),
('641','45246410','Banco Alvorada S.A.','ALVORADA','Banco Múltiplo'),
('643','48795256','Banco Pine S.A.','PINE','Banco Múltiplo'),
('652','62073200','Itaú Unibanco Holding S.A.','ITAÚ HOLDING','Banco Múltiplo'),
('653','61033106','Banco Indusval S.A.','INDUSVAL','Banco Múltiplo'),
('654','92559830','Banco A.J. Renner S.A.','RENNER','Banco Múltiplo'),
('655','07450604','Banco Votorantim S.A.','VOTORANTIM','Banco Múltiplo'),
('707','01023570','Banco Daycoval S.A.','DAYCOVAL','Banco Múltiplo'),
('712','00997185','Banco Ourinvest S.A.','OURINVEST','Banco Múltiplo'),
('719','20251847','Banco Cooperativo do Brasil S.A. - BANCOOB','SICOOB','Banco Múltiplo'),
('720','08771037','Banco RNX S.A.','RNX','Banco Múltiplo'),
('724','90400888','Banco Porto Seguro S.A.','PORTO SEGURO','Banco Múltiplo'),
('725','28127603','Banco CR2 S.A.','CR2','Banco Múltiplo'),
('726','02318507','Banco XP S.A. (antigo)','XP ANTIGO','Banco Múltiplo'),
('731','16944141','Banco ABC Brasil S.A. (filial)','ABC','Banco Múltiplo'),
('735','43180355','Banco Neon S.A.','NEON','Banco Múltiplo'),
('739','23862762','Banco Cetelem S.A.','CETELEM','Banco Múltiplo'),
('741','00517645','Banco Ribeirão Preto S.A.','RIBEIRÃO PRETO','Banco Múltiplo'),
('743','78632767','Banco Semear S.A.','SEMEAR','Banco Múltiplo'),
('745','06271464','Banco Citibank S.A.','CITIBANK','Banco Múltiplo'),
('746','00997185','Banco Modal S.A.','MODAL','Banco Múltiplo'),
('747','01234570','Banco Rabobank International Brasil S.A.','RABOBANK','Banco Múltiplo'),
('748','01181521','Sicredi - Banco Cooperativo do Sicredi S.A.','SICREDI','Banco Múltiplo'),
('751','29030467','Scotiabank Brasil S.A. Banco Múltiplo','SCOTIABANK','Banco Múltiplo'),
('752','01522368','Banco BNP Paribas Brasil S.A.','BNP PARIBAS','Banco Múltiplo'),
('753','74828799','Novo Banco Continental S.A. - Banco Múltiplo','NBC','Banco Múltiplo'),
('754','76543115','Banco Sistema S.A.','SISTEMA','Banco Múltiplo'),
('755','62073200','Bank of America Merrill Lynch Banco Múltiplo S.A.','BOFA','Banco Múltiplo'),
('756','02038232','Banco Cooperativo Sicredi S.A.','SICREDI COOP','Banco Múltiplo'),
('757','21040036','Banco Keb Hana do Brasil S.A.','KEB HANA','Banco Múltiplo'),
('085','05463212','Cooperativa Central de Crédito - AILOS','AILOS','Cooperativa')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- RLS — Tabelas de referência: leitura pública para autenticados
-- ────────────────────────────────────────────────────────────
ALTER TABLE ref_ufs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_paises      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_municipios  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_bancos      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ref_ufs_read"        ON ref_ufs        FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_paises_read"     ON ref_paises     FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_municipios_read" ON ref_municipios  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_bancos_read"     ON ref_bancos      FOR SELECT TO authenticated USING (true);
