# BBA App — Instruções de Aplicação
## Passos 1 e 2: Navegação + Cockpit

---

## O que foi criado

```
bba-app-redesign/apps/web/
├── app/
│   ├── bba-globals.css              ← NOVO: tema dark BBA completo
│   └── (dashboard)/
│       ├── layout.tsx               ← SUBSTITUIR o atual
│       ├── page.tsx                 ← SUBSTITUIR o atual (redirect → /hoje)
│       └── hoje/
│           └── page.tsx             ← NOVO: Cockpit principal
├── components/
│   └── sidebar.tsx                  ← NOVO: sidebar dark com identidade BBA
```

---

## Aplicação — Sequência exata

### 1. Copiar o CSS global

Copiar `bba-globals.css` para `apps/web/app/bba-globals.css`.

Verificar se o `layout.tsx` raiz (fora do dashboard) importa globals.css:
```tsx
// apps/web/app/layout.tsx
import './globals.css'
```

Se o projeto já tem um `globals.css`, **não substituir** — adicionar
ao final do arquivo existente o conteúdo de `bba-globals.css`.

Se não há conflito, criar como arquivo separado e importar no layout:
```tsx
import './bba-globals.css'
```

O import já está no novo `layout.tsx` do dashboard. Mas se preferir
centralizar, mova para o layout raiz.

---

### 2. Copiar o Sidebar component

Copiar `components/sidebar.tsx` para `apps/web/components/sidebar.tsx`.

Verificar se o path de import `@/components/sidebar` está correto
para o projeto. Se o alias `@` aponta para `apps/web/`, está certo.

---

### 3. Substituir o layout do dashboard

Substituir o conteúdo de:
```
apps/web/app/(dashboard)/layout.tsx
```
pelo conteúdo do novo `layout.tsx`.

**Atenção:** Se o layout atual tem lógica adicional (providers, theme,
analytics), preservar essas adições — só substituir a estrutura
visual e de navegação.

---

### 4. Substituir a page raiz do dashboard

Substituir o conteúdo de:
```
apps/web/app/(dashboard)/page.tsx
```
pelo redirect simples para `/hoje`.

---

### 5. Criar a pasta e a page do Cockpit

```bash
mkdir -p apps/web/app/(dashboard)/hoje
```

Criar `apps/web/app/(dashboard)/hoje/page.tsx` com o conteúdo fornecido.

---

### 6. Criar as páginas placeholder das novas rotas

Para cada rota nova, criar a pasta e o `page.tsx`:

```bash
mkdir -p apps/web/app/(dashboard)/empresa
mkdir -p apps/web/app/(dashboard)/caixa
mkdir -p apps/web/app/(dashboard)/impostos
mkdir -p apps/web/app/(dashboard)/equipe
mkdir -p apps/web/app/(dashboard)/bba
```

Conteúdo de cada `page.tsx` está em `PLACEHOLDER_PAGES.ts`.
Copiar o conteúdo da string correspondente (sem as aspas e backticks).

**Exceção:** `/bba/page.tsx` deve redirecionar para `/chat`:
```tsx
import { redirect } from 'next/navigation'
export default function BBAPage() { redirect('/chat') }
```

---

### 7. Criar as rotas do Motor

```bash
mkdir -p apps/web/app/(dashboard)/motor/cadastro
mkdir -p apps/web/app/(dashboard)/motor/fiscal
mkdir -p apps/web/app/(dashboard)/motor/financeiro
mkdir -p apps/web/app/(dashboard)/motor/contratos
mkdir -p apps/web/app/(dashboard)/motor/trabalhista
mkdir -p apps/web/app/(dashboard)/motor/onboarding
mkdir -p apps/web/app/(dashboard)/motor/tarefas
```

Em cada pasta, criar um `page.tsx` que re-exporta a página existente:

```tsx
// apps/web/app/(dashboard)/motor/cadastro/page.tsx
export { default } from '../../cadastro-cliente/page'
```

Verificar o nome exato das pastas existentes antes de criar os imports.

---

### 8. Adicionar redirects no next.config

Abrir `apps/web/next.config.js` (ou `.ts`) e adicionar:

```js
async redirects() {
  return [
    { source: '/painel-executivo', destination: '/hoje',              permanent: false },
    { source: '/cadastro-cliente', destination: '/motor/cadastro',    permanent: false },
    { source: '/fiscal',           destination: '/motor/fiscal',      permanent: false },
    { source: '/financeiro',       destination: '/motor/financeiro',  permanent: false },
    { source: '/contratos',        destination: '/motor/contratos',   permanent: false },
    { source: '/trabalhista',      destination: '/motor/trabalhista', permanent: false },
    { source: '/onboarding',       destination: '/motor/onboarding',  permanent: false },
    { source: '/tarefas',          destination: '/motor/tarefas',     permanent: false },
    { source: '/chat',             destination: '/bba',               permanent: false },
  ]
},
```

---

### 9. Instalar dependências (se necessário)

O sidebar usa `lucide-react`. Verificar se já está instalado:
```bash
cat apps/web/package.json | grep lucide
```

Se não estiver:
```bash
cd apps/web && npm install lucide-react
```

---

### 10. Typecheck antes de fazer deploy

```bash
npx turbo run typecheck --filter=@bba/web --force
```

Resolver erros antes do push para Vercel.

---

## Verificação visual esperada

Após aplicar, acessar `bba-app-web.vercel.app`:

✅ Sidebar dark navy com logo BBA e navegação nova
✅ Home vai direto para `/hoje` (Cockpit)
✅ Greeting com nome do usuário e data
✅ 3 cards de Radar (Caixa, Risco, Empresa)
✅ Ação do Dia baseada em tarefas/onboarding reais
✅ Score BBA com 4 pilares
✅ Placeholder para Caixa e Impostos
✅ Seção "Operacional" colapsada na sidebar
✅ Badge de alertas no item "Hoje"

---

## O que NÃO muda nesta aplicação

- Nenhuma tabela do Supabase é alterada
- Nenhuma query existente é alterada
- O Admin BBA continua funcionando
- O Chat continua no path `/chat` (com redirect de `/bba`)
- Os módulos ERP continuam acessíveis via `/motor/*`

---

## Próximo passo após validação

**Passo 3 — Score Transparente completo** (tela `/empresa`)
Cálculo detalhado dos 4 pilares com breakdown por campo
e próximos passos para subir pontuação.
