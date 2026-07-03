-- Validação estrutural de integridade SEC-03

-- 1. Empresas sem owner
SELECT id, name
FROM public.companies
WHERE owner_id IS NULL;

-- 2. Clientes sem company
SELECT id, full_name, role
FROM public.profiles
WHERE role = 'client' AND company_id IS NULL;

-- 3. account_owner_id apontando para não-admin
SELECT c.id, c.name, c.account_owner_id, p.role
FROM public.companies c
LEFT JOIN public.profiles p ON p.id = c.account_owner_id
WHERE c.account_owner_id IS NOT NULL
  AND (p.id IS NULL OR p.role <> 'bba_admin');

-- 4. Registros financeiros sem tenant
SELECT 'financial_contas' AS table_name, id
FROM public.financial_contas
WHERE company_id IS NULL
UNION ALL
SELECT 'financial_lancamentos', id FROM public.financial_lancamentos WHERE company_id IS NULL
UNION ALL
SELECT 'financial_cobrancas', id FROM public.financial_cobrancas WHERE company_id IS NULL;

-- 5. Registros fiscais/RH/societário sem tenant
SELECT 'fiscal_guias', id FROM public.fiscal_guias WHERE company_id IS NULL
UNION ALL
SELECT 'fiscal_notas_fiscais', id FROM public.fiscal_notas_fiscais WHERE company_id IS NULL
UNION ALL
SELECT 'fiscal_parcelamentos', id FROM public.fiscal_parcelamentos WHERE company_id IS NULL
UNION ALL
SELECT 'rh_funcionarios', id FROM public.rh_funcionarios WHERE company_id IS NULL
UNION ALL
SELECT 'rh_folha_pagamentos', id FROM public.rh_folha_pagamentos WHERE company_id IS NULL
UNION ALL
SELECT 'client_socios', id FROM public.client_socios WHERE company_id IS NULL;

-- 6. Valores monetários inválidos
SELECT 'financial_lancamentos' AS table_name, id, valor
FROM public.financial_lancamentos WHERE valor <= 0
UNION ALL
SELECT 'fiscal_guias', id, valor_principal FROM public.fiscal_guias WHERE valor_principal < 0
UNION ALL
SELECT 'rh_folha_pagamentos', id, salario_bruto FROM public.rh_folha_pagamentos WHERE salario_bruto < 0;

-- 7. Datas incoerentes
SELECT 'rh_funcionarios' AS table_name, id, data_admissao, data_demissao
FROM public.rh_funcionarios
WHERE data_demissao IS NOT NULL AND data_demissao < data_admissao;

SELECT 'financial_cobrancas' AS table_name, id, data_emissao, data_pagamento
FROM public.financial_cobrancas
WHERE data_pagamento IS NOT NULL AND data_pagamento < data_emissao;
