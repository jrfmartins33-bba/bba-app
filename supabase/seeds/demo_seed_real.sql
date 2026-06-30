/*
  BBA App — Seed de Demonstração
  Arquivo: supabase/seeds/demo_seed.sql

  INSTRUÇÕES DE USO:
  1. Aplicar a migration antes deste seed:
     supabase/migrations/202506280001_bba_app_core_schema.sql

  2. Executar supabase/seeds/demo_auth_users.sql no Supabase SQL Editor.

  3. Executar este seed no Supabase SQL Editor.

     Usuarios demo:

     admin@bbabrazil.com.br  | senha: BBAadmin2025!
     carlos@carlosmendes.com.br | senha: Teste123!
     vitoria@vitoriamodas.com.br | senha: Teste123!
     ricardo@construtorahorizonte.com.br | senha: Teste123!

     IMPORTANTE: cada usuario Auth precisa usar o mesmo UUID definido
     neste seed:
     Admin:   673e0c35-5afc-4c54-a82a-0c8e63279b99
     Carlos:  d9e849b1-cd4a-4855-888c-857d8a7a6050
     Vitória: 9ff84319-08bf-4a67-975e-4a229effdf4d
     Ricardo: 30feab53-1950-4099-8699-6ea24bd71d71

  4. Os dados de demonstração estão prontos para uso.

  ATENÇÃO: Este arquivo é apenas para ambiente de
  demonstração. Nunca executar em produção com
  dados reais de clientes.

  Observação técnica:
  A tabela public.profiles referencia auth.users(id). Execute
  supabase/seeds/demo_auth_users.sql antes deste seed para garantir que
  os logins demo existam no Supabase Auth.
*/

BEGIN;

-- BLOCO 1 — PERFIS


INSERT INTO public.profiles (
  id,
  full_name,
  email,
  role,
  company_id,
  metadata,
  created_at,
  updated_at
) VALUES
  (
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    'Admin BBA',
    'admin@bbabrazil.com.br',
    'bba_admin',
    NULL,
    '{"demo": true, "cargo": "Administrador BBA"}'::jsonb,
    NOW() - INTERVAL '120 days',
    NOW() - INTERVAL '120 days'
  ),
  (
    'd9e849b1-cd4a-4855-888c-857d8a7a6050',
    'Carlos Mendes',
    'carlos@carlosmendes.com.br',
    'client',
    NULL,
    '{"demo": true, "persona": "MEI de consultoria"}'::jsonb,
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '10 days'
  ),
  (
    '9ff84319-08bf-4a67-975e-4a229effdf4d',
    'Vitória Souza',
    'vitoria@vitoriamodas.com.br',
    'client',
    NULL,
    '{"demo": true, "persona": "Varejo de moda"}'::jsonb,
    NOW() - INTERVAL '55 days',
    NOW() - INTERVAL '55 days'
  ),
  (
    '30feab53-1950-4099-8699-6ea24bd71d71',
    'Ricardo Horizonte',
    'ricardo@construtorahorizonte.com.br',
    'client',
    NULL,
    '{"demo": true, "persona": "Construção civil"}'::jsonb,
    NOW() - INTERVAL '95 days',
    NOW() - INTERVAL '95 days'
  )
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- BLOCO 2 — EMPRESAS
INSERT INTO public.companies (
  id,
  owner_id,
  name,
  cnpj,
  tax_regime,
  segment,
  main_phone,
  metadata,
  created_at,
  updated_at
) VALUES
  (
    'eeeeeeee-0000-0000-0000-000000000001',
    'd9e849b1-cd4a-4855-888c-857d8a7a6050',
    'Carlos Mendes Consultoria',
    '12345678000191',
    'mei',
    'Consultoria de TI',
    '11987650001',
    '{"demo": true, "porte": "MEI", "cidade": "São Paulo"}'::jsonb,
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    'eeeeeeee-0000-0000-0000-000000000002',
    '9ff84319-08bf-4a67-975e-4a229effdf4d',
    'Vitória Modas Ltda',
    '98765432000155',
    'simples_nacional',
    'Varejo de Moda Feminina',
    '11987650002',
    '{"demo": true, "porte": "Pequena empresa", "cidade": "São Paulo"}'::jsonb,
    NOW() - INTERVAL '55 days',
    NOW() - INTERVAL '30 days'
  ),
  (
    'eeeeeeee-0000-0000-0000-000000000003',
    '30feab53-1950-4099-8699-6ea24bd71d71',
    'Construtora Horizonte Ltda',
    '11223344000177',
    'lucro_presumido',
    'Construção Civil — Barragens e Obras Hidráulicas',
    '62987650003',
    '{"demo": true, "porte": "Média empresa", "cidade": "Goiânia"}'::jsonb,
    NOW() - INTERVAL '95 days',
    NOW() - INTERVAL '60 days'
  );

