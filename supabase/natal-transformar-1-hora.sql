-- =====================================================================
-- Aba Ensaios: o estúdio transforma uma reserva de 30 min em ensaio de 1 hora
-- (reserva o horário seguinte, dobra fotos e pacote, recalcula sinal/total).
-- Pode rodar mais de uma vez.
-- =====================================================================
create or replace function public.admin_make_double(p_booking_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  b public.bookings;
  c public.booking_campaigns;
  n public.booking_slots;
  pkg jsonb;
  v_old_total numeric;
  v_price numeric;
  v_photos int;
  v_total numeric;
  v_deposit numeric;
begin
  if not public.is_studio_team() then
    raise exception 'Somente a equipe do estúdio pode fazer isso.';
  end if;

  select * into b from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Reserva não encontrada.'; end if;
  if b.status not in ('aguardando_sinal', 'confirmado') then raise exception 'Esta reserva não está ativa.'; end if;
  if b.is_double then raise exception 'Esta reserva já é um ensaio de 1 hora.'; end if;

  select * into c from public.booking_campaigns where id = b.campaign_id;
  select * into n from public.booking_slots
   where campaign_id = b.campaign_id
     and starts_at = b.starts_at + make_interval(mins => coalesce(c.slot_minutes, 30))
   for update;
  if not found then raise exception 'Não existe horário logo depois deste para formar 1 hora.'; end if;
  if n.status = 'reservado' then raise exception 'O horário seguinte já está reservado por outra pessoa.'; end if;

  select x into pkg from jsonb_array_elements(c.packages) x where x ->> 'name' = b.package_name limit 1;
  v_old_total := coalesce(b.total_price, coalesce(b.package_price, 0) + coalesce(b.extra_people_amount, 0));
  v_price := coalesce((pkg ->> 'price')::numeric, b.package_price) * 2;
  v_photos := coalesce((pkg ->> 'photos')::int, b.package_photos) * 2;
  v_total := v_price + coalesce(b.extra_people_amount, 0);
  v_deposit := case
    when b.status = 'aguardando_sinal' and b.payment_choice = 'total' then v_total
    when b.status = 'aguardando_sinal' then round(v_total * coalesce(c.deposit_percent, 50) / 100.0, 2)
    else b.deposit_amount end;

  update public.booking_slots set status = 'reservado', event_block = false where id = n.id;
  update public.bookings
     set is_double = true, second_slot_id = n.id,
         package_price = v_price, package_photos = v_photos, total_price = v_total, deposit_amount = v_deposit,
         notes = concat_ws(E'\n', nullif(notes, ''), 'Transformado em ensaio de 1 hora pelo estúdio em ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') || '.')
   where id = b.id
   returning * into b;

  return json_build_object('extra', v_total - v_old_total, 'booking', row_to_json(b));
end;
$fn$;
revoke all on function public.admin_make_double(uuid) from public, anon;
grant execute on function public.admin_make_double(uuid) to authenticated;
notify pgrst, 'reload schema';
select 'ok' as pronto;
