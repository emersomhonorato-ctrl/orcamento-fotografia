-- =====================================================================
-- Entrega de fotos (link do Google Drive) — Emerson Honorato Retratos
-- =====================================================================
create table if not exists public.photo_deliveries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  slug text not null unique,
  title text not null,
  client_name text not null,
  client_whatsapp text,
  client_email text,
  event_id text,
  event_date date,
  drive_url text not null,
  cover_url text,
  cover_path text,
  message text,
  pin text,
  expires_at date,
  active boolean not null default true,
  views int not null default 0,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz
);

alter table public.photo_deliveries enable row level security;
drop policy if exists "entregas: admin" on public.photo_deliveries;
create policy "entregas: admin" on public.photo_deliveries for all to authenticated
  using (lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com')
  with check (lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com');

-- O cliente só lê a própria entrega por esta função (com senha, se houver). Ninguém consegue listar as entregas.
create or replace function public.get_delivery(p_slug text, p_pin text default null)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  d public.photo_deliveries;
begin
  select * into d from public.photo_deliveries where slug = lower(trim(p_slug)) and active;
  if not found then
    return json_build_object('status', 'not_found');
  end if;
  if d.expires_at is not null and d.expires_at < (now() at time zone 'America/Sao_Paulo')::date then
    return json_build_object('status', 'expired', 'client_name', d.client_name, 'title', d.title);
  end if;
  if coalesce(d.pin, '') <> '' and coalesce(trim(p_pin), '') <> d.pin then
    return json_build_object('status', case when coalesce(p_pin, '') = '' then 'need_pin' else 'wrong_pin' end,
      'client_name', d.client_name, 'title', d.title, 'cover_url', d.cover_url);
  end if;

  update public.photo_deliveries
     set views = views + 1, last_viewed_at = now(), first_viewed_at = coalesce(first_viewed_at, now())
   where id = d.id;

  return json_build_object('status', 'ok', 'title', d.title, 'client_name', d.client_name,
    'event_date', d.event_date, 'drive_url', d.drive_url, 'cover_url', d.cover_url,
    'message', d.message, 'expires_at', d.expires_at);
end;
$fn$;

revoke all on function public.get_delivery(text, text) from public;
grant execute on function public.get_delivery(text, text) to anon, authenticated;

-- Fotos de capa (imagens leves, públicas)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('entregas', 'entregas', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "entregas capa: admin envia" on storage.objects;
drop policy if exists "entregas capa: admin altera" on storage.objects;
drop policy if exists "entregas capa: admin apaga" on storage.objects;
drop policy if exists "entregas capa: admin lê" on storage.objects;
create policy "entregas capa: admin envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'entregas' and lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com');
create policy "entregas capa: admin altera" on storage.objects for update to authenticated
  using (bucket_id = 'entregas' and lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com');
create policy "entregas capa: admin apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'entregas' and lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com');
create policy "entregas capa: admin lê" on storage.objects for select to authenticated
  using (bucket_id = 'entregas' and lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com');

select count(*) as entregas from public.photo_deliveries;
