-- =====================================================================
-- Pagamento com cartão (Mercado Pago Checkout Pro)
-- A chave (Access Token) fica guardada só no banco (schema private) e
-- nunca vai para o navegador. O banco conversa com o Mercado Pago pela
-- extensão http.
-- =====================================================================
create extension if not exists http with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.payment_settings (
  id int primary key default 1 check (id = 1),
  mp_access_token text,
  mp_account text,
  updated_at timestamptz not null default now()
);
insert into private.payment_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  kind text not null default 'avulso' check (kind in ('avulso', 'booking')),
  booking_id uuid references public.bookings(id) on delete set null,
  event_id text,
  client_name text not null,
  client_whatsapp text,
  client_email text,
  description text not null,
  amount numeric(10,2) not null check (amount >= 1),
  max_installments int not null default 12 check (max_installments between 1 and 12),
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'cancelado')),
  expires_at timestamptz,
  mp_preference_id text,
  mp_init_point text,
  mp_preference_amount numeric(10,2),
  mp_payment_id text,
  mp_status text,
  mp_status_detail text,
  payment_method text,
  installments int,
  paid_amount numeric(10,2),
  net_amount numeric(10,2),
  paid_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payments_booking_idx on public.payments (booking_id);
create index if not exists payments_status_idx on public.payments (status, created_at desc);

