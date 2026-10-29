-- =====================================================================
-- Equipe do estúdio (Emerson e Isabel): quem pode usar a área do administrador.
-- Troca a regra antiga "só o e-mail do Emerson" por public.is_studio_team().
-- (já aplicado no Supabase em 29/10/2026)
-- Para incluir alguém: insert into private.studio_team (email, name) values ('email@exemplo.com', 'Nome');
-- =====================================================================
create schema if not exists private;
create table if not exists private.studio_team (
  email text primary key,
  name text,
  created_at timestamptz not null default now()
);
alter table private.studio_team enable row level security;
revoke all on private.studio_team from public, anon, authenticated;
insert into private.studio_team (email, name) values
  ('emersomhonorato@gmail.com', 'Emerson Honorato'),
  ('isahonoratoneuropsicopedagoga@gmail.com', 'Isabel Honorato')
on conflict (email) do update set name = excluded.name;

create or replace function public.is_studio_team()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (select 1 from private.studio_team t where t.email = lower(coalesce(auth.jwt() ->> 'email', '')));
$fn$;
revoke all on function public.is_studio_team() from public;
grant execute on function public.is_studio_team() to anon, authenticated;

do $do$
declare
  r record;
  q text;
  c text;
  pat text := 'lower\(\(auth\.jwt\(\) ->> ''email''::text\)\) = ''emersomhonorato@gmail\.com''::text';
begin
  for r in select * from pg_policies where coalesce(qual, '') || coalesce(with_check, '') ilike '%emersomhonorato@gmail.com%' loop
    q := regexp_replace(r.qual, pat, 'public.is_studio_team()', 'g');
    c := regexp_replace(r.with_check, pat, 'public.is_studio_team()', 'g');
    execute format('alter policy %I on %I.%I %s %s', r.policyname, r.schemaname, r.tablename,
      case when q is not null then 'using (' || q || ')' else '' end,
      case when c is not null then 'with check (' || c || ')' else '' end);
  end loop;
end
$do$;

do $do$
declare
  r record;
  def text;
begin
  for r in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private') and p.prokind = 'f' and pg_get_functiondef(p.oid) ilike '%emersomhonorato@gmail.com%'
       and p.proname <> 'is_studio_team'
  loop
    def := replace(pg_get_functiondef(r.oid),
      'if lower(coalesce(auth.jwt() ->> ''email'', '''')) <> ''emersomhonorato@gmail.com'' then',
      'if not public.is_studio_team() then');
    execute def;
  end loop;
end
$do$;