UPDATE public.profiles
SET company_id = 'eeeeeeee-0000-0000-0000-000000000001'
WHERE id = 'd9e849b1-cd4a-4855-888c-857d8a7a6050';

UPDATE public.profiles
SET company_id = 'eeeeeeee-0000-0000-0000-000000000002'
WHERE id = '9ff84319-08bf-4a67-975e-4a229effdf4d';

UPDATE public.profiles
SET company_id = 'eeeeeeee-0000-0000-0000-000000000003'
WHERE id = '30feab53-1950-4099-8699-6ea24bd71d71';

-- BLOCO 3 — ONBOARDING STEPS
INSERT INTO public.onboarding_steps (
  id,
  company_id,
  step_number,
  title,
  description,
  status,
  responsible_id,
  notes,
  completed_at,
  metadata,
  created_at,
  updated_at
) VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    'eeeeeeee-0000-0000-0000-000000000001',
    1,
    'Cadastro da empresa',
    'Conferência dos dados cadastrais básicos e enquadramento inicial.',
    'completed',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    'Dados do MEI conferidos com o cadastro da Receita Federal.',
    NOW() - INTERVAL '3 days',
    '{}'::jsonb,
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '3 days'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'eeeeeeee-0000-0000-0000-000000000001',
    2,
    'Contatos e responsáveis',
    'Validação dos canais de contato e responsável operacional.',
    'completed',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    'Carlos será o ponto focal financeiro e fiscal.',
    NOW() - INTERVAL '2 days',
    '{}'::jsonb,
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'eeeeeeee-0000-0000-0000-000000000001',
    3,
    'Envio de documentos iniciais',
    'Recebimento de comprovantes, contratos e documentação fiscal.',
    'in_progress',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    'Aguardando comprovantes de faturamento dos últimos 12 meses.',
    NULL,
    '{}'::jsonb,
    NOW() - INTERVAL '10 days',
    NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    'eeeeeeee-0000-0000-0000-000000000001',
    4,
    'Validação BBA',
    'Revisão técnica dos documentos e riscos identificados.',
    'pending',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    NULL,
    NULL,
    '{}'::jsonb,
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '10 days'
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    'eeeeeeee-0000-0000-0000-000000000001',
    5,
    'Operação assistida',
    'Acompanhamento inicial da rotina após implantação.',
    'pending',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    NULL,
    NULL,
    '{}'::jsonb,
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '10 days'
  ),
  (
    '10000000-0000-0000-0000-000000000006',
    'eeeeeeee-0000-0000-0000-000000000002',
    1,
    'Cadastro da empresa',
    'Conferência cadastral e tributária da empresa.',
    'completed',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    'Contrato social e CNPJ validados.',
    NOW() - INTERVAL '45 days',
    '{}'::jsonb,
    NOW() - INTERVAL '55 days',
    NOW() - INTERVAL '45 days'
  ),
  (
    '10000000-0000-0000-0000-000000000007',
    'eeeeeeee-0000-0000-0000-000000000002',
    2,
    'Contatos e responsáveis',
    'Definição de responsáveis por financeiro, loja e RH.',
    'completed',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    'Vitória centraliza aprovações financeiras.',
    NOW() - INTERVAL '42 days',
    '{}'::jsonb,
    NOW() - INTERVAL '55 days',
    NOW() - INTERVAL '42 days'
  ),
  (
    '10000000-0000-0000-0000-000000000008',
    'eeeeeeee-0000-0000-0000-000000000002',
    3,
    'Envio de documentos iniciais',
    'Upload de extratos, folha, certificados e contratos.',
    'completed',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    'Documentos de maio e junho recebidos.',
    NOW() - INTERVAL '38 days',
    '{}'::jsonb,
    NOW() - INTERVAL '55 days',
    NOW() - INTERVAL '38 days'
  ),
  (
    '10000000-0000-0000-0000-000000000009',
    'eeeeeeee-0000-0000-0000-000000000002',
    4,
    'Validação BBA',
    'Validação de inconsistências fiscais, financeiras e trabalhistas.',
    'completed',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    'Foram identificados ajustes de conciliação bancária.',
    NOW() - INTERVAL '34 days',
    '{}'::jsonb,
    NOW() - INTERVAL '55 days',
    NOW() - INTERVAL '34 days'
  ),
  (
    '10000000-0000-0000-0000-000000000010',
    'eeeeeeee-0000-0000-0000-000000000002',
    5,
    'Operação assistida',
    'Acompanhamento das primeiras rotinas com a equipe BBA.',
    'completed',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    'Operação mensal estabilizada.',
    NOW() - INTERVAL '30 days',
    '{}'::jsonb,
    NOW() - INTERVAL '55 days',
    NOW() - INTERVAL '30 days'
  ),
  (
    '10000000-0000-0000-0000-000000000011',
    'eeeeeeee-0000-0000-0000-000000000003',
    1,
    'Cadastro da empresa',
    'Validação cadastral e societária da construtora.',
    'completed',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    'Estrutura societária revisada para contratos públicos.',
    NOW() - INTERVAL '90 days',
    '{}'::jsonb,
    NOW() - INTERVAL '95 days',
    NOW() - INTERVAL '90 days'
  ),
  (
    '10000000-0000-0000-0000-000000000012',
    'eeeeeeee-0000-0000-0000-000000000003',
    2,
    'Contatos e responsáveis',
    'Mapeamento de responsáveis por obra, fiscal, financeiro e jurídico.',
    'completed',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    'Ricardo centraliza decisões executivas.',
    NOW() - INTERVAL '82 days',
    '{}'::jsonb,
    NOW() - INTERVAL '95 days',
    NOW() - INTERVAL '82 days'
  ),
  (
    '10000000-0000-0000-0000-000000000013',
    'eeeeeeee-0000-0000-0000-000000000003',
    3,
    'Envio de documentos iniciais',
    'Recebimento de contratos, medições, ARTs e certidões.',
    'completed',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    'Contratos federais e ARTs iniciais recebidos.',
    NOW() - INTERVAL '75 days',
    '{}'::jsonb,
    NOW() - INTERVAL '95 days',
    NOW() - INTERVAL '75 days'
  ),
  (
    '10000000-0000-0000-0000-000000000014',
    'eeeeeeee-0000-0000-0000-000000000003',
    4,
    'Validação BBA',
    'Análise de riscos tributários, trabalhistas e de governança.',
    'completed',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    'Risco de ISS intermunicipal mapeado para acompanhamento.',
    NOW() - INTERVAL '68 days',
    '{}'::jsonb,
    NOW() - INTERVAL '95 days',
    NOW() - INTERVAL '68 days'
  ),
  (
    '10000000-0000-0000-0000-000000000015',
    'eeeeeeee-0000-0000-0000-000000000003',
    5,
    'Operação assistida',
    'Acompanhamento de rotinas mensais e controles de obra.',
    'completed',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    'Rotina implantada com relatórios mensais de obra.',
    NOW() - INTERVAL '60 days',
    '{}'::jsonb,
    NOW() - INTERVAL '95 days',
    NOW() - INTERVAL '60 days'
  );

