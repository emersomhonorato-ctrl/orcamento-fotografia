-- =====================================================================
-- Agenda online de ensaios (Natal 2026) — Emerson Honorato Retratos
-- Supabase > SQL Editor > cole tudo > Run. Pode rodar mais de uma vez.
-- =====================================================================

-- Campanha (dados públicos: título, pacotes, preços, período)
create table if not exists public.booking_campaigns (
  id text primary key,
  title text not null,
  subtitle text,
  active boolean not null default true,
  studio_whatsapp text,
  location text,
  packages jsonb not null default '[]'::jsonb,
  extra_photo_price numeric not null default 0,
  start_date date,
  end_date date,
  slot_minutes int not null default 30,
  created_at timestamptz not null default now()
);

-- Horários (só data/hora e situação — nenhum dado pessoal)
create table if not exists public.booking_slots (
  id uuid primary key default gen_random_uuid(),
  campaign_id text not null references public.booking_campaigns(id) on delete cascade,
  starts_at timestamptz not null,
  status text not null default 'livre' check (status in ('livre', 'reservado', 'bloqueado')),
  created_at timestamptz not null default now(),
  unique (campaign_id, starts_at)
);

-- Reservas (dados do cliente — só o admin lê)
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  campaign_id text not null references public.booking_campaigns(id) on delete cascade,
  slot_id uuid not null references public.booking_slots(id) on delete cascade,
  starts_at timestamptz not null,
  status text not null default 'confirmado' check (status in ('confirmado', 'cancelado')),
  package_name text not null,
  package_photos int,
  package_price numeric,
  name text not null,
  whatsapp text not null,
  email text not null,
  notes text
);
create unique index if not exists bookings_um_por_horario on public.bookings (slot_id) where status = 'confirmado';

alter table public.booking_campaigns enable row level security;
alter table public.booking_slots enable row level security;
alter table public.bookings enable row level security;

do $$
declare p record;
begin
  for p in select tablename, policyname from pg_policies
           where schemaname = 'public' and tablename in ('booking_campaigns', 'booking_slots', 'bookings') loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

revoke all on public.booking_campaigns, public.booking_slots, public.bookings from anon;
grant select on public.booking_campaigns, public.booking_slots to anon;
grant select, insert, update, delete on public.booking_campaigns, public.booking_slots, public.bookings to authenticated;

create policy "campanhas: público vê ativas" on public.booking_campaigns for select to anon using (active);
create policy "horarios: público vê de campanhas ativas" on public.booking_slots for select to anon
  using (exists (select 1 from public.booking_campaigns c where c.id = campaign_id and c.active));

