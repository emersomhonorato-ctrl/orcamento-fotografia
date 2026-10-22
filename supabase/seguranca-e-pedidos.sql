-- =====================================================================
-- Emerson Honorato Retratos — segurança do banco + formulário de pedidos
-- Como usar: Supabase > SQL Editor > New query > cole tudo > Run
-- Pode rodar mais de uma vez sem problema.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) PROTEGER OS DADOS DO ESTÚDIO (tabela app_state)
--    Hoje qualquer pessoa com a chave pública (que fica no código do site)
--    consegue ler essa tabela sem login. Depois deste bloco, só o admin
--    logado consegue ler e gravar.
-- ---------------------------------------------------------------------
alter table public.app_state enable row level security;

-- remove regras antigas (se houver alguma liberando acesso público)
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'app_state' loop
    execute format('drop policy %I on public.app_state', p.policyname);
  end loop;
end $$;

revoke all on public.app_state from anon;
grant select, insert, update, delete on public.app_state to authenticated;

create policy "app_state: somente admin"
  on public.app_state
  for all
  to authenticated
  using (lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com')
  with check (lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com');

-- ---------------------------------------------------------------------
-- 2) PEDIDOS DE ORÇAMENTO (formulário público)
--    O cliente só consegue ENVIAR um pedido. Ninguém sem login consegue
--    ler, alterar ou apagar pedidos.
-- ---------------------------------------------------------------------
create table if not exists public.budget_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'novo' check (status in ('novo', 'respondido', 'convertido', 'arquivado')),
  name text not null check (char_length(name) between 2 and 120),
  whatsapp text not null check (char_length(whatsapp) between 8 and 30),
  email text check (email is null or char_length(email) <= 160),
  service text check (service is null or char_length(service) <= 80),
  event_date date,
  event_time text check (event_time is null or char_length(event_time) <= 30),
  location text check (location is null or char_length(location) <= 160),
  people text check (people is null or char_length(people) <= 60),
  details text check (details is null or char_length(details) <= 2000),
  how_found text check (how_found is null or char_length(how_found) <= 80)
);

alter table public.budget_requests enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'budget_requests' loop
    execute format('drop policy %I on public.budget_requests', p.policyname);
  end loop;
end $$;

revoke all on public.budget_requests from anon;
grant insert (name, whatsapp, email, service, event_date, event_time, location, people, details, how_found)
  on public.budget_requests to anon;
grant select, insert, update, delete on public.budget_requests to authenticated;

create policy "pedidos: cliente envia"
  on public.budget_requests
  for insert
  to anon
  with check (status = 'novo');

create policy "pedidos: admin gerencia"
  on public.budget_requests
  for all
  to authenticated
  using (lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com')
  with check (lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com');

-- Conferência: deve listar as 3 regras criadas
select tablename, policyname, roles, cmd from pg_policies
where schemaname = 'public' and tablename in ('app_state', 'budget_requests')
order by tablename, policyname;

-- ---------------------------------------------------------------------
-- 3) CAMPOS OBRIGATÓRIOS NO PEDIDO (nome e sobrenome, e-mail válido,
--    data do evento e tipo de evento). "not valid" = vale só para pedidos novos.
-- ---------------------------------------------------------------------
alter table public.budget_requests drop constraint if exists pedidos_campos_obrigatorios;
alter table public.budget_requests add constraint pedidos_campos_obrigatorios check (
  email is not null and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'
  and event_date is not null
  and service is not null and char_length(service) > 0
  and name ~ '[^[:space:]]{2,}[[:space:]]+[^[:space:]]{2,}'
) not valid;
