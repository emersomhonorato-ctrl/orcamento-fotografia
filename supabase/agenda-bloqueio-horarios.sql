-- =====================================================================
-- Agenda online: qualquer evento da Agenda bloqueia os horários de
-- ensaio (Natal etc.) que caem no mesmo período.
--  - evento sem hora de início  -> bloqueia o dia inteiro
--  - evento sem hora de término -> bloqueia 2 horas a partir do início
--  - término 00:00 ou antes do início -> bloqueia até o fim do dia
--  - eventos cancelados e as próprias reservas da agenda online não contam
-- Se o evento muda ou é cancelado, o horário volta a ficar livre sozinho.
-- =====================================================================
alter table public.booking_slots add column if not exists event_block boolean not null default false;

create or replace function public.studio_busy_ranges()
returns table (busy_from timestamptz, busy_to timestamptz)
language sql
stable
security definer
set search_path = public
as $fn$
  select
    case when st is null then d::timestamp at time zone 'America/Sao_Paulo'
         else (d + st) at time zone 'America/Sao_Paulo' end,
    case when st is null then (d + 1)::timestamp at time zone 'America/Sao_Paulo'
         when et is null then (d + st + interval '2 hours') at time zone 'America/Sao_Paulo'
         when et <= st then (d + 1)::timestamp at time zone 'America/Sao_Paulo'
         else (d + et) at time zone 'America/Sao_Paulo' end
  from (
    select (e ->> 'eventDate')::date as d,
           case when coalesce(e ->> 'startTime', '') ~ '^[0-9]{1,2}:[0-9]{2}' then substring(e ->> 'startTime' from '^[0-9]{1,2}:[0-9]{2}')::time end as st,
           case when coalesce(e ->> 'endTime', '') ~ '^[0-9]{1,2}:[0-9]{2}' then substring(e ->> 'endTime' from '^[0-9]{1,2}:[0-9]{2}')::time end as et
      from public.app_state s, jsonb_array_elements(coalesce(s.payload -> 'events', '[]'::jsonb)) e
     where s.id = 'studio-manager'
       and coalesce(e ->> 'recordType', 'evento') = 'evento'
       and coalesce(e ->> 'status', '') <> 'Cancelado'
       and coalesce(e ->> 'bookingId', '') = ''
       and coalesce(e ->> 'eventDate', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       and (e ->> 'eventDate')::date >= current_date - 1
  ) x;
$fn$;
revoke all on function public.studio_busy_ranges() from public, anon, authenticated;

create or replace function public.event_hit_slot_ids()
returns table (id uuid)
language sql
stable
security definer
set search_path = public
as $fn$
  select distinct sl.id
    from public.booking_slots sl
    join public.booking_campaigns c on c.id = sl.campaign_id
    join public.studio_busy_ranges() r
      on sl.starts_at < r.busy_to
     and sl.starts_at + make_interval(mins => coalesce(c.slot_minutes, 30)) > r.busy_from
   where sl.starts_at >= now() - interval '1 day';
$fn$;
revoke all on function public.event_hit_slot_ids() from public, anon, authenticated;

create or replace function public.sync_event_slot_blocks()
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_blocked int;
begin
  update public.booking_slots sl set status = 'bloqueado', event_block = true
   where sl.status = 'livre' and sl.id in (select h.id from public.event_hit_slot_ids() h);
  get diagnostics v_blocked = row_count;

  update public.booking_slots sl set status = 'livre', event_block = false
   where sl.event_block and sl.status = 'bloqueado'
     and sl.id not in (select h.id from public.event_hit_slot_ids() h);

  update public.booking_slots sl set event_block = false
   where sl.event_block and sl.status = 'reservado';
  return v_blocked;
end;
$fn$;
revoke all on function public.sync_event_slot_blocks() from public, anon, authenticated;

create or replace function public.app_state_sync_slot_blocks()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.id = 'studio-manager' then
    perform public.sync_event_slot_blocks();
  end if;
  return null;
end;
$fn$;
revoke all on function public.app_state_sync_slot_blocks() from public, anon, authenticated;
drop trigger if exists app_state_sync_slot_blocks on public.app_state;
create trigger app_state_sync_slot_blocks after insert or update on public.app_state
  for each row execute function public.app_state_sync_slot_blocks();

-- Horários novos criados na aba Natal também já nascem bloqueados se baterem com evento
create or replace function public.booking_slots_sync_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  perform public.sync_event_slot_blocks();
  return null;
end;
$fn$;
revoke all on function public.booking_slots_sync_after_insert() from public, anon, authenticated;
drop trigger if exists booking_slots_sync_after_insert on public.booking_slots;
create trigger booking_slots_sync_after_insert after insert on public.booking_slots
  for each statement execute function public.booking_slots_sync_after_insert();

select public.sync_event_slot_blocks() as horarios_bloqueados_agora;
select to_char(starts_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') as horario_bloqueado_por_evento
  from public.booking_slots where event_block order by starts_at;