-- BLOCO 4 — PROJETOS
INSERT INTO public.projects (
  id,
  company_id,
  name,
  description,
  area,
  status,
  responsible_id,
  due_date,
  metadata,
  created_at,
  updated_at
) VALUES
  (
    '20000000-0000-0000-0000-000000000001',
    'eeeeeeee-0000-0000-0000-000000000001',
    'Organização Fiscal e Digital',
    'Estruturação fiscal, emissão de NF e organização dos processos digitais do MEI.',
    'fiscal',
    'active',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    NULL,
    '{"demo": true}'::jsonb,
    NOW() - INTERVAL '9 days',
    NOW()
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'eeeeeeee-0000-0000-0000-000000000002',
    'Reestruturação Financeira',
    'Organização do fluxo de caixa, conciliação bancária e controle de margem.',
    'financeiro',
    'active',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    NULL,
    '{"demo": true}'::jsonb,
    NOW() - INTERVAL '29 days',
    NOW()
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    'eeeeeeee-0000-0000-0000-000000000002',
    'Gestão de Equipe e RH',
    'Estruturação de processos de RH, controle de ponto e folha de pagamento.',
    'rh',
    'active',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    NULL,
    '{"demo": true}'::jsonb,
    NOW() - INTERVAL '28 days',
    NOW()
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    'eeeeeeee-0000-0000-0000-000000000003',
    'Barragem Rio das Pedras — Fase 3',
    'Execução da terceira fase da barragem Rio das Pedras. Contrato DNOCS vigente. Medições mensais e emissão de NFs de medição.',
    'fiscal',
    'active',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    CURRENT_DATE + 90,
    '{"demo": true, "contrato": "DNOCS"}'::jsonb,
    NOW() - INTERVAL '59 days',
    NOW()
  ),
  (
    '20000000-0000-0000-0000-000000000005',
    'eeeeeeee-0000-0000-0000-000000000003',
    'Licitação PCH Cachoeira Dourada',
    'Participação em leilão eletrônico ANEEL para concessão da PCH Cachoeira Dourada. Prazo de habilitação: 30 dias.',
    'governanca',
    'active',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    CURRENT_DATE + 30,
    '{"demo": true, "orgao": "ANEEL"}'::jsonb,
    NOW() - INTERVAL '20 days',
    NOW()
  );

