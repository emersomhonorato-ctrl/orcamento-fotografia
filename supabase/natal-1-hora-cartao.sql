-- =====================================================================
-- Ensaio de 1 hora: link de pagamento com cartão (Mercado Pago, até 12x)
-- para a diferença cobrada de quem já tinha pago o sinal.
-- O pagamento entra sozinho no Financeiro do agendamento (event_id).
-- Pode rodar mais de uma vez.
-- =====================================================================
create or replace function public.admin_booking_extra_charge(p_booking_id uuid, p_amount numeric)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  b public.bookings;
  c public.booking_campaigns;
  v_event text;
  v_desc text;
  v_id uuid;
  v_slug text;
begin
  if not public.is_studio_team() then raise exception 'Somente a equipe do estúdio pode fazer isso.'; end if;
  if coalesce(p_amount, 0) < 1 then raise exception 'Valor inválido.'; end if;
  select * into b from public.bookings where id = p_booking_id;
  if not found then raise exception 'Reserva não encontrada.'; end if;
  select * into c from public.booking_campaigns where id = b.campaign_id;

  select e ->> 'id' into v_event
    from public.app_state s, jsonb_array_elements(coalesce(s.payload -> 'events', '[]'::jsonb)) e
   where s.id = 'studio-manager' and e ->> 'bookingId' = b.id::text
   limit 1;

  v_desc := left(concat(coalesce(c.title, 'Ensaio'), ' — ensaio de 1 hora, valor adicional (',
                        to_char(b.starts_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'), ')'), 250);

  select id, slug into v_id, v_slug from public.payments
   where status = 'pendente' and description = v_desc and client_whatsapp is not distinct from b.whatsapp
   order by created_at desc limit 1;
  if v_id is null then
    insert into public.payments (kind, event_id, client_name, client_whatsapp, client_email, description, amount, max_installments, expires_at)
    values ('avulso', v_event, b.name, b.whatsapp, b.email, v_desc, round(p_amount, 2), 12, b.starts_at)
    returning id, slug into v_id, v_slug;
  else
    update public.payments set amount = round(p_amount, 2), event_id = coalesce(event_id, v_event),
           mp_preference_id = null, mp_init_point = null, mp_preference_amount = null
     where id = v_id and amount <> round(p_amount, 2);
  end if;
  return json_build_object('slug', v_slug, 'event_id', v_event);
end;
$fn$;
revoke all on function public.admin_booking_extra_charge(uuid, numeric) from public, anon;
grant execute on function public.admin_booking_extra_charge(uuid, numeric) to authenticated;
notify pgrst, 'reload schema';
select 'ok' as pronto;
