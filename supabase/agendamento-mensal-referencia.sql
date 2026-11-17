-- =====================================================================
-- Agendamento mensal: "mês de referência" da sessão e tema de cada mês.
--  - Sessão feita em outro mês (ex.: a de outubro feita em 01/11) tem
--    sessionMonth = '2026-10' na Agenda; o link libera o mês certo.
--  - studio_settings.monthly_booking.themes = {"2026-11": "Natal", ...}
--    aparece no link e vira o tema padrão da reserva.
-- =====================================================================
drop function if exists public.monthly_sessions(text);
create function public.monthly_sessions(p_contract_id text)
returns table (starts_at timestamptz, theme text, number int, source text, month_key text)
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
         'agenda',
         case when coalesce(e ->> 'sessionMonth', '') ~ '^[0-9]{4}-[0-9]{2}$' then e ->> 'sessionMonth'
              else left(e ->> 'eventDate', 7) end
    from ev
   where e ->> 'parentEventId' = p_contract_id
     and coalesce(e ->> 'status', '') <> 'Cancelado'
     and coalesce(e ->> 'eventDate', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  union all
  select m.starts_at, m.theme, null, 'link', to_char(m.starts_at at time zone 'America/Sao_Paulo', 'YYYY-MM')
    from public.monthly_bookings m
   where m.contract_id = p_contract_id
     and m.status = 'confirmado'
     and not exists (select 1 from ev where ev.e ->> 'monthlyBookingId' = m.id::text);
$fn$;
revoke all on function public.monthly_sessions(text) from public, anon, authenticated;

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
  if exists (select 1 from public.monthly_sessions(c ->> 'id') s where s.month_key = p_month) then
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
  v_key text;
  v_s record;
begin
  if c is null then return null; end if;
  for i in 0 .. greatest(1, (cfg ->> 'months_ahead')::int) - 1 loop
    v_key := to_char(v_first + make_interval(months => i), 'YYYY-MM');
    select s.starts_at, s.theme into v_s
      from public.monthly_sessions(c ->> 'id') s
     where s.month_key = v_key
     order by s.starts_at limit 1;
    v_months := v_months || jsonb_build_object(
      'month', v_key,
      'booked_at', case when v_s.starts_at is null then null else to_char(v_s.starts_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI') end,
      'theme', v_s.theme,
      'planned_theme', nullif(cfg -> 'themes' ->> v_key, '')
    );
    v_s := null;
  end loop;
  return jsonb_build_object(
    'client_name', split_part(trim(coalesce(c ->> 'clientName', '')), ' ', 1),
    'duration_minutes', (cfg ->> 'duration_minutes')::int,
    'months', v_months,
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object('at', to_char(s.starts_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI'), 'theme', s.theme, 'month', s.month_key) order by s.starts_at)
        from public.monthly_sessions(c ->> 'id') s
    ), '[]'::jsonb)
  );
end;
$fn$;
revoke all on function public.get_monthly_booking(text) from public;
grant execute on function public.get_monthly_booking(text) to anon, authenticated;

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
          coalesce(nullif(left(trim(coalesce(p_theme, '')), 120), ''), nullif(cfg -> 'themes' ->> v_month, '')),
          nullif(left(trim(coalesce(p_notes, '')), 600), ''))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$fn$;
revoke all on function public.book_monthly_session(text, timestamptz, text, text) from public;
grant execute on function public.book_monthly_session(text, timestamptz, text, text) to anon, authenticated;

select 'ok' as resultado;
