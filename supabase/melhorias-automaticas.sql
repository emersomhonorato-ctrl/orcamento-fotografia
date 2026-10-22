-- =====================================================================
-- Melhorias: liberar reservas sem Pix + backup diário automático
-- =====================================================================
create extension if not exists pg_cron;

alter table public.booking_campaigns
  add column if not exists payment_hold_hours int not null default 24;
alter table public.bookings
  add column if not exists canceled_at timestamptz,
  add column if not exists canceled_reason text;

-- Cancela reservas que não pagaram dentro do prazo e libera o horário
create or replace function public.release_unpaid_bookings()
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count int;
begin
  with expiradas as (
    update public.bookings b
       set status = 'cancelado', canceled_at = now(), canceled_reason = 'Pix não pago no prazo'
      from public.booking_campaigns c
     where b.campaign_id = c.id
       and b.status = 'aguardando_sinal'
       and coalesce(c.payment_hold_hours, 0) > 0
       and b.created_at < now() - make_interval(hours => c.payment_hold_hours)
    returning b.slot_id
  ), liberados as (
    update public.booking_slots s set status = 'livre'
     where s.id in (select slot_id from expiradas) and s.status = 'reservado'
    returning s.id
  )
  select count(*) into v_count from expiradas;
  return v_count;
end;
$fn$;
revoke all on function public.release_unpaid_bookings() from public, anon, authenticated;

-- Backup diário dos dados do app (guarda 30 dias)
create schema if not exists backup;
create table if not exists backup.app_state_daily (
  day date primary key,
  payload jsonb not null,
  saved_at timestamptz not null default now()
);
alter table backup.app_state_daily enable row level security;
revoke all on backup.app_state_daily from anon, authenticated;

create or replace function public.backup_app_state_daily()
returns void
language sql
security definer
set search_path = public
as $fn$
  insert into backup.app_state_daily (day, payload, saved_at)
  select (now() at time zone 'America/Sao_Paulo')::date, payload, now()
    from public.app_state where id = 'studio-manager'
  on conflict (day) do update set payload = excluded.payload, saved_at = now();
  delete from backup.app_state_daily where day < (now() at time zone 'America/Sao_Paulo')::date - 30;
$fn$;
revoke all on function public.backup_app_state_daily() from public, anon, authenticated;

-- Agendamentos automáticos
select cron.unschedule(jobid) from cron.job where jobname in ('liberar-reservas-sem-pix', 'backup-diario-app');
select cron.schedule('liberar-reservas-sem-pix', '*/15 * * * *', 'select public.release_unpaid_bookings()');
select cron.schedule('backup-diario-app', '0 6 * * *', 'select public.backup_app_state_daily()');

-- Primeiro backup agora
select public.backup_app_state_daily();

select jobname, schedule, active,
  (select count(*) from public.bookings where status = 'aguardando_sinal') as aguardando,
  (select count(*) from public.bookings where status = 'aguardando_sinal' and created_at < now() - interval '24 hours') as vencidas,
  (select count(*) from backup.app_state_daily) as backups
from cron.job where jobname in ('liberar-reservas-sem-pix', 'backup-diario-app');
