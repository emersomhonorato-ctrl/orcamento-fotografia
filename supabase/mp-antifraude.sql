-- =====================================================================
-- Mercado Pago: mais dados de quem paga para o antifraude aprovar o cartão.
-- Envia e-mail, telefone e CPF/CNPJ (do pagamento, do trabalho na Agenda ou da
-- reserva), e marca o item como serviço. Links antigos são refeitos com os dados
-- novos na próxima vez que o cliente clicar em pagar.
-- =====================================================================
alter table public.payments add column if not exists mp_pref_v int;

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
  ev jsonb;
  v_email text;
  v_phone text;
  v_doc text;
  v_payer jsonb;
begin
  select * into pay from public.payments where id = p_id for update;
  if not found then raise exception 'Cobrança não encontrada.'; end if;
  if pay.status = 'pago' then raise exception 'Esta cobrança já foi paga. Obrigado!'; end if;
  if pay.status = 'cancelado' then raise exception 'Esta cobrança foi cancelada.'; end if;
  if pay.expires_at is not null and pay.expires_at < now() then raise exception 'Este link de pagamento venceu. Fale comigo pelo WhatsApp.'; end if;

  if pay.mp_init_point is not null and pay.mp_preference_amount = pay.amount and coalesce(pay.mp_pref_v, 1) >= 2 then
    return pay.mp_init_point;
  end if;

  v_first := split_part(trim(pay.client_name), ' ', 1);
  v_last := nullif(trim(substr(trim(pay.client_name), length(v_first) + 1)), '');
  v_back := 'https://orcamento.emersonhonoratoretratos.com.br/pagar/' || pay.slug || '?retorno=';

  -- Dados de quem paga (o antifraude do Mercado Pago aprova mais quando recebe e-mail, telefone e CPF)
  if coalesce(pay.event_id, '') <> '' then
    select e into ev
      from public.app_state s, jsonb_array_elements(coalesce(s.payload -> 'events', '[]'::jsonb)) e
     where s.id = 'studio-manager' and e ->> 'id' = pay.event_id
     limit 1;
  end if;
  v_email := coalesce(nullif(trim(pay.client_email), ''), nullif(trim(ev ->> 'email'), ''));
  v_phone := regexp_replace(coalesce(nullif(pay.client_whatsapp, ''), ev ->> 'whatsapp', ev ->> 'phone', ''), '\D', '', 'g');
  if pay.booking_id is not null then
    begin
      select coalesce(v_email, nullif(trim(b.email), '')), coalesce(nullif(v_phone, ''), regexp_replace(coalesce(b.whatsapp, ''), '\D', '', 'g'))
        into v_email, v_phone
        from public.bookings b where b.id = pay.booking_id;
    exception when others then null;
    end;
  end if;
  if length(v_phone) in (12, 13) and left(v_phone, 2) = '55' then v_phone := substr(v_phone, 3); end if;
  v_doc := regexp_replace(coalesce(ev ->> 'clientCpf', ''), '\D', '', 'g');
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then v_email := null; end if;

  v_payer := jsonb_strip_nulls(jsonb_build_object(
    'name', v_first, 'surname', v_last, 'email', v_email,
    'phone', case when length(v_phone) in (10, 11) then jsonb_build_object('area_code', left(v_phone, 2), 'number', substr(v_phone, 3)) end,
    'identification', case when length(v_doc) = 11 then jsonb_build_object('type', 'CPF', 'number', v_doc)
                           when length(v_doc) = 14 then jsonb_build_object('type', 'CNPJ', 'number', v_doc) end
  ));

  v_pref := jsonb_build_object(
    'items', jsonb_build_array(jsonb_build_object(
      'id', pay.slug, 'title', left(pay.description, 250), 'quantity', 1,
      'description', left('Serviço fotográfico — ' || pay.description, 250), 'category_id', 'services',
      'unit_price', pay.amount, 'currency_id', 'BRL')),
    'payer', v_payer,
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
         mp_preference_amount = pay.amount, mp_pref_v = 2, updated_at = now()
   where id = pay.id;
  return r #>> '{body,init_point}';
end;
$fn$;
revoke all on function private.mp_checkout_url(uuid) from public, anon, authenticated;

select 'ok' as resultado;