alter table public.payments enable row level security;
drop policy if exists "payments: admin" on public.payments;
create policy "payments: admin" on public.payments for all to authenticated
  using (lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com')
  with check (lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com');

-- ---------------------------------------------------------------------
-- Chamada à API do Mercado Pago
-- ---------------------------------------------------------------------
create or replace function private.mp_request(p_method text, p_path text, p_body jsonb default null, p_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  tok text := p_token;
  r extensions.http_response;
  v_body jsonb;
begin
  if tok is null then
    select mp_access_token into tok from private.payment_settings where id = 1;
  end if;
  if coalesce(tok, '') = '' then
    raise exception 'O pagamento com cartão ainda não foi ativado.';
  end if;
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '20000');
  select * into r from extensions.http((
    p_method,
    'https://api.mercadopago.com' || p_path,
    array[extensions.http_header('Authorization', 'Bearer ' || tok)],
    'application/json',
    case when p_body is null then null else p_body::text end
  )::extensions.http_request);
  begin
    v_body := r.content::jsonb;
  exception when others then
    v_body := to_jsonb(left(coalesce(r.content, ''), 500));
  end;
  return jsonb_build_object('status', r.status, 'body', v_body);
end;
$fn$;
revoke all on function private.mp_request(text, text, jsonb, text) from public, anon, authenticated;

-- Aplica um pagamento do Mercado Pago na cobrança (e na reserva, se tiver)
create or replace function private.mp_apply_payment(p jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_ref uuid;
  pay public.payments;
  b public.bookings;
  v_status text := p ->> 'status';
  v_amt numeric := nullif(p ->> 'transaction_amount', '')::numeric;
begin
  begin
    v_ref := (p ->> 'external_reference')::uuid;
  exception when others then
    return 'referência inválida';
  end;
  select * into pay from public.payments where id = v_ref for update;
  if not found then return 'cobrança não encontrada'; end if;

  if pay.status = 'pago' then
    if pay.mp_payment_id = p ->> 'id' and v_status in ('refunded', 'charged_back', 'cancelled') then
      update public.payments set status = 'cancelado', mp_status = v_status, mp_status_detail = p ->> 'status_detail',
             note = left(concat_ws(' | ', note, 'Pagamento estornado no Mercado Pago'), 1000), updated_at = now()
       where id = pay.id;
      return v_status;
    end if;
    if pay.mp_payment_id is distinct from p ->> 'id' and v_status = 'approved'
       and coalesce(pay.note, '') not like '%' || (p ->> 'id') || '%' then
      update public.payments set note = left(concat_ws(' | ', note, 'Atenção: pagamento em dobro no Mercado Pago (' || (p ->> 'id') || ')'), 1000), updated_at = now()
       where id = pay.id;
    end if;
    return 'já pago';
  end if;

  if pay.mp_payment_id is not null and pay.mp_payment_id <> p ->> 'id' and v_status <> 'approved' then
    return 'ignorado';
  end if;

  update public.payments
     set mp_payment_id = p ->> 'id', mp_status = v_status, mp_status_detail = p ->> 'status_detail',
         payment_method = p ->> 'payment_type_id', installments = nullif(p ->> 'installments', '')::int,
         updated_at = now()
   where id = pay.id;

  if v_status = 'approved' and coalesce(v_amt, 0) + 0.01 >= pay.amount then
    update public.payments
       set status = 'pago', paid_at = coalesce(nullif(p ->> 'date_approved', '')::timestamptz, now()),
           paid_amount = v_amt,
           net_amount = nullif(p #>> '{transaction_details,net_received_amount}', '')::numeric
     where id = pay.id;

    if pay.booking_id is not null then
      select * into b from public.bookings where id = pay.booking_id for update;
      if found then
        if b.status = 'aguardando_sinal' then
          update public.bookings set status = 'confirmado', paid_at = now() where id = b.id;
        elsif b.status <> 'confirmado' then
          if exists (select 1 from public.booking_slots s where s.id = b.slot_id and s.status = 'livre') then
            update public.booking_slots set status = 'reservado' where id = b.slot_id;
            update public.bookings set status = 'confirmado', paid_at = now(), canceled_at = null, canceled_reason = null where id = b.id;
          else
            update public.payments
               set note = left(concat_ws(' | ', note, 'Pago depois que a reserva foi liberada e o horário já foi ocupado: combinar novo horário ou devolver'), 1000)
             where id = pay.id;
          end if;
        end if;
      end if;
    end if;

    begin
      execute 'select private.notify_whatsapp($1)' using
        format('💳 Pagamento recebido: %s — %s (%s)', pay.client_name, pay.description,
               to_char(v_amt, 'FM"R$ "999G990D00'));
    exception when others then null;
    end;
    return 'pago';
  end if;
  return coalesce(v_status, 'desconhecido');
end;
$fn$;
revoke all on function private.mp_apply_payment(jsonb) from public, anon, authenticated;

-- Procura no Mercado Pago os pagamentos de uma cobrança
create or replace function private.mp_sync_payment_row(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r jsonb;
  item jsonb;
  v_last text := 'sem pagamento';
begin
  r := private.mp_request('GET', '/v1/payments/search?sort=date_created&criteria=asc&external_reference=' || p_id::text);
  if (r ->> 'status')::int >= 300 then
    return 'erro ' || (r ->> 'status');
  end if;
  for item in select * from jsonb_array_elements(coalesce(r #> '{body,results}', '[]'::jsonb)) loop
    v_last := private.mp_apply_payment(item);
  end loop;
  return v_last;
end;
$fn$;
revoke all on function private.mp_sync_payment_row(uuid) from public, anon, authenticated;

-- Cria (ou reaproveita) o link de pagamento do Mercado Pago
create or replace function private.mp_checkout_url(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  pay public.payments;
  v_first text;
  v_last text;
  v_back text;
  v_pref jsonb;
  r jsonb;
begin
  select * into pay from public.payments where id = p_id for update;
  if not found then raise exception 'Cobrança não encontrada.'; end if;
  if pay.status = 'pago' then raise exception 'Esta cobrança já foi paga. Obrigado!'; end if;
  if pay.status = 'cancelado' then raise exception 'Esta cobrança foi cancelada.'; end if;
  if pay.expires_at is not null and pay.expires_at < now() then raise exception 'Este link de pagamento venceu. Fale comigo pelo WhatsApp.'; end if;

  if pay.mp_init_point is not null and pay.mp_preference_amount = pay.amount then
    return pay.mp_init_point;
  end if;

  v_first := split_part(trim(pay.client_name), ' ', 1);
  v_last := nullif(trim(substr(trim(pay.client_name), length(v_first) + 1)), '');
  v_back := 'https://orcamento.emersonhonoratoretratos.com.br/pagar/' || pay.slug || '?retorno=';

  v_pref := jsonb_build_object(
    'items', jsonb_build_array(jsonb_build_object(
      'id', pay.slug, 'title', left(pay.description, 250), 'quantity', 1,
      'unit_price', pay.amount, 'currency_id', 'BRL')),
    'payer', jsonb_strip_nulls(jsonb_build_object('name', v_first, 'surname', v_last,
      'email', nullif(pay.client_email, ''))),
    'external_reference', pay.id::text,
    'notification_url', 'https://orcamento.emersonhonoratoretratos.com.br/api/mp-webhook',
    'back_urls', jsonb_build_object('success', v_back || 'ok', 'pending', v_back || 'pendente', 'failure', v_back || 'falhou'),
    'auto_return', 'approved',
    'statement_descriptor', 'EHRETRATOS',
    'payment_methods', jsonb_build_object(
      'installments', pay.max_installments,
      'excluded_payment_types', jsonb_build_array(jsonb_build_object('id', 'ticket')))
  );

  r := private.mp_request('POST', '/checkout/preferences', v_pref);
  if (r ->> 'status')::int = 401 then
    raise exception 'A chave do Mercado Pago não foi aceita. Avise o estúdio, por favor.';
  elsif (r ->> 'status')::int >= 300 or (r #>> '{body,init_point}') is null then
    raise exception 'Não consegui abrir o pagamento agora (código %). Tente de novo em instantes.', r ->> 'status';
  end if;

  update public.payments
     set mp_preference_id = r #>> '{body,id}', mp_init_point = r #>> '{body,init_point}',
         mp_preference_amount = pay.amount, updated_at = now()
   where id = pay.id;
  return r #>> '{body,init_point}';
end;
$fn$;
revoke all on function private.mp_checkout_url(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Funções públicas (página do cliente)
-- ---------------------------------------------------------------------
create or replace function public.card_payments_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce((select mp_access_token is not null and mp_access_token <> '' from private.payment_settings where id = 1), false);
$fn$;
grant execute on function public.card_payments_enabled() to anon, authenticated;

create or replace function public.get_payment(p_slug text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  pay public.payments;
begin
  select * into pay from public.payments where slug = lower(trim(p_slug));
  if not found then return null; end if;
  return json_build_object(
    'slug', pay.slug, 'client_name', pay.client_name, 'description', pay.description,
    'amount', pay.amount, 'max_installments', pay.max_installments,
    'status', case when pay.status = 'pendente' and pay.expires_at is not null and pay.expires_at < now() then 'vencido' else pay.status end,
    'mp_status', pay.mp_status, 'paid_at', pay.paid_at, 'installments', pay.installments,
    'payment_method', pay.payment_method, 'expires_at', pay.expires_at, 'kind', pay.kind);
end;
$fn$;
grant execute on function public.get_payment(text) to anon, authenticated;

create or replace function public.pay_checkout(p_slug text)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
begin
  select id into v_id from public.payments where slug = lower(trim(p_slug));
  if v_id is null then raise exception 'Cobrança não encontrada.'; end if;
  return json_build_object('url', private.mp_checkout_url(v_id));
end;
$fn$;
grant execute on function public.pay_checkout(text) to anon, authenticated;

-- Reserva de ensaio: cria a cobrança no cartão do sinal/valor total
create or replace function public.booking_card_checkout(p_booking_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  b public.bookings;
  c public.booking_campaigns;
  v_id uuid;
  v_slug text;
  v_amount numeric;
begin
  select * into b from public.bookings where id = p_booking_id;
  if not found then raise exception 'Reserva não encontrada.'; end if;
  if b.status = 'confirmado' then raise exception 'Esta reserva já está paga e confirmada.'; end if;
  if b.status <> 'aguardando_sinal' then raise exception 'Esta reserva foi cancelada. Faça uma nova reserva, por favor.'; end if;
  select * into c from public.booking_campaigns where id = b.campaign_id;
  v_amount := coalesce(b.deposit_amount, b.total_price, b.package_price);

  select id, slug into v_id, v_slug from public.payments
   where booking_id = b.id and status = 'pendente' order by created_at desc limit 1;
  if v_id is null then
    insert into public.payments (kind, booking_id, client_name, client_whatsapp, client_email, description, amount, max_installments, expires_at)
    values ('booking', b.id, b.name, b.whatsapp, b.email,
            left(concat(coalesce(c.title, 'Ensaio'), ' — ',
                        case when b.payment_choice = 'total' then 'pagamento' else 'sinal' end, ' (',
                        to_char(b.starts_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'), ')'), 250),
            v_amount, 12, b.starts_at)
    returning id, slug into v_id, v_slug;
  else
    update public.payments set amount = v_amount where id = v_id and amount <> v_amount;
  end if;
  return json_build_object('url', private.mp_checkout_url(v_id), 'slug', v_slug);
end;
$fn$;
grant execute on function public.booking_card_checkout(uuid) to anon, authenticated;

-- Chamado pelo aviso automático do Mercado Pago (webhook) e pela página de retorno
create or replace function public.mp_sync(p_payment_id text)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r jsonb;
begin
  if coalesce(p_payment_id, '') !~ '^[0-9]{3,30}$' then return 'id inválido'; end if;
  r := private.mp_request('GET', '/v1/payments/' || p_payment_id);
  if (r ->> 'status')::int >= 300 then return 'erro ' || (r ->> 'status'); end if;
  return private.mp_apply_payment(r -> 'body');
end;
$fn$;
grant execute on function public.mp_sync(text) to anon, authenticated;

create or replace function public.payment_refresh(p_slug text)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
  v_status text;
begin
  select id, status into v_id, v_status from public.payments where slug = lower(trim(p_slug));
  if v_id is null then return null; end if;
  if v_status = 'pendente' then
    begin
      perform private.mp_sync_payment_row(v_id);
    exception when others then null;
    end;
  end if;
  return public.get_payment(p_slug);
end;
$fn$;
grant execute on function public.payment_refresh(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Funções do administrador
-- ---------------------------------------------------------------------
create or replace function public.admin_mp_status()
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  s private.payment_settings;
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'emersomhonorato@gmail.com' then raise exception 'Sem permissão.'; end if;
  select * into s from private.payment_settings where id = 1;
  return json_build_object(
    'configured', coalesce(s.mp_access_token, '') <> '',
    'tail', right(coalesce(s.mp_access_token, ''), 4),
    'test', coalesce(s.mp_access_token, '') like 'TEST-%',
    'account', s.mp_account,
    'updated_at', s.updated_at);
end;
$fn$;
grant execute on function public.admin_mp_status() to authenticated;

create or replace function public.admin_set_mp_token(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_token text := trim(coalesce(p_token, ''));
  r jsonb;
  v_account text;
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'emersomhonorato@gmail.com' then raise exception 'Sem permissão.'; end if;
  if v_token = '' then
    update private.payment_settings set mp_access_token = null, mp_account = null, updated_at = now() where id = 1;
    return public.admin_mp_status();
  end if;
  if v_token !~ '^(APP_USR|TEST)-[A-Za-z0-9-]{20,}$' then
    raise exception 'Essa não parece a chave certa. Copie o "Access Token" (começa com APP_USR-).';
  end if;
  r := private.mp_request('GET', '/users/me', null, v_token);
  if (r ->> 'status')::int >= 300 then
    raise exception 'O Mercado Pago recusou essa chave (código %). Confira se copiou o Access Token inteiro.', r ->> 'status';
  end if;
  v_account := concat_ws(' · ', nullif(r #>> '{body,nickname}', ''), nullif(r #>> '{body,email}', ''));
  update private.payment_settings set mp_access_token = v_token, mp_account = v_account, updated_at = now() where id = 1;
  return public.admin_mp_status();
end;
$fn$;
grant execute on function public.admin_set_mp_token(text) to authenticated;

create or replace function public.admin_payment_refresh(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'emersomhonorato@gmail.com' then raise exception 'Sem permissão.'; end if;
  return private.mp_sync_payment_row(p_id);
end;
$fn$;
grant execute on function public.admin_payment_refresh(uuid) to authenticated;

-- Confere sozinho, a cada 10 minutos, cobranças abertas que já tiveram link gerado
create or replace function public.mp_sync_pending()
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
  v_count int := 0;
begin
  if not public.card_payments_enabled() then return 0; end if;
  for v_id in
    select id from public.payments
     where status = 'pendente' and mp_preference_id is not null
       and updated_at > now() - interval '10 days'
     order by updated_at desc limit 40
  loop
    begin
      perform private.mp_sync_payment_row(v_id);
      v_count := v_count + 1;
    exception when others then null;
    end;
  end loop;
  return v_count;
end;
$fn$;
revoke all on function public.mp_sync_pending() from public, anon, authenticated;

-- Reserva que abriu pagamento no cartão ganha mais 2 horas antes de ser liberada
create or replace function public.release_unpaid_bookings()
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count int;
begin
  begin
    perform public.mp_sync_pending();
  exception when others then null;
  end;
  with expiradas as (
    update public.bookings b
       set status = 'cancelado', canceled_at = now(), canceled_reason = 'Pagamento não feito no prazo'
      from public.booking_campaigns c
     where b.campaign_id = c.id
       and b.status = 'aguardando_sinal'
       and coalesce(c.payment_hold_hours, 0) > 0
       and b.created_at < now() - make_interval(hours => c.payment_hold_hours)
       and not exists (select 1 from public.payments p
                        where p.booking_id = b.id and p.status = 'pendente'
                          and p.mp_preference_id is not null and p.updated_at > now() - interval '2 hours')
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

select cron.unschedule(jobid) from cron.job where jobname = 'conferir-pagamentos-cartao';
select cron.schedule('conferir-pagamentos-cartao', '*/10 * * * *', 'select public.mp_sync_pending()');

select public.card_payments_enabled() as cartao_ativo,
       (select count(*) from public.payments) as cobrancas,
       (select count(*) from cron.job where jobname = 'conferir-pagamentos-cartao') as agendado;
