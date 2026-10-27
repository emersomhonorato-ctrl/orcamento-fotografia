-- =====================================================================
-- Agenda cheia: quando Emerson e Isabel já têm trabalho no mesmo dia
-- (um evento com "os dois" ou um evento de cada), o dia fica bloqueado
-- para as agendas públicas (ensaios temáticos como o de Natal).
-- =====================================================================
create or replace function public.studio_blocked_dates(p_from date default null, p_to date default null)
returns table (day date)
language sql
stable
security definer
set search_path = public
as $fn$
  select x.d
    from (
      select (e ->> 'eventDate')::date as d, coalesce(e ->> 'photographer', '') as p
        from public.app_state s, jsonb_array_elements(coalesce(s.payload -> 'events', '[]'::jsonb)) e
       where s.id = 'studio-manager'
         and coalesce(e ->> 'recordType', 'evento') = 'evento'
         and coalesce(e ->> 'status', '') <> 'Cancelado'
         and coalesce(e ->> 'eventDate', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    ) x
   where (p_from is null or x.d >= p_from) and (p_to is null or x.d <= p_to)
   group by x.d
  having bool_or(x.p = 'ambos') or (bool_or(x.p = 'emerson') and bool_or(x.p = 'isabel'))
   order by x.d;
$fn$;
revoke all on function public.studio_blocked_dates(date, date) from public;
grant execute on function public.studio_blocked_dates(date, date) to anon, authenticated;

-- Reserva pública não passa em dia bloqueado
create or replace function public.bookings_block_full_days()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_day date := (new.starts_at at time zone 'America/Sao_Paulo')::date;
begin
  if exists (select 1 from public.studio_blocked_dates(v_day, v_day)) then
    raise exception 'Este dia acabou de ficar indisponível na agenda. Escolha outra data, por favor.';
  end if;
  return new;
end;
$fn$;
revoke all on function public.bookings_block_full_days() from public, anon, authenticated;
drop trigger if exists bookings_block_full_days on public.bookings;
create trigger bookings_block_full_days before insert on public.bookings
  for each row execute function public.bookings_block_full_days();

select count(*) as dias_bloqueados_futuros from public.studio_blocked_dates(current_date, null);