create policy "campanhas: admin" on public.booking_campaigns for all to authenticated
  using (lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com')
  with check (lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com');
create policy "horarios: admin" on public.booking_slots for all to authenticated
  using (lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com')
  with check (lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com');
create policy "reservas: admin" on public.bookings for all to authenticated
  using (lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com')
  with check (lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com');

-- Reserva segura: o visitante só reserva por esta função (trava o horário, valida os dados)
create or replace function public.book_slot(
  p_slot_id uuid, p_package text, p_name text, p_whatsapp text, p_email text, p_notes text default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.booking_slots;
  c public.booking_campaigns;
  pkg jsonb;
  b_id uuid;
  phone_digits text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
begin
  if coalesce(p_name, '') !~ '[^[:space:]]{2,}[[:space:]]+[^[:space:]]{2,}' then
    raise exception 'Informe nome e sobrenome.';
  end if;
  if length(phone_digits) < 10 then
    raise exception 'Informe um WhatsApp com DDD.';
  end if;
  if coalesce(p_email, '') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' then
    raise exception 'Informe um e-mail válido.';
  end if;

  select * into s from public.booking_slots where id = p_slot_id for update;
  if not found then raise exception 'Horário não encontrado.'; end if;
  if s.status <> 'livre' then raise exception 'Este horário acabou de ser reservado. Escolha outro, por favor.'; end if;
  if s.starts_at < now() then raise exception 'Este horário já passou.'; end if;

  select * into c from public.booking_campaigns where id = s.campaign_id and active;
  if not found then raise exception 'As reservas desta agenda estão encerradas.'; end if;

  if (select count(*) from public.bookings b
      where b.campaign_id = c.id and b.status = 'confirmado'
        and regexp_replace(b.whatsapp, '\D', '', 'g') = phone_digits) >= 3 then
    raise exception 'Este WhatsApp já tem 3 reservas. Para mais horários, fale comigo pelo WhatsApp.';
  end if;

  select x into pkg from jsonb_array_elements(c.packages) x where x ->> 'name' = p_package limit 1;
  if pkg is null then raise exception 'Escolha um pacote.'; end if;

  update public.booking_slots set status = 'reservado' where id = s.id;
  insert into public.bookings (campaign_id, slot_id, starts_at, package_name, package_photos, package_price, name, whatsapp, email, notes)
  values (c.id, s.id, s.starts_at, pkg ->> 'name', (pkg ->> 'photos')::int, (pkg ->> 'price')::numeric,
          left(trim(p_name), 120), left(trim(p_whatsapp), 30), lower(left(trim(p_email), 160)), left(p_notes, 1000))
  returning id into b_id;

  return json_build_object('id', b_id, 'starts_at', s.starts_at, 'package', pkg ->> 'name', 'price', pkg ->> 'price', 'photos', pkg ->> 'photos');
end;
$$;

revoke all on function public.book_slot(uuid, text, text, text, text, text) from public;
grant execute on function public.book_slot(uuid, text, text, text, text, text) to anon, authenticated;

-- Campanha Natal 2026 (edite depois pelo app)
insert into public.booking_campaigns (id, title, subtitle, active, studio_whatsapp, packages, extra_photo_price, start_date, end_date, slot_minutes)
values (
  'natal-2026',
  'Ensaios de Natal 2026',
  'Escolha o seu pacote e reserve o melhor horário para a sua família.',
  true,
  '48999652317',
  '[{"name":"10 fotos","photos":10,"price":149},{"name":"15 fotos","photos":15,"price":199},{"name":"25 fotos","photos":25,"price":250}]'::jsonb,
  12,
  '2026-11-01',
  '2026-12-23',
  30
)
on conflict (id) do update set
  packages = excluded.packages,
  extra_photo_price = excluded.extra_photo_price,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  slot_minutes = excluded.slot_minutes;

select id, title, active, start_date, end_date, jsonb_array_length(packages) as pacotes from public.booking_campaigns;

-- =====================================================================
-- Pix do sinal (50%) + aviso automático por WhatsApp (já aplicado)
-- =====================================================================
alter table public.booking_campaigns
  add column if not exists pix_key text,
  add column if not exists pix_name text,
  add column if not exists pix_city text,
  add column if not exists deposit_percent int not null default 50;

update public.booking_campaigns
   set pix_key = '55888684000100', pix_name = 'Emerson Honorato Retratos',
       pix_city = 'Siderópolis', deposit_percent = 50
 where id = 'natal-2026';

alter table public.bookings
  add column if not exists deposit_amount numeric(10,2),
  add column if not exists paid_at timestamptz;
-- status: aguardando_sinal -> confirmado (quando o sinal é marcado como recebido) | cancelado
-- book_slot agora grava status 'aguardando_sinal' e deposit_amount = preço * deposit_percent / 100.
-- Aviso: private.notify_settings (CallMeBot). Para ligar, quando tiver a apikey:
--   update private.notify_settings set callmebot_apikey = 'SUA_APIKEY', enabled = true where id = 1;

-- =====================================================================
-- Ensaio temático editável + PDF de instruções (Storage)
-- =====================================================================
alter table public.booking_campaigns
  add column if not exists instructions_pdf_url text,
  add column if not exists instructions_pdf_path text,
  add column if not exists instructions_pdf_name text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ensaios', 'ensaios', true, 10485760, array['application/pdf'])
on conflict (id) do update set public = true, file_size_limit = 10485760, allowed_mime_types = array['application/pdf'];

drop policy if exists "ensaios: admin envia" on storage.objects;
drop policy if exists "ensaios: admin altera" on storage.objects;
drop policy if exists "ensaios: admin apaga" on storage.objects;
create policy "ensaios: admin envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'ensaios' and lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com');
create policy "ensaios: admin altera" on storage.objects for update to authenticated
  using (bucket_id = 'ensaios' and lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com');
create policy "ensaios: admin apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'ensaios' and lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com');

drop policy if exists "ensaios: admin lê" on storage.objects;
create policy "ensaios: admin lê" on storage.objects for select to authenticated
  using (bucket_id = 'ensaios' and lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com');

select id, public, file_size_limit from storage.buckets where id = 'ensaios';

-- =====================================================================
-- Pessoa extra + opção de pagar o valor completo
-- =====================================================================
alter table public.booking_campaigns
  add column if not exists extra_person_price numeric not null default 0,
  add column if not exists max_extra_people int not null default 5,
  add column if not exists allow_full_payment boolean not null default true;

alter table public.bookings
  add column if not exists extra_people int not null default 0,
  add column if not exists extra_people_amount numeric(10,2) not null default 0,
  add column if not exists total_price numeric(10,2),
  add column if not exists payment_choice text not null default 'sinal';

drop function if exists public.book_slot(uuid, text, text, text, text, text);
drop function if exists public.book_slot(uuid, text, text, text, text, text, int, text);

create function public.book_slot(
  p_slot_id uuid, p_package text, p_name text, p_whatsapp text, p_email text,
  p_notes text default null, p_extra_people int default 0, p_payment text default 'sinal'
) returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  s public.booking_slots;
  c public.booking_campaigns;
  pkg jsonb;
  b_id uuid;
  phone_digits text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  v_extra int := greatest(coalesce(p_extra_people, 0), 0);
  v_price numeric;
  v_extra_amount numeric;
  v_total numeric;
  v_payment text := case when p_payment = 'total' then 'total' else 'sinal' end;
  v_deposit numeric;
begin
  if coalesce(p_name, '') !~ '[^[:space:]]{2,}[[:space:]]+[^[:space:]]{2,}' then
    raise exception 'Informe nome e sobrenome.';
  end if;
  if length(phone_digits) < 10 then
    raise exception 'Informe um WhatsApp com DDD.';
  end if;
  if coalesce(p_email, '') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' then
    raise exception 'Informe um e-mail válido.';
  end if;

  select * into s from public.booking_slots where id = p_slot_id for update;
  if not found then raise exception 'Horário não encontrado.'; end if;
  if s.status <> 'livre' then raise exception 'Este horário acabou de ser reservado. Escolha outro, por favor.'; end if;
  if s.starts_at < now() then raise exception 'Este horário já passou.'; end if;

  select * into c from public.booking_campaigns where id = s.campaign_id and active;
  if not found then raise exception 'As reservas desta agenda estão encerradas.'; end if;

  if (select count(*) from public.bookings b
      where b.campaign_id = c.id and b.status in ('aguardando_sinal', 'confirmado')
        and regexp_replace(b.whatsapp, '\D', '', 'g') = phone_digits) >= 3 then
    raise exception 'Este WhatsApp já tem 3 reservas. Para mais horários, fale comigo pelo WhatsApp.';
  end if;

  select x into pkg from jsonb_array_elements(c.packages) x where x ->> 'name' = p_package limit 1;
  if pkg is null then raise exception 'Escolha um pacote.'; end if;

  if coalesce(c.extra_person_price, 0) <= 0 then v_extra := 0; end if;
  if v_extra > coalesce(c.max_extra_people, 5) then
    raise exception 'Máximo de % pessoas extras. Para mais, fale comigo pelo WhatsApp.', coalesce(c.max_extra_people, 5);
  end if;
  if v_payment = 'total' and not coalesce(c.allow_full_payment, true) then v_payment := 'sinal'; end if;

  v_price := (pkg ->> 'price')::numeric;
  v_extra_amount := round(v_extra * coalesce(c.extra_person_price, 0), 2);
  v_total := v_price + v_extra_amount;
  v_deposit := case when v_payment = 'total' then v_total
                    else round(v_total * coalesce(c.deposit_percent, 50) / 100.0, 2) end;

  update public.booking_slots set status = 'reservado' where id = s.id;
  insert into public.bookings (campaign_id, slot_id, starts_at, status, package_name, package_photos, package_price,
                               extra_people, extra_people_amount, total_price, payment_choice, deposit_amount,
                               name, whatsapp, email, notes)
  values (c.id, s.id, s.starts_at, 'aguardando_sinal', pkg ->> 'name', (pkg ->> 'photos')::int, v_price,
          v_extra, v_extra_amount, v_total, v_payment, v_deposit,
          left(trim(p_name), 120), left(trim(p_whatsapp), 30), lower(left(trim(p_email), 160)), left(p_notes, 1000))
  returning id into b_id;

  return json_build_object('id', b_id, 'starts_at', s.starts_at, 'package', pkg ->> 'name',
    'package_price', v_price, 'extra_people', v_extra, 'extra_amount', v_extra_amount,
    'price', v_total, 'photos', pkg ->> 'photos', 'deposit', v_deposit, 'payment', v_payment,
    'status', 'aguardando_sinal');
end;
$fn$;

revoke all on function public.book_slot(uuid, text, text, text, text, text, int, text) from public;
grant execute on function public.book_slot(uuid, text, text, text, text, text, int, text) to anon, authenticated;

select pg_get_function_identity_arguments('public.book_slot'::regproc) as args;
