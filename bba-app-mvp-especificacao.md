# BBA App — Especificação Técnica MVP Onda 1
**Versão 1.0 · Julho 2025 · Confidencial BBA Brazil**

---

## 1. Visão Geral

O BBA App é um portal de gestão para clientes da BBA Brazil, entregando visibilidade operacional, comunicação direta e rastreamento de projetos em um único ambiente. O MVP Onda 1 é a base de adoção — validação de uso antes de integrar dados financeiros reais.

**Escopo do MVP Onda 1:**
- Onboarding e cadastro do cliente
- Painel de tarefas e status de projetos BBA
- Chat / comunicação com a equipe BBA

---

## 2. Stack Técnica

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| Frontend Web | Next.js 14 (App Router) | SEO + SSR + PWA nativo |
| Mobile | React Native (Expo SDK 51) | iOS + Android com código compartilhado |
| Shared logic | TypeScript + Zustand | Estado global tipado, sem boilerplate |
| Backend | Supabase | Auth, banco PostgreSQL, Storage, Realtime |
| Chat | Supabase Realtime | WebSocket nativo, sem custo adicional |
| Deploy Web | Vercel | CI/CD automático, edge network BR |
| Deploy Mobile | Expo EAS Build | OTA updates sem nova publicação nas lojas |
| Notificações | Expo Notifications + Supabase Edge Functions | Push iOS/Android + email |

---

## 3. Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────┐
│                   CLIENTES BBA                       │
│         Web (Next.js)    Mobile (React Native)       │
└──────────────┬──────────────────┬───────────────────┘
               │                  │
               ▼                  ▼
┌─────────────────────────────────────────────────────┐
│              SUPABASE (Backend-as-a-Service)          │
│                                                       │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌───────┐ │
│  │  Auth   │  │ Database │  │Realtime │  │Storage│ │
│  │  (JWT)  │  │(Postgres)│  │ (WS)   │  │(Files)│ │
│  └─────────┘  └──────────┘  └─────────┘  └───────┘ │
│                                                       │
│  ┌────────────────────────────────────────────────┐  │
│  │           Edge Functions (Deno)                 │  │
│  │  - Webhooks · Notificações · Integrações ERP   │  │
│  └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│           PAINEL ADMIN BBA (Next.js)                 │
│   Gestão de clientes, tarefas, mensagens, docs       │
└─────────────────────────────────────────────────────┘
```

---

## 4. Modelo de Dados (PostgreSQL/Supabase)

### 4.1 Tabela: `profiles`
```sql
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id),
  name        TEXT NOT NULL,
  cnpj        TEXT UNIQUE,
  regime      TEXT CHECK (regime IN ('MEI','Simples','LucroPresumido','LucroReal')),
  segmento    TEXT,
  phone       TEXT,
  plan        TEXT DEFAULT 'essencial',
  onboarding_step INTEGER DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Tabela: `projects`
```sql
CREATE TABLE projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID REFERENCES profiles(id),
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT CHECK (status IN ('active','paused','completed')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.3 Tabela: `tasks`
```sql
CREATE TABLE tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id),
  client_id   UUID REFERENCES profiles(id),
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT CHECK (status IN ('todo','doing','done')) DEFAULT 'todo',
  tag         TEXT,
  due_date    DATE,
  assigned_to UUID,  -- membro da equipe BBA
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.4 Tabela: `chat_channels`
```sql
CREATE TABLE chat_channels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID REFERENCES profiles(id),
  team_area   TEXT CHECK (team_area IN ('fiscal','financeiro','ti','rh','governanca')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.5 Tabela: `messages`
```sql
CREATE TABLE messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  UUID REFERENCES chat_channels(id),
  sender_id   UUID REFERENCES auth.users(id),
  sender_role TEXT CHECK (sender_role IN ('client','bba_team')),
  content     TEXT NOT NULL,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.6 Tabela: `onboarding_steps`
```sql
CREATE TABLE onboarding_steps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID REFERENCES profiles(id),
  step_number INTEGER NOT NULL,
  step_title  TEXT NOT NULL,
  status      TEXT CHECK (status IN ('pending','current','done')) DEFAULT 'pending',
  completed_at TIMESTAMPTZ
);
```

---

## 5. Row Level Security (RLS)

```sql
-- Clientes só veem seus próprios dados
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_own_tasks" ON tasks
  FOR ALL USING (client_id = auth.uid());

CREATE POLICY "client_own_messages" ON messages
  FOR ALL USING (
    channel_id IN (
      SELECT id FROM chat_channels WHERE client_id = auth.uid()
    )
  );

-- Equipe BBA tem acesso a todos os clientes do seu plano
CREATE POLICY "bba_team_access" ON tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND plan = 'bba_team'
    )
  );
```

---

## 6. Estrutura de Pastas (Monorepo)