-- BLOCO 5 — TAREFAS
INSERT INTO public.tasks (
  id,
  company_id,
  project_id,
  title,
  description,
  status,
  priority,
  area,
  tag,
  due_date,
  attachments_count,
  created_by,
  assigned_to,
  metadata,
  created_at,
  updated_at
) VALUES
  (
    '30000000-0000-0000-0000-000000000001',
    'eeeeeeee-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'Emitir NF de serviço — cliente Accenture',
    'Emitir nota fiscal referente ao serviço de consultoria entregue no ciclo atual.',
    'todo',
    'high',
    'fiscal',
    'Nota fiscal',
    CURRENT_DATE + 3,
    0,
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '{}'::jsonb,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    'eeeeeeee-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'Organizar documentos para DASN-SIMEI',
    'Separar receitas, comprovantes e relatórios mensais para declaração anual do MEI.',
    'in_progress',
    'high',
    'fiscal',
    'DASN-SIMEI',
    CURRENT_DATE + 7,
    1,
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '{}'::jsonb,
    NOW() - INTERVAL '2 days',
    NOW()
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    'eeeeeeee-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'Atualizar dados bancários no cadastro',
    'Confirmar banco, agência, conta e chave Pix usada para recebimentos.',
    'todo',
    'medium',
    'financeiro',
    'Cadastro bancário',
    NULL,
    0,
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '{}'::jsonb,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ),
  (
    '30000000-0000-0000-0000-000000000004',
    'eeeeeeee-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'Enviar contrato de prestação de serviço',
    'Enviar contrato atualizado com escopo, prazo e valores do cliente principal.',
    'todo',
    'medium',
    'governanca',
    'Contrato',
    NULL,
    0,
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '{}'::jsonb,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ),
  (
    '30000000-0000-0000-0000-000000000005',
    'eeeeeeee-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'Configurar backup em nuvem dos documentos',
    'Criar pasta organizada para notas fiscais, contratos e comprovantes mensais.',
    'todo',
    'low',
    'ti',
    'Arquivos digitais',
    NULL,
    0,
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '{}'::jsonb,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ),
  (
    '30000000-0000-0000-0000-000000000006',
    'eeeeeeee-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'Conciliação bancária — junho/2025',
    'Conferir extratos, vendas em cartão e pagamentos de fornecedores do mês.',
    'in_progress',
    'high',
    'financeiro',
    'Conciliação',
    CURRENT_DATE + 5,
    2,
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '{}'::jsonb,
    NOW() - INTERVAL '4 days',
    NOW()
  ),
  (
    '30000000-0000-0000-0000-000000000007',
    'eeeeeeee-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'Apuração do Simples Nacional — junho',
    'Calcular DAS do mês com base no faturamento do varejo e vendas online.',
    'todo',
    'high',
    'fiscal',
    'Simples Nacional',
    CURRENT_DATE + 7,
    0,
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '{}'::jsonb,
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days'
  ),
  (
    '30000000-0000-0000-0000-000000000008',
    'eeeeeeee-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000003',
    'Folha de pagamento — junho/2025',
    'Fechamento da folha mensal das equipes de loja e administrativo.',
    'done',
    'high',
    'rh',
    'Folha',
    NULL,
    1,
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '{}'::jsonb,
    NOW() - INTERVAL '12 days',
    NOW() - INTERVAL '5 days'
  ),
  (
    '30000000-0000-0000-0000-000000000009',
    'eeeeeeee-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'Revisar contrato de fornecedor — Tecidos Sul',
    'Revisar prazo de pagamento, multa por atraso e condições de troca de mercadoria.',
    'todo',
    'medium',
    'governanca',
    'Contrato fornecedor',
    NULL,
    0,
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '{}'::jsonb,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    '30000000-0000-0000-0000-000000000010',
    'eeeeeeee-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000003',
    'Cadastrar nova vendedora no sistema',
    'Cadastrar colaboradora, jornada, função e dados bancários para folha.',
    'in_progress',
    'medium',
    'rh',
    'Admissão',
    NULL,
    0,
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '{}'::jsonb,
    NOW() - INTERVAL '2 days',
    NOW()
  ),
  (
    '30000000-0000-0000-0000-000000000011',
    'eeeeeeee-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'Relatório de margem por produto — maio',
    'Apurar margem por categoria para orientar compra de coleção do próximo mês.',
    'done',
    'medium',
    'financeiro',
    'Margem',
    NULL,
    1,
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '{}'::jsonb,
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '8 days'
  ),
  (
    '30000000-0000-0000-0000-000000000012',
    'eeeeeeee-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'Atualizar certificado digital A1',
    'Renovar certificado antes do vencimento para evitar interrupção na emissão fiscal.',
    'todo',
    'high',
    'ti',
    'Certificado digital',
    CURRENT_DATE + 10,
    0,
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '{}'::jsonb,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    '30000000-0000-0000-0000-000000000013',
    'eeeeeeee-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000003',
    'Revisar política de troca e devolução',
    'Adequar política comercial da loja às regras de atendimento e garantia.',
    'todo',
    'low',
    'governanca',
    'Política comercial',
    NULL,
    0,
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '{}'::jsonb,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ),
  (
    '30000000-0000-0000-0000-000000000014',
    'eeeeeeee-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000004',
    'Emissão de NFs de medição — Contrato DNOCS Etapa 7',
    'Emitir notas fiscais referentes à medição parcial da etapa 7 da Barragem Rio das Pedras. Valor aproximado: R$ 2.340.000,00.',
    'todo',
    'urgent',
    'fiscal',
    'DNOCS',
    CURRENT_DATE + 2,
    3,
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '{"contrato": "DNOCS Etapa 7"}'::jsonb,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ),
  (
    '30000000-0000-0000-0000-000000000015',
    'eeeeeeee-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000004',
    'Retenção de ISS — obra intermunicipal',
    'Verificar alíquota de ISS aplicável para obra executada em município diferente da sede. Risco de autuação identificado.',
    'in_progress',
    'high',
    'fiscal',
    'ISS',
    CURRENT_DATE + 5,
    2,
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '{"risco": "autuação fiscal"}'::jsonb,
    NOW() - INTERVAL '2 days',
    NOW()
  ),
  (
    '30000000-0000-0000-0000-000000000016',
    'eeeeeeee-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000004',
    'Validação de ART junto ao CREA-GO',
    'Confirmar validade da ART vinculada à frente de execução da barragem.',
    'todo',
    'high',
    'fiscal',
    'CREA-GO',
    CURRENT_DATE + 7,
    1,
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '{}'::jsonb,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ),
  (
    '30000000-0000-0000-0000-000000000017',
    'eeeeeeee-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000004',
    'Conferência de medição parcial — Etapa 7',
    'Conferir boletim de medição físico versus cronograma financeiro aprovado. Divergência identificada de R$ 87.000,00.',
    'in_progress',
    'urgent',
    'financeiro',
    'Medição',
    CURRENT_DATE + 3,
    4,
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '{"divergencia": 87000}'::jsonb,
    NOW() - INTERVAL '3 days',
    NOW()
  ),
  (
    '30000000-0000-0000-0000-000000000018',
    'eeeeeeee-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000004',
    'Relatório de avanço físico-financeiro — junho/2025',
    'Elaborar relatório mensal de avanço para envio ao financiador Caixa Econômica Federal. Prazo contratual improrrogável.',
    'todo',
    'high',
    'financeiro',
    'Relatório CEF',
    CURRENT_DATE + 5,
    2,
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '{"financiador": "Caixa Econômica Federal"}'::jsonb,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    '30000000-0000-0000-0000-000000000019',
    'eeeeeeee-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000004',
    'Revisão de cronograma de desembolso — contrato federal',
    'Revisar marcos financeiros, medições previstas e liberações de recursos.',
    'todo',
    'high',
    'financeiro',
    'Contrato federal',
    CURRENT_DATE + 15,
    1,
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '{}'::jsonb,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ),
  (
    '30000000-0000-0000-0000-000000000020',
    'eeeeeeee-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000004',
    'Provisão de INSS sobre empreitada — junho',
    'Provisionamento concluído sobre contratos de empreitada do mês.',
    'done',
    'high',
    'financeiro',
    'INSS',
    NULL,
    1,
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '{}'::jsonb,
    NOW() - INTERVAL '12 days',
    NOW() - INTERVAL '6 days'
  ),
  (
    '30000000-0000-0000-0000-000000000021',
    'eeeeeeee-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000004',
    'Integração de 3 operadores de escavadeira — Rio das Pedras',
    'Admissão e integração de operadores para reforço na frente de escavação. NR-18 obrigatória antes do início.',
    'in_progress',
    'high',
    'rh',
    'Admissão obra',
    CURRENT_DATE + 4,
    2,
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '{"quantidade_operadores": 3}'::jsonb,
    NOW() - INTERVAL '3 days',
    NOW()
  ),
  (
    '30000000-0000-0000-0000-000000000022',
    'eeeeeeee-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000004',
    'Renovação de NR-18 — equipe de campo',
    'Certificação NR-18 vencida para 8 colaboradores. Obra parada em caso de fiscalização.',
    'todo',
    'urgent',
    'rh',
    'NR-18',
    CURRENT_DATE + 3,
    0,
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '{"colaboradores_pendentes": 8}'::jsonb,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ),
  (
    '30000000-0000-0000-0000-000000000023',
    'eeeeeeee-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000004',
    'Controle de horas extras — turno noturno semana 24',
    'Conferência de horas extras do turno noturno finalizada e conciliada com folha.',
    'done',
    'medium',
    'rh',
    'Horas extras',
    NULL,
    1,
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '{}'::jsonb,
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '4 days'
  ),
  (
    '30000000-0000-0000-0000-000000000024',
    'eeeeeeee-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000004',
    'Configuração de acesso remoto — escritório de campo',
    'Implantar VPN para acesso seguro aos sistemas da sede a partir do canteiro de obras.',
    'in_progress',
    'medium',
    'ti',
    'VPN',
    NULL,
    0,
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '{}'::jsonb,
    NOW() - INTERVAL '5 days',
    NOW()
  ),
  (
    '30000000-0000-0000-0000-000000000025',
    'eeeeeeee-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000004',
    'Backup de documentação técnica da obra',
    'Garantir cópia segura de plantas, medições, ARTs e relatórios de campo.',
    'todo',
    'high',
    'ti',
    'Backup',
    CURRENT_DATE + 7,
    0,
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '{}'::jsonb,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    '30000000-0000-0000-0000-000000000026',
    'eeeeeeee-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000005',
    'Preparação de documentação — leilão eletrônico ANEEL',
    'Organizar habilitação jurídica, técnica e econômico-financeira para participação no leilão eletrônico de concessão da PCH Cachoeira Dourada. Prazo fatal: 30 dias.',
    'in_progress',
    'urgent',
    'governanca',
    'Leilão ANEEL',
    CURRENT_DATE + 10,
    3,
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '{"prazo_habilitacao_dias": 30}'::jsonb,
    NOW() - INTERVAL '4 days',
    NOW()
  ),
  (
    '30000000-0000-0000-0000-000000000027',
    'eeeeeeee-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000005',
    'Revisão de compliance — Lei 14.133/2021',
    'Adequar processos de contratação à nova Lei de Licitações e Contratos Administrativos. Obrigatório para renovação de contratos federais.',
    'todo',
    'high',
    'governanca',
    'Compliance',
    CURRENT_DATE + 20,
    1,
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    '{"lei": "14.133/2021"}'::jsonb,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  );

