-- =====================================================================
-- Seleção de fotos pelo cliente (fotos em baixa no Google Drive) → arquivo do Lightroom
-- =====================================================================
alter table public.studio_settings add column if not exists google_api_key text;

create table if not exists public.photo_selections (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  slug text not null unique,
  title text not null,
  client_name text not null,
  client_whatsapp text,
  event_id text,
  event_date date,
  drive_url text not null,
  photos jsonb not null default '[]'::jsonb,          -- [{ "id": "...", "name": "EME_1158.jpg" }]
  included_count int not null default 0,              -- fotos inclusas no pacote (0 = sem limite)
  extra_price numeric(10,2) not null default 0,       -- valor por foto extra
  max_count int,                                      -- limite máximo (opcional)
  pin text,
  expires_at date,
  message text,
  status text not null default 'aberta' check (status in ('aberta', 'enviada')),
  selected jsonb not null default '[]'::jsonb,        -- ["EME_1158.jpg", ...]
  client_note text,
  submitted_at timestamptz,
  views int not null default 0,
  last_viewed_at timestamptz,
  last_saved_at timestamptz
);
alter table public.photo_selections enable row level security;
drop policy if exists "selecao: admin" on public.photo_selections;
create policy "selecao: admin" on public.photo_selections for all to authenticated
  using (lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com')
  with check (lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com');

create or replace function public.get_selection(p_slug text, p_pin text default null)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  s public.photo_selections;
begin
  select * into s from public.photo_selections where slug = lower(trim(p_slug));
  if not found then return json_build_object('status', 'not_found'); end if;
  if coalesce(s.pin, '') <> '' and coalesce(trim(p_pin), '') <> s.pin then
    return json_build_object('status', case when coalesce(p_pin, '') = '' then 'need_pin' else 'wrong_pin' end,
      'client_name', s.client_name, 'title', s.title);
  end if;
  update public.photo_selections set views = views + 1, last_viewed_at = now() where id = s.id;
  return json_build_object(
    'status', case when s.status = 'enviada' then 'enviada'
                   when s.expires_at is not null and s.expires_at < (now() at time zone 'America/Sao_Paulo')::date then 'expired'
                   else 'aberta' end,
    'title', s.title, 'client_name', s.client_name, 'event_date', s.event_date, 'message', s.message,
    'photos', s.photos, 'included_count', s.included_count, 'extra_price', s.extra_price, 'max_count', s.max_count,
    'expires_at', s.expires_at, 'selected', s.selected, 'client_note', s.client_note, 'submitted_at', s.submitted_at);
end;
$fn$;

-- Salva a escolha (rascunho a cada clique) ou envia a escolha final
create or replace function public.save_selection(
  p_slug text, p_pin text, p_selected jsonb, p_note text default null, p_submit boolean default false
) returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  s public.photo_selections;
  v_clean jsonb;
  v_count int;
begin
  select * into s from public.photo_selections where slug = lower(trim(p_slug)) for update;
  if not found then raise exception 'Seleção não encontrada.'; end if;
  if coalesce(s.pin, '') <> '' and coalesce(trim(p_pin), '') <> s.pin then raise exception 'Senha incorreta.'; end if;
  if s.status = 'enviada' then raise exception 'Sua escolha já foi enviada. Para mudar, fale comigo pelo WhatsApp.'; end if;
  if s.expires_at is not null and s.expires_at < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'O prazo para escolher terminou. Fale comigo pelo WhatsApp.';
  end if;

  -- só aceita nomes que existem na galeria (sem repetir)
  select coalesce(jsonb_agg(distinct n.value), '[]'::jsonb) into v_clean
    from jsonb_array_elements_text(coalesce(p_selected, '[]'::jsonb)) as n(value)
   where exists (select 1 from jsonb_array_elements(s.photos) p where p ->> 'name' = n.value);
  v_count := jsonb_array_length(v_clean);
  if s.max_count is not null and s.max_count > 0 and v_count > s.max_count then
    raise exception 'Você pode escolher no máximo % fotos.', s.max_count;
  end if;
  if p_submit and v_count = 0 then raise exception 'Escolha pelo menos uma foto.'; end if;

  update public.photo_selections
     set selected = v_clean, client_note = left(nullif(trim(coalesce(p_note, '')), ''), 2000),
         last_saved_at = now(), updated_at = now(),
         status = case when p_submit then 'enviada' else status end,
         submitted_at = case when p_submit then now() else submitted_at end
   where id = s.id;

  if p_submit then
    begin
      execute 'select private.notify_whatsapp($1)' using format('📸 %s terminou a escolha das fotos (%s fotos) — %s', s.client_name, v_count, s.title);
    exception when others then null;
    end;
  end if;

  return json_build_object('status', case when p_submit then 'enviada' else 'aberta' end, 'count', v_count);
end;
$fn$;

revoke all on function public.get_selection(text, text) from public;
revoke all on function public.save_selection(text, text, jsonb, text, boolean) from public;
grant execute on function public.get_selection(text, text) to anon, authenticated;
grant execute on function public.save_selection(text, text, jsonb, text, boolean) to anon, authenticated;

select count(*) as selecoes from public.photo_selections;
