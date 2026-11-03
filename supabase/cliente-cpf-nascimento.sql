-- =====================================================================
-- Cadastro do cliente: CPF e data de nascimento
--  - reserva online (Natal): CPF e nascimento (o site exige; o banco valida)
--  - pedido de orçamento: data de nascimento opcional
-- Supabase > SQL Editor > cole tudo > Run. Pode rodar mais de uma vez.
-- =====================================================================
alter table public.bookings
  add column if not exists cpf text check (cpf is null or cpf ~ '^[0-9]{11}$'),
  add column if not exists birth_date date;

alter table public.budget_requests
  add column if not exists birth_date date;
grant insert (birth_date) on public.budget_requests to anon;

create or replace function public.is_valid_cpf(p text)
returns boolean
language plpgsql
immutable
as $fn$
declare
  d text := regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
  s int; r int; i int;
begin
  if length(d) <> 11 or d ~ '^(.)\1{10}$' then return false; end if;
  s := 0;
  for i in 1..9 loop s := s + substr(d, i, 1)::int * (11 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  if r <> substr(d, 10, 1)::int then return false; end if;
  s := 0;
  for i in 1..10 loop s := s + substr(d, i, 1)::int * (12 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  return r = substr(d, 11, 1)::int;
end;
$fn$;

drop function if exists public.book_slot(uuid, text, text, text, text, text, int, text);
drop function if exists public.book_slot(uuid, text, text, text, text, text, int, text, text, date);

create function public.book_slot(
  p_slot_id uuid, p_package text, p_name text, p_whatsapp text, p_email text,
  p_notes text default null, p_extra_people int default 0, p_payment text default 'sinal',
  p_cpf text default null, p_birth_date date default null
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
                               name, whatsapp, email, notes, cpf, birth_date)
  values (c.id, s.id, s.starts_at, 'aguardando_sinal', pkg ->> 'name', (pkg ->> 'photos')::int, v_price,
          v_extra, v_extra_amount, v_total, v_payment, v_deposit,
          left(trim(p_name), 120), left(trim(p_whatsapp), 30), lower(left(trim(p_email), 160)), left(p_notes, 1000), v_cpf, p_birth_date)
  returning id into b_id;

  return json_build_object('id', b_id, 'starts_at', s.starts_at, 'package', pkg ->> 'name',
    'package_price', v_price, 'extra_people', v_extra, 'extra_amount', v_extra_amount,
    'price', v_total, 'photos', pkg ->> 'photos', 'deposit', v_deposit, 'payment', v_payment,
    'status', 'aguardando_sinal');
end;
$fn$;

revoke all on function public.book_slot(uuid, text, text, text, text, text, int, text, text, date) from public;
grant execute on function public.book_slot(uuid, text, text, text, text, text, int, text, text, date) to anon, authenticated;

select pg_get_function_identity_arguments('public.book_slot'::regproc) as args;
select public.is_valid_cpf('52998224725') as cpf_teste_valido, public.is_valid_cpf('11111111111') as cpf_teste_invalido;

-- Pedido de orçamento: CPF também (padrão igual ao da reserva)
alter table public.budget_requests
  add column if not exists cpf text check (cpf is null or cpf ~ '^[0-9]{11}$');
grant insert (cpf) on public.budget_requests to anon;
notify pgrst, 'reload schema';
