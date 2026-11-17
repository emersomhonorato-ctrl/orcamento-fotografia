-- =====================================================================
-- Link de agendamento das sessões mensais (acompanhamento mês a mês).
-- Cada contrato de acompanhamento ganha um código (monthlyToken, guardado no
-- próprio contrato na Agenda). Pelo link /mensal/<código> o cliente escolhe um
-- horário livre: só aparece horário com pelo menos 2 horas livres antes e
-- depois de qualquer outro trabalho da agenda. Uma sessão por mês.
-- A reserva entra confirmada; o app traz para a Agenda como "Sessão mensal N".
-- =====================================================================
create table if not exists public.monthly_bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  token text not null,
  contract_id text not null,
  client_name text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  theme text,
  notes text,
  status text not null default 'confirmado' check (status in ('confirmado', 'cancelado'))
);
create index if not exists monthly_bookings_contract_idx on public.monthly_bookings(contract_id);
create index if not exists monthly_bookings_starts_idx on public.monthly_bookings(starts_at);

alter table public.monthly_bookings enable row level security;
revoke all on public.monthly_bookings from anon;
drop policy if exists "mensal: admin" on public.monthly_bookings;
create policy "mensal: admin" on public.monthly_bookings for all to authenticated
  using (lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com')
  with check (lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com');

alter table public.studio_settings add column if not exists monthly_booking jsonb not null default '{}'::jsonb;

-- Configuração (o que não estiver salvo usa o padrão)
create or replace function public.monthly_booking_config()
returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
  select jsonb_build_object(
    'weekday_from', '18:00', 'weekday_to', '21:00',
    'weekend_from', '08:00', 'weekend_to', '18:00',
    'duration_minutes', 120, 'gap_minutes', 120, 'step_minutes', 30,
    'min_notice_hours', 24, 'months_ahead', 2
  ) || coalesce((select monthly_booking from public.studio_settings where id = 1), '{}'::jsonb);
$fn$;
revoke all on function public.monthly_booking_config() from public, anon, authenticated;

-- Contrato de acompanhamento pelo código do link
create or replace function public.monthly_contract(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
  select e
    from public.app_state s, jsonb_array_elements(coalesce(s.payload -> 'events', '[]'::jsonb)) e
   where s.id = 'studio-manager'
     and length(coalesce(p_token, '')) >= 10
     and e ->> 'monthlyToken' = p_token
     and coalesce(e ->> 'status', '') <> 'Cancelado'
   limit 1;
$fn$;
revoke all on function public.monthly_contract(text) from public, anon, authenticated;

-- Sessões do contrato: as da Agenda + as reservadas pelo link que o app ainda não trouxe
create or replace function public.monthly_sessions(p_contract_id text)
returns table (starts_at timestamptz, theme text, number int, source text)
language sql
stable
security definer
set search_path = public
as $fn$
  with ev as (
    select e
      from public.app_state s, jsonb_array_elements(coalesce(s.payload -> 'events', '[]'::jsonb)) e
     where s.id = 'studio-manager'
  )
  select case when coalesce(e ->> 'startTime', '') ~ '^[0-9]{1,2}:[0-9]{2}'
              then ((e ->> 'eventDate')::date + substring(e ->> 'startTime' from '^[0-9]{1,2}:[0-9]{2}')::time) at time zone 'America/Sao_Paulo'
              else (e ->> 'eventDate')::date::timestamp at time zone 'America/Sao_Paulo' end,
         nullif(e ->> 'sessionTheme', ''),
         nullif(e ->> 'sessionNumber', '')::int,
         'agenda'
    from ev
   where e ->> 'parentEventId' = p_contract_id
     and coalesce(e ->> 'status', '') <> 'Cancelado'
     and coalesce(e ->> 'eventDate', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  union all
  select m.starts_at, m.theme, null, 'link'
    from public.monthly_bookings m
   where m.contract_id = p_contract_id
     and m.status = 'confirmado'
     and not exists (select 1 from ev where ev.e ->> 'monthlyBookingId' = m.id::text);
$fn$;
revoke all on function public.monthly_sessions(text) from public, anon, authenticated;

-- Tudo o que ocupa a agenda: trabalhos da Agenda, reservas do Natal e reservas deste link ainda não trazidas
create or replace function public.monthly_busy()
returns table (busy_from timestamptz, busy_to timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  return query select r.busy_from, r.busy_to from public.studio_busy_ranges() r;

  if to_regclass('public.bookings') is not null then
    return query execute $q$
      select b.starts_at,
             b.starts_at + make_interval(mins => coalesce(c.slot_minutes, 30) * (case when coalesce((to_jsonb(b) ->> 'is_double')::boolean, false) then 2 else 1 end))
        from public.bookings b
        left join public.booking_campaigns c on c.id = b.campaign_id
       where b.status <> 'cancelado' and b.starts_at >= now() - interval '1 day'
    $q$;
  end if;

  return query
    select m.starts_at, m.ends_at
      from public.monthly_bookings m
     where m.status = 'confirmado'
       and m.starts_at >= now() - interval '1 day'
       and not exists (
         select 1 from public.app_state s, jsonb_array_elements(coalesce(s.payload -> 'events', '[]'::jsonb)) e
          where s.id = 'studio-manager' and e ->> 'monthlyBookingId' = m.id::text
       );
end;
$fn$;
revoke all on function public.monthly_busy() from public, anon, authenticated;

-- Horários livres de um mês ('2026-12') para o contrato do link
create or replace function public.monthly_free_times(p_token text, p_month text)
returns table (starts_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  cfg jsonb := public.monthly_booking_config();
  c jsonb := public.monthly_contract(p_token);
  v_month date;
  v_first date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
  v_dur interval := make_interval(mins => (cfg ->> 'duration_minutes')::int);
  v_gap interval := make_interval(mins => (cfg ->> 'gap_minutes')::int);
  v_step interval := make_interval(mins => greatest(15, (cfg ->> 'step_minutes')::int));
  v_min timestamptz := now() + make_interval(hours => (cfg ->> 'min_notice_hours')::int);
begin
  if c is null or coalesce(p_month, '') !~ '^[0-9]{4}-[0-9]{2}$' then return; end if;
  v_month := (p_month || '-01')::date;
  if v_month < v_first or v_month >= (v_first + make_interval(months => (cfg ->> 'months_ahead')::int))::date then return; end if;
  if exists (select 1 from public.monthly_sessions(c ->> 'id') s
              where date_trunc('month', s.starts_at at time zone 'America/Sao_Paulo')::date = v_month) then
    return;
  end if;

  return query
  with days as (
    select d::date as day,
           case when extract(isodow from d) in (6, 7) then (cfg ->> 'weekend_from')::time else (cfg ->> 'weekday_from')::time end as t_from,
           case when extract(isodow from d) in (6, 7) then (cfg ->> 'weekend_to')::time else (cfg ->> 'weekday_to')::time end as t_to
      from generate_series(v_month, (v_month + interval '1 month' - interval '1 day')::date, interval '1 day') d
  ),
  cand as (
    select (days.day + days.t_from + n * v_step) at time zone 'America/Sao_Paulo' as ts
      from days, generate_series(0, 96) n
     where n * v_step + v_dur <= days.t_to - days.t_from
  ),
  busy as (select * from public.monthly_busy())
  select cand.ts
    from cand
   where cand.ts >= v_min
     and not exists (select 1 from public.studio_blocked_dates((cand.ts at time zone 'America/Sao_Paulo')::date, (cand.ts at time zone 'America/Sao_Paulo')::date))
     and not exists (select 1 from busy b where cand.ts < b.busy_to + v_gap and cand.ts + v_dur > b.busy_from - v_gap)
   order by cand.ts;
end;
$fn$;
revoke all on function public.monthly_free_times(text, text) from public;
grant execute on function public.monthly_free_times(text, text) to anon, authenticated;

-- Dados da página do link: cliente, meses que pode marcar e sessões já marcadas
create or replace function public.get_monthly_booking(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  cfg jsonb := public.monthly_booking_config();
  c jsonb := public.monthly_contract(p_token);
  v_first date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
  v_months jsonb := '[]'::jsonb;
  v_m date;
  v_s record;
begin
  if c is null then return null; end if;
  for i in 0 .. greatest(1, (cfg ->> 'months_ahead')::int) - 1 loop
    v_m := (v_first + make_interval(months => i))::date;
    select s.starts_at, s.theme into v_s
      from public.monthly_sessions(c ->> 'id') s
     where date_trunc('month', s.starts_at at time zone 'America/Sao_Paulo')::date = v_m
     order by s.starts_at limit 1;
    v_months := v_months || jsonb_build_object(
      'month', to_char(v_m, 'YYYY-MM'),
      'booked_at', case when v_s.starts_at is null then null else to_char(v_s.starts_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI') end,
      'theme', v_s.theme
    );
    v_s := null;
  end loop;
  return jsonb_build_object(
    'client_name', split_part(trim(coalesce(c ->> 'clientName', '')), ' ', 1),
    'duration_minutes', (cfg ->> 'duration_minutes')::int,
    'months', v_months,
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object('at', to_char(s.starts_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI'), 'theme', s.theme) order by s.starts_at)
        from public.monthly_sessions(c ->> 'id') s
    ), '[]'::jsonb)
  );
end;
$fn$;
revoke all on function public.get_monthly_booking(text) from public;
grant execute on function public.get_monthly_booking(text) to anon, authenticated;

-- Marca a sessão (confere de novo se o horário continua livre)
create or replace function public.book_monthly_session(p_token text, p_starts_at timestamptz, p_theme text default null, p_notes text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $fn$
declare
  cfg jsonb := public.monthly_booking_config();
  c jsonb;
  v_month text;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('agendamento-mensal'));
  c := public.monthly_contract(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'link'); end if;
  v_month := to_char(p_starts_at at time zone 'America/Sao_Paulo', 'YYYY-MM');
  if not exists (select 1 from public.monthly_free_times(p_token, v_month) f where f.starts_at = p_starts_at) then
    return jsonb_build_object('ok', false, 'error', 'ocupado');
  end if;
  insert into public.monthly_bookings (token, contract_id, client_name, starts_at, ends_at, theme, notes)
  values (p_token, c ->> 'id', c ->> 'clientName', p_starts_at,
          p_starts_at + make_interval(mins => (cfg ->> 'duration_minutes')::int),
          nullif(left(trim(coalesce(p_theme, '')), 120), ''), nullif(left(trim(coalesce(p_notes, '')), 600), ''))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$fn$;
revoke all on function public.book_monthly_session(text, timestamptz, text, text) from public;
grant execute on function public.book_monthly_session(text, timestamptz, text, text) to anon, authenticated;