-- BLOCO 6 — CANAIS DE CHAT
INSERT INTO public.chat_channels (
  id,
  company_id,
  name,
  area,
  created_at,
  updated_at
) VALUES
  (
    '40000000-0000-0000-0000-000000000001',
    'eeeeeeee-0000-0000-0000-000000000001',
    'Fiscal — Carlos Mendes Consultoria',
    'fiscal',
    NOW() - INTERVAL '9 days',
    NOW() - INTERVAL '9 days'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    'eeeeeeee-0000-0000-0000-000000000001',
    'Financeiro — Carlos Mendes Consultoria',
    'financeiro',
    NOW() - INTERVAL '9 days',
    NOW() - INTERVAL '9 days'
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    'eeeeeeee-0000-0000-0000-000000000001',
    'RH — Carlos Mendes Consultoria',
    'rh',
    NOW() - INTERVAL '9 days',
    NOW() - INTERVAL '9 days'
  ),
  (
    '40000000-0000-0000-0000-000000000004',
    'eeeeeeee-0000-0000-0000-000000000001',
    'TI — Carlos Mendes Consultoria',
    'ti',
    NOW() - INTERVAL '9 days',
    NOW() - INTERVAL '9 days'
  ),
  (
    '40000000-0000-0000-0000-000000000005',
    'eeeeeeee-0000-0000-0000-000000000001',
    'Governança — Carlos Mendes Consultoria',
    'governanca',
    NOW() - INTERVAL '9 days',
    NOW() - INTERVAL '9 days'
  ),
  (
    '40000000-0000-0000-0000-000000000006',
    'eeeeeeee-0000-0000-0000-000000000002',
    'Fiscal — Vitória Modas Ltda',
    'fiscal',
    NOW() - INTERVAL '29 days',
    NOW() - INTERVAL '29 days'
  ),
  (
    '40000000-0000-0000-0000-000000000007',
    'eeeeeeee-0000-0000-0000-000000000002',
    'Financeiro — Vitória Modas Ltda',
    'financeiro',
    NOW() - INTERVAL '29 days',
    NOW() - INTERVAL '29 days'
  ),
  (
    '40000000-0000-0000-0000-000000000008',
    'eeeeeeee-0000-0000-0000-000000000002',
    'RH — Vitória Modas Ltda',
    'rh',
    NOW() - INTERVAL '29 days',
    NOW() - INTERVAL '29 days'
  ),
  (
    '40000000-0000-0000-0000-000000000009',
    'eeeeeeee-0000-0000-0000-000000000002',
    'TI — Vitória Modas Ltda',
    'ti',
    NOW() - INTERVAL '29 days',
    NOW() - INTERVAL '29 days'
  ),
  (
    '40000000-0000-0000-0000-000000000010',
    'eeeeeeee-0000-0000-0000-000000000002',
    'Governança — Vitória Modas Ltda',
    'governanca',
    NOW() - INTERVAL '29 days',
    NOW() - INTERVAL '29 days'
  ),
  (
    '40000000-0000-0000-0000-000000000011',
    'eeeeeeee-0000-0000-0000-000000000003',
    'Fiscal — Construtora Horizonte Ltda',
    'fiscal',
    NOW() - INTERVAL '59 days',
    NOW() - INTERVAL '59 days'
  ),
  (
    '40000000-0000-0000-0000-000000000012',
    'eeeeeeee-0000-0000-0000-000000000003',
    'Financeiro — Construtora Horizonte Ltda',
    'financeiro',
    NOW() - INTERVAL '59 days',
    NOW() - INTERVAL '59 days'
  ),
  (
    '40000000-0000-0000-0000-000000000013',
    'eeeeeeee-0000-0000-0000-000000000003',
    'RH — Construtora Horizonte Ltda',
    'rh',
    NOW() - INTERVAL '59 days',
    NOW() - INTERVAL '59 days'
  ),
  (
    '40000000-0000-0000-0000-000000000014',
    'eeeeeeee-0000-0000-0000-000000000003',
    'TI — Construtora Horizonte Ltda',
    'ti',
    NOW() - INTERVAL '59 days',
    NOW() - INTERVAL '59 days'
  ),
  (
    '40000000-0000-0000-0000-000000000015',
    'eeeeeeee-0000-0000-0000-000000000003',
    'Governança — Construtora Horizonte Ltda',
    'governanca',
    NOW() - INTERVAL '59 days',
    NOW() - INTERVAL '59 days'
  );

