# Orcamento Fotografia

Sistema para gerenciar clientes, agendamentos e orçamentos fotográficos com itens detalhados, geração de PDF e backup local com sincronização opcional via Supabase.

## Rodando o projeto

```bash
npm install
npm run dev
```

## Variáveis de ambiente

Use o arquivo [/.env.example](/Users/emersonhonorato/orcamento-fotografia/.env.example) como base:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_AUTH_ENABLED=false
# VITE_ADMIN_EMAIL=admin@seudominio.com
```

## Login com usuário e senha

O sistema já está preparado para autenticação com e-mail e senha via Supabase Auth.

Para ativar:

```bash
VITE_AUTH_ENABLED=true
VITE_ADMIN_EMAIL=emersomhonorato@gmail.com
```

Depois disso:

1. crie o usuário administrador no Supabase em `Authentication > Users`
2. rode o projeto normalmente
3. o sistema passará a exigir login antes de abrir a agenda, os orçamentos e as configurações

## Sincronização com Supabase

O app funciona sem banco, usando `localStorage`. Para sincronizar snapshots no Supabase, crie a tabela abaixo:

```sql
create table if not exists public.app_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default timezone('utc', now())
);
```

Depois disso, o sistema tenta salvar em `public.app_state` com o identificador `studio-manager`.

## O que esta versão faz

- separa corretamente `eventos` de `orçamentos`
- usa status coerentes para cada fluxo
- permite montar orçamento com itens
- gera PDF a partir dos itens
- salva localmente e tenta sincronizar com Supabase

## Base original do template

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
