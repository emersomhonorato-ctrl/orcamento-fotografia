-- Black Friday dos ensaios (link /ensaio?promo=BLACK): vale só em 27/11/2026 (horário de Brasília)
-- +5 fotos por pacote e 30% de desconto na foto extra. A data é conferida aqui no servidor.
alter table public.bookings add column if not exists promo text;

create or replace function public.promo_status(p_code text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'code', 'BLACK',
    'active', upper(trim(coalesce(p_code, ''))) = 'BLACK' and (now() at time zone 'America/Sao_Paulo')::date = date '2026-11-27',
    'valid_on', '2026-11-27',
    'bonus_photos', 5,
    'extra_photo_discount', 30
  );
$$;

create or replace function public.apply_booking_promo(p_booking_id uuid, p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  b public.bookings;
  v_bonus int;
begin
  if upper(trim(coalesce(p_code, ''))) <> 'BLACK' or (now() at time zone 'America/Sao_Paulo')::date <> date '2026-11-27' then
    raise exception 'A promoção Black Friday vale só no dia 27/11.';
  end if;
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Reserva não encontrada.'; end if;
  if b.promo is not null then return json_build_object('photos', b.package_photos, 'promo', b.promo); end if;
  if b.created_at < now() - interval '20 minutes' then raise exception 'A promoção precisa ser aplicada na hora da reserva.'; end if;
  v_bonus := 5 * (case when coalesce(b.is_double, false) then 2 else 1 end);
  update public.bookings
     set promo = 'BLACKFRIDAY',
         package_photos = coalesce(package_photos, 0) + v_bonus,
         notes = concat_ws(E'\n', '🖤 Black Friday (27/11): +' || v_bonus || ' fotos e 30% de desconto na foto extra', nullif(notes, ''))
   where id = b.id;
  return json_build_object('photos', coalesce(b.package_photos, 0) + v_bonus, 'bonus', v_bonus, 'promo', 'BLACKFRIDAY');
end;
$fn$;

revoke all on function public.promo_status(text) from public;
revoke all on function public.apply_booking_promo(uuid, text) from public;
grant execute on function public.promo_status(text) to anon, authenticated;
grant execute on function public.apply_booking_promo(uuid, text) to anon, authenticated;

select 'ok' as resultado;
