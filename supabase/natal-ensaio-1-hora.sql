-- =====================================================================
-- Ensaio especial de 1 hora: o cliente reserva 2 horários seguidos,
-- recebe o dobro de fotos e paga o dobro do pacote.
-- Supabase > SQL Editor > cole tudo > Run. Pode rodar mais de uma vez.
-- =====================================================================
alter table public.bookings
  add column if not exists is_double boolean not null default false,
  add column if not exists second_slot_id uuid references public.booking_slots(id) on delete set null;

drop function if exists public.book_slot(uuid, text, text, text, text, text, int, text, text, date);
drop function if exists public.book_slot(uuid, text, text, text, text, text, int, text, text, date, boolean);

create function public.book_slot(
  p_slot_id uuid, p_package text, p_name text, p_whatsapp text, p_email text,
  p_notes text default null, p_extra_people int default 0, p_payment text default 'sinal',
  p_cpf text default null, p_birth_date date default null, p_double boolean default false
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
  n public.booking_slots;
  v_double boolean := coalesce(p_double, false);
  v_mult int;
  v_cpf text := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');
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

  if v_cpf is not null and not public.is_valid_cpf(v_cpf) then
    raise exception 'Informe um CPF válido.';
  end if;
  if p_birth_date is not null and (p_birth_date < date '1900-01-01' or p_birth_date > current_date) then
    raise exception 'Confira a data de nascimento.';
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

  if v_double then
    select * into n from public.booking_slots
     where campaign_id = s.campaign_id
       and starts_at = s.starts_at + make_interval(mins => coalesce(c.slot_minutes, 30))
     for update;
    if not found or n.status <> 'livre' then
      raise exception 'O horário seguinte acabou de ser reservado. Escolha outro horário para o ensaio de 1 hora.';
    end if;
  end if;
  v_mult := case when v_double then 2 else 1 end;

  select x into pkg from jsonb_array_elements(c.packages) x where x ->> 'name' = p_package limit 1;
  if pkg is null then raise exception 'Escolha um pacote.'; end if;

  if coalesce(c.extra_person_price, 0) <= 0 then v_extra := 0; end if;
  if v_extra > coalesce(c.max_extra_people, 5) then
    raise exception 'Máximo de % pessoas extras. Para mais, fale comigo pelo WhatsApp.', coalesce(c.max_extra_people, 5);
  end if;
  if v_payment = 'total' and not coalesce(c.allow_full_payment, true) then v_payment := 'sinal'; end if;

  v_price := (pkg ->> 'price')::numeric * v_mult;
  v_extra_amount := round(v_extra * coalesce(c.extra_person_price, 0), 2);
  v_total := v_price + v_extra_amount;
  v_deposit := case when v_payment = 'total' then v_total
                    else round(v_total * coalesce(c.deposit_percent, 50) / 100.0, 2) end;

  update public.booking_slots set status = 'reservado' where id = s.id;
  if v_double then update public.booking_slots set status = 'reservado' where id = n.id; end if;
  insert into public.bookings (campaign_id, slot_id, starts_at, status, package_name, package_photos, package_price,
                               extra_people, extra_people_amount, total_price, payment_choice, deposit_amount,
                               name, whatsapp, email, notes, cpf, birth_date, is_double, second_slot_id)
  values (c.id, s.id, s.starts_at, 'aguardando_sinal', pkg ->> 'name', (pkg ->> 'photos')::int * v_mult, v_price,
          v_extra, v_extra_amount, v_total, v_payment, v_deposit,
          left(trim(p_name), 120), left(trim(p_whatsapp), 30), lower(left(trim(p_email), 160)), left(p_notes, 1000), v_cpf, p_birth_date, v_double, case when v_double then n.id end)
  returning id into b_id;

  return json_build_object('id', b_id, 'starts_at', s.starts_at, 'package', pkg ->> 'name',
    'package_price', v_price, 'extra_people', v_extra, 'extra_amount', v_extra_amount,
    'price', v_total, 'photos', (pkg ->> 'photos')::int * v_mult, 'double', v_double, 'deposit', v_deposit, 'payment', v_payment,
    'status', 'aguardando_sinal');
end;
$fn$;

revoke all on function public.book_slot(uuid, text, text, text, text, text, int, text, text, date, boolean) from public;
grant execute on function public.book_slot(uuid, text, text, text, text, text, int, text, text, date, boolean) to anon, authenticated;


-- Pedido de orçamento: CPF também (padrão igual ao da reserva)
alter table public.budget_requests
  add column if not exists cpf text check (cpf is null or cpf ~ '^[0-9]{11}$');
grant insert (cpf) on public.budget_requests to anon;

-- O 2º horário acompanha o 1º: liberou (cancelamento, sinal não pago) ou voltou a reservar (pagamento), o par segue junto
create or replace function public.booking_slots_pair_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if pg_trigger_depth() > 1 or new.status not in ('livre', 'reservado') then
    return null;
  end if;
  if new.status = 'livre' then
    update public.booking_slots sl set status = 'livre'
     where sl.status = 'reservado'
       and sl.id in (select b.second_slot_id from public.bookings b where b.slot_id = new.id and b.is_double and b.second_slot_id is not null)
       and not exists (select 1 from public.bookings o
                        where o.status in ('aguardando_sinal', 'confirmado')
                          and (o.slot_id = sl.id or (o.is_double and o.second_slot_id = sl.id)));
  else
    update public.booking_slots sl set status = 'reservado'
     where sl.status = 'livre'
       and sl.id in (select b.second_slot_id from public.bookings b
                      where b.slot_id = new.id and b.is_double and b.second_slot_id is not null
                        and b.status in ('aguardando_sinal', 'confirmado'));
  end if;
  return null;
end;
$fn$;
revoke all on function public.booking_slots_pair_sync() from public, anon, authenticated;
drop trigger if exists booking_slots_pair_sync on public.booking_slots;
create trigger booking_slots_pair_sync after update of status on public.booking_slots
  for each row when (old.status is distinct from new.status)
  execute function public.booking_slots_pair_sync();

notify pgrst, 'reload schema';
select pg_get_function_identity_arguments('public.book_slot'::regproc) as args;