```
bba-app/
├── apps/
│   ├── web/                    # Next.js 14
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/
│   │   │   │   └── cadastro/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── tarefas/
│   │   │   │   └── chat/
│   │   │   └── layout.tsx
│   │   └── middleware.ts       # Auth guard
│   └── mobile/                 # Expo React Native
│       ├── app/
│       │   ├── (auth)/
│       │   └── (tabs)/
│       │       ├── index.tsx   # Dashboard
│       │       ├── tarefas.tsx
│       │       └── chat.tsx
│       └── app.json
├── packages/
│   ├── ui/                     # Componentes compartilhados
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── TaskCard.tsx
│   │   └── ChatBubble.tsx
│   ├── lib/
│   │   ├── supabase.ts         # Client config
│   │   ├── queries.ts          # React Query hooks
│   │   └── types.ts            # Tipos TypeScript
│   └── config/
│       └── colors.ts           # Design tokens BBA
└── supabase/
    ├── migrations/
    └── functions/
        ├── notify-client/
        └── notify-bba-team/
```

---

## 7. Componentes-Chave a Construir

### 7.1 Auth (Onboarding)
```typescript
// packages/lib/auth.ts
export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
};

export const signUp = async (email: string, password: string, profile: ProfileInput) => {
  const { data: auth } = await supabase.auth.signUp({ email, password });
  if (auth.user) {
    await supabase.from('profiles').insert({ id: auth.user.id, ...profile });
    await createDefaultOnboardingSteps(auth.user.id);
  }
};
```

### 7.2 Chat em Tempo Real
```typescript
// packages/lib/chat.ts
export const subscribeToChannel = (channelId: string, onMessage: (msg: Message) => void) => {
  return supabase
    .channel(`chat:${channelId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `channel_id=eq.${channelId}`
    }, payload => onMessage(payload.new as Message))
    .subscribe();
};
```

### 7.3 Board de Tarefas (Drag & Drop web)
```typescript
// apps/web/app/(dashboard)/tarefas/page.tsx
// Usar @hello-pangea/dnd para drag entre colunas
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const onDragEnd = async (result: DropResult) => {
  const newStatus = columnStatusMap[result.destination?.droppableId];
  await supabase.from('tasks').update({ status: newStatus }).eq('id', result.draggableId);
};
```

---

## 8. Push Notifications (Supabase Edge Function)

```typescript
// supabase/functions/notify-client/index.ts
import { serve } from 'https://deno.land/std/http/server.ts';

serve(async (req) => {
  const { client_id, title, body } = await req.json();
  
  // Buscar token Expo do cliente
  const { data: profile } = await supabase
    .from('profiles')
    .select('expo_push_token')
    .eq('id', client_id)
    .single();

  // Enviar push via Expo
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: profile.expo_push_token,
      title,
      body,
      sound: 'default'
    })
  });
});
```

---

## 9. Design Tokens BBA (Compartilhado Web + Mobile)

```typescript
// packages/config/colors.ts
export const BBA = {
  navy:      '#0c1f3f',
  navy2:     '#12315f',
  gold:      '#b9954f',
  goldSoft:  '#e3d2ad',
  paper:     '#f8f6f1',
  ink:       '#212427',
  muted:     '#696969',
  line:      '#dcd5ce',
  white:     '#ffffff',
  success:   '#2a7a4b',
  danger:    '#c0392b',
  warning:   '#b9860f',
} as const;

export const BBA_RADIUS = { sm: 6, md: 10, lg: 16 } as const;
export const BBA_FONT = {
  light: '300',
  regular: '400',
  medium: '500',
  bold: '700',
} as const;
```

---

## 10. Cronograma de Entrega — Onda 1

| Semana | Entrega |
|--------|---------|
| 1 | Setup monorepo, Supabase config, auth completo (login + cadastro) |
| 2 | Onboarding flow (steps, progresso, formulário de dados) |
| 3 | Módulo de Tarefas (board kanban, CRUD, filtros por status/tag) |
| 4 | Chat em tempo real (canais por área BBA, mensagens, notificações) |
| 5 | Painel Admin BBA (gestão de clientes, tarefas e mensagens) |
| 6 | Testes, polimento visual, build iOS/Android, deploy web |

**Total: 6 semanas para Onda 1 completa.**

---

## 11. Estimativa de Custo Mensal de Infra (Pós-Launch)

| Serviço | Plano | Custo/mês |
|---------|-------|-----------|
| Supabase | Pro | US$ 25 |
| Vercel | Pro | US$ 20 |
| Expo EAS | Production | US$ 99 |
| Total (até 500 clientes) | | **~R$ 750/mês** |

---

## 12. Próximos Passos Imediatos

1. **Criar projeto no Supabase** — supabase.com/dashboard → New Project → Region: São Paulo (sa-east-1)
2. **Executar migrations** — rodar os SQLs da Seção 4 no SQL Editor do Supabase
3. **Inicializar monorepo** — `npx create-turbo@latest bba-app`
4. **Configurar variáveis de ambiente** — `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`
5. **Deploy inicial no Vercel** — conectar repo GitHub, deploy automático

---

*Documento gerado pela BBA Brazil · Uso interno · Julho 2025*