-- BLOCO 7 — MENSAGENS DE CHAT
INSERT INTO public.chat_messages (
  id,
  channel_id,
  sender_id,
  body,
  created_at
) VALUES
  (
    '50000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    'Carlos, bom dia! Precisamos que você nos envie o comprovante de faturamento dos últimos 12 meses para darmos andamento ao cadastro fiscal.',
    NOW() - INTERVAL '2 days 5 hours'
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000001',
    'd9e849b1-cd4a-4855-888c-857d8a7a6050',
    'Bom dia! Vou separar e envio até amanhã. Posso enviar por aqui mesmo?',
    NOW() - INTERVAL '2 days 4 hours 42 minutes'
  ),
  (
    '50000000-0000-0000-0000-000000000003',
    '40000000-0000-0000-0000-000000000001',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    'Pode sim! Pode anexar direto na conversa. Qualquer dúvida estamos aqui.',
    NOW() - INTERVAL '2 days 4 hours 30 minutes'
  ),
  (
    '50000000-0000-0000-0000-000000000004',
    '40000000-0000-0000-0000-000000000007',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    'Vitória, a conciliação bancária de maio ficou com uma diferença de R$ 1.240,00 a identificar. Você tem algum lançamento fora do sistema?',
    NOW() - INTERVAL '6 days 3 hours'
  ),
  (
    '50000000-0000-0000-0000-000000000005',
    '40000000-0000-0000-0000-000000000007',
    '9ff84319-08bf-4a67-975e-4a229effdf4d',
    'Deixa eu verificar. Acho que foi uma compra de mercadoria que paguei direto no débito e não registrei.',
    NOW() - INTERVAL '6 days 2 hours 20 minutes'
  ),
  (
    '50000000-0000-0000-0000-000000000006',
    '40000000-0000-0000-0000-000000000007',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    'Provavelmente isso mesmo. Quando confirmar me passa o valor e a data que a gente ajusta.',
    NOW() - INTERVAL '6 days 2 hours'
  ),
  (
    '50000000-0000-0000-0000-000000000007',
    '40000000-0000-0000-0000-000000000007',
    '9ff84319-08bf-4a67-975e-4a229effdf4d',
    'Confirmado! Foi R$ 1.240,00 em 15/05. Compra de malhas — fornecedor Tecidos Sul.',
    NOW() - INTERVAL '5 days 7 hours'
  ),
  (
    '50000000-0000-0000-0000-000000000008',
    '40000000-0000-0000-0000-000000000011',
    '30feab53-1950-4099-8699-6ea24bd71d71',
    'Boa tarde equipe BBA. Temos dúvida sobre a retenção de INSS na nota fiscal da medição da etapa 7. O contrato é de empreitada mista. Qual alíquota aplicar?',
    NOW() - INTERVAL '3 days 6 hours'
  ),
  (
    '50000000-0000-0000-0000-000000000009',
    '40000000-0000-0000-0000-000000000011',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    'Ricardo, boa tarde! Em contratos de empreitada mista (material + mão de obra), a retenção previdenciária incide sobre 50% do valor bruto da NF, à alíquota de 11%. Vamos preparar um memorando técnico para documentar.',
    NOW() - INTERVAL '3 days 5 hours 30 minutes'
  ),
  (
    '50000000-0000-0000-0000-000000000010',
    '40000000-0000-0000-0000-000000000011',
    '30feab53-1950-4099-8699-6ea24bd71d71',
    'Perfeito. E o ISS? A obra é em outro município.',
    NOW() - INTERVAL '3 days 5 hours 10 minutes'
  ),
  (
    '50000000-0000-0000-0000-000000000011',
    '40000000-0000-0000-0000-000000000011',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    'Para ISS em obra fora da sede, o recolhimento é para o município onde a obra é executada. Já estamos verificando a alíquota local. Retorno até amanhã com o valor exato.',
    NOW() - INTERVAL '3 days 4 hours 45 minutes'
  ),
  (
    '50000000-0000-0000-0000-000000000012',
    '40000000-0000-0000-0000-000000000012',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    'Ricardo, identificamos uma divergência de R$ 87.000,00 entre o boletim de medição físico e o cronograma financeiro da etapa 7. Precisamos alinhar antes de emitir a NF.',
    NOW() - INTERVAL '1 day 6 hours'
  ),
  (
    '50000000-0000-0000-0000-000000000013',
    '40000000-0000-0000-0000-000000000012',
    '30feab53-1950-4099-8699-6ea24bd71d71',
    'Essa diferença é referente ao aditivo de prazo que foi aprovado semana passada. O engenheiro vai atualizar o boletim hoje.',
    NOW() - INTERVAL '1 day 5 hours 25 minutes'
  ),
  (
    '50000000-0000-0000-0000-000000000014',
    '40000000-0000-0000-0000-000000000012',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    'Entendido. Assim que o boletim for atualizado nos envie para conferência final antes da emissão. Prazo da NF é para depois de amanhã.',
    NOW() - INTERVAL '1 day 5 hours'
  ),
  (
    '50000000-0000-0000-0000-000000000015',
    '40000000-0000-0000-0000-000000000015',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    'Ricardo, iniciamos o levantamento dos documentos necessários para habilitação no leilão ANEEL da PCH Cachoeira Dourada. Precisamos de: 1. Balanço patrimonial dos últimos 3 exercícios 2. Certidões negativas atualizadas (federal, estadual, municipal e FGTS) 3. Atestado de capacidade técnica em obras hidrelétricas acima de 5MW.',
    NOW() - INTERVAL '8 days 4 hours'
  ),
  (
    '50000000-0000-0000-0000-000000000016',
    '40000000-0000-0000-0000-000000000015',
    '30feab53-1950-4099-8699-6ea24bd71d71',
    'Balanços eu tenho aqui. As certidões vou solicitar segunda-feira. O atestado técnico preciso confirmar com o engenheiro responsável.',
    NOW() - INTERVAL '8 days 3 hours 25 minutes'
  ),
  (
    '50000000-0000-0000-0000-000000000017',
    '40000000-0000-0000-0000-000000000015',
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    'Perfeito. Prazo para entrega da habilitação é daqui 28 dias. Vamos montar um checklist detalhado e acompanhar item a item. Você quer que eu agende uma reunião para alinhar a estratégia do leilão?',
    NOW() - INTERVAL '8 days 3 hours'
  );

COMMIT;
