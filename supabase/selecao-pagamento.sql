-- =====================================================================
-- Seleção: o cliente paga as fotos extras e as revelações (Pix ou cartão,
-- Mercado Pago) logo depois de enviar a escolha.
--  - o valor é calculado aqui no banco (não confia no navegador)
--  - reaproveita o mesmo link enquanto o valor não mudar
--  - se a seleção for reaberta e o valor mudar, o link antigo é cancelado
--    e cobra só a diferença do que já foi pago
-- =====================================================================
alter table public.photo_selections
  add column if not exists payment_id uuid,
  add column if not exists paid_total numeric(10,2) not null default 0;

create or replace function public.selection_amount_due(s public.photo_selections)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_count int := jsonb_array_length(coalesce(s.selected, '[]'::jsonb));
  v_extras numeric := 0;
  v_prints numeric := 0;
begin
  if coalesce(s.included_count, 0) > 0 then
    v_extras := greatest(0, v_count - s.included_count) * coalesce(s.extra_price, 0);
  end if;
  -- revelações: as N inclusas saem das mais baratas
  select coalesce(sum(price), 0) into v_prints
    from (
      select price, row_number() over (order by price) as n
        from (
          select coalesce((z ->> 'price')::numeric, 0) as price
            from jsonb_array_elements(coalesce(s.prints, '[]'::jsonb)) x
            join jsonb_array_elements(coalesce(s.print_sizes, '[]'::jsonb)) z on z ->> 'size' = x ->> 'size'
            cross join generate_series(1, greatest(0, coalesce((x ->> 'qty')::int, 0)))
        ) u
    ) r
   where n > coalesce(s.prints_included, 0);
  return round(v_extras + v_prints, 2);
end;
$fn$;
revoke all on function public.selection_amount_due(public.photo_selections) from public, anon, authenticated;

create or replace function public.selection_payment(p_slug text, p_pin text default null)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  s public.photo_selections;
  pay public.payments;
  v_total numeric;
  v_due numeric;
  v_desc text;
begin
  select * into s from public.photo_selections where slug = lower(trim(p_slug)) for update;
  if not found then raise exception 'Seleção não encontrada.'; end if;
  if coalesce(s.pin, '') <> '' and coalesce(trim(p_pin), '') <> s.pin then raise exception 'Senha incorreta.'; end if;
  if s.status <> 'enviada' then return json_build_object('status', 'none'); end if;

  -- pagamento anterior já pago entra no total pago
  if s.payment_id is not null then
    select * into pay from public.payments where id = s.payment_id;
    if found and pay.status = 'pago' then
      update public.photo_selections
         set paid_total = paid_total + coalesce(pay.paid_amount, pay.amount), payment_id = null
       where id = s.id
       returning * into s;
      pay := null;
    elsif not found then
      pay := null;
    end if;
  end if;

  v_total := public.selection_amount_due(s);
  v_due := round(v_total - coalesce(s.paid_total, 0), 2);

  if v_due < 1 then
    if pay.id is not null and pay.status = 'pendente' then
      update public.payments set status = 'cancelado', updated_at = now() where id = pay.id;
      update public.photo_selections set payment_id = null where id = s.id;
    end if;
    return json_build_object('status', case when coalesce(s.paid_total, 0) > 0 then 'pago' else 'none' end,
                             'paid', s.paid_total, 'total', v_total);
  end if;

  if not public.card_payments_enabled() then
    return json_build_object('status', 'manual', 'amount', v_due, 'total', v_total, 'paid', s.paid_total);
  end if;

  -- mesmo valor e ainda válido: reaproveita o link
  if pay.id is not null and pay.status = 'pendente' and pay.amount = v_due
     and (pay.expires_at is null or pay.expires_at > now() + interval '1 day') then
    return json_build_object('status', 'pendente', 'slug', pay.slug, 'amount', v_due, 'total', v_total, 'paid', s.paid_total);
  end if;
  if pay.id is not null and pay.status = 'pendente' then
    update public.payments set status = 'cancelado', updated_at = now() where id = pay.id;
  end if;

  v_desc := concat_ws(' e ',
              case when coalesce(s.included_count, 0) > 0 and jsonb_array_length(coalesce(s.selected, '[]'::jsonb)) > s.included_count
                   then 'Fotos extras' end,
              case when jsonb_array_length(coalesce(s.prints, '[]'::jsonb)) > 0 then 'Revelação' end);
  v_desc := left(coalesce(nullif(v_desc, ''), 'Seleção de fotos') || ' — ' || s.title
                 || case when coalesce(s.paid_total, 0) > 0 then ' (diferença)' else '' end, 250);

  insert into public.payments (kind, event_id, client_name, client_whatsapp, description, amount, max_installments, expires_at)
  values ('avulso', s.event_id, s.client_name, s.client_whatsapp, v_desc, v_due,
          case when v_due >= 300 then 6 when v_due >= 100 then 3 else 1 end,
          now() + interval '7 days')
  returning * into pay;
  update public.photo_selections set payment_id = pay.id where id = s.id;

  return json_build_object('status', 'pendente', 'slug', pay.slug, 'amount', v_due, 'total', v_total, 'paid', s.paid_total);
end;
$fn$;
revoke all on function public.selection_payment(text, text) from public;
grant execute on function public.selection_payment(text, text) to anon, authenticated;

select count(*) filter (where status = 'enviada') as selecoes_enviadas,
       public.card_payments_enabled() as cartao_ligado
  from public.photo_selections;
