-- =====================================================================
-- Seleção: fotos para revelação (tamanho + quantidade), galeria de entrega
-- automática ao finalizar e reabrir seleção
-- =====================================================================
alter table public.studio_settings
  add column if not exists print_sizes jsonb not null default
    '[{"size":"10x15","price":5},{"size":"15x21","price":15},{"size":"20x30","price":35}]'::jsonb;

alter table public.photo_selections
  add column if not exists print_sizes jsonb not null default '[]'::jsonb,   -- [{"size":"10x15","price":5}] (vazio = sem revelação)
  add column if not exists prints_included int not null default 0,         -- revelações inclusas no pacote (unidades)
  add column if not exists prints jsonb not null default '[]'::jsonb,       -- [{"name":"EME_1.jpg","size":"15x21","qty":2}]
  add column if not exists final_drive_url text,                            -- pasta das fotos tratadas (para a entrega)
  add column if not exists delivery_id uuid,
  add column if not exists reopened_at timestamptz;

alter table public.photo_deliveries
  add column if not exists selection_id uuid;

create or replace function public.get_selection(p_slug text, p_pin text default null)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  s public.photo_selections;
begin
  select * into s from public.photo_selections where slug = lower(trim(p_slug));
  if not found then return json_build_object('status', 'not_found'); end if;
  if coalesce(s.pin, '') <> '' and coalesce(trim(p_pin), '') <> s.pin then
    return json_build_object('status', case when coalesce(p_pin, '') = '' then 'need_pin' else 'wrong_pin' end,
      'client_name', s.client_name, 'title', s.title);
  end if;
  update public.photo_selections set views = views + 1, last_viewed_at = now() where id = s.id;
  return json_build_object(
    'status', case when s.status = 'enviada' then 'enviada'
                   when s.expires_at is not null and s.expires_at < (now() at time zone 'America/Sao_Paulo')::date then 'expired'
                   else 'aberta' end,
    'title', s.title, 'client_name', s.client_name, 'event_date', s.event_date, 'message', s.message,
    'photos', s.photos, 'included_count', s.included_count, 'extra_price', s.extra_price, 'max_count', s.max_count,
    'expires_at', s.expires_at, 'selected', s.selected, 'client_note', s.client_note, 'submitted_at', s.submitted_at,
    'print_sizes', s.print_sizes, 'prints_included', s.prints_included, 'prints', s.prints,
    'reopened_at', s.reopened_at);
end;
$fn$;

drop function if exists public.save_selection(text, text, jsonb, text, boolean);
drop function if exists public.save_selection(text, text, jsonb, text, boolean, jsonb);

create function public.save_selection(
  p_slug text, p_pin text, p_selected jsonb, p_note text default null, p_submit boolean default false,
  p_prints jsonb default null
) returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  s public.photo_selections;
  v_clean jsonb;
  v_prints jsonb;
  v_count int;
  v_units int;
  v_delivery uuid;
  v_dslug text;
begin
  select * into s from public.photo_selections where slug = lower(trim(p_slug)) for update;
  if not found then raise exception 'Seleção não encontrada.'; end if;
  if coalesce(s.pin, '') <> '' and coalesce(trim(p_pin), '') <> s.pin then raise exception 'Senha incorreta.'; end if;
  if s.status = 'enviada' then raise exception 'Sua escolha já foi enviada. Para mudar, fale comigo pelo WhatsApp.'; end if;
  if s.expires_at is not null and s.expires_at < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'O prazo para escolher terminou. Fale comigo pelo WhatsApp.';
  end if;

  -- só aceita nomes que existem na galeria (sem repetir)
  select coalesce(jsonb_agg(distinct n.value), '[]'::jsonb) into v_clean
    from jsonb_array_elements_text(coalesce(p_selected, '[]'::jsonb)) as n(value)
   where exists (select 1 from jsonb_array_elements(s.photos) p where p ->> 'name' = n.value);
  v_count := jsonb_array_length(v_clean);
  if s.max_count is not null and s.max_count > 0 and v_count > s.max_count then
    raise exception 'Você pode escolher no máximo % fotos.', s.max_count;
  end if;
  if p_submit and v_count = 0 then raise exception 'Escolha pelo menos uma foto.'; end if;

  -- revelações: foto da galeria + tamanho oferecido + quantidade 1..50 (agrupa repetidos)
  if p_prints is null then
    v_prints := s.prints;
  else
    select coalesce(jsonb_agg(jsonb_build_object('name', name, 'size', size, 'qty', qty) order by name, size), '[]'::jsonb)
      into v_prints
      from (
        select x ->> 'name' as name, x ->> 'size' as size, least(50, sum(greatest(0, coalesce((x ->> 'qty')::int, 0)))) as qty
          from jsonb_array_elements(case when jsonb_typeof(p_prints) = 'array' then p_prints else '[]'::jsonb end) x
         where exists (select 1 from jsonb_array_elements(s.photos) p where p ->> 'name' = x ->> 'name')
           and exists (select 1 from jsonb_array_elements(s.print_sizes) z where z ->> 'size' = x ->> 'size')
         group by 1, 2
      ) t
     where qty > 0;
  end if;
  select coalesce(sum((x ->> 'qty')::int), 0) into v_units from jsonb_array_elements(v_prints) x;
  if v_units > 500 then raise exception 'Máximo de 500 revelações por pedido.'; end if;

  update public.photo_selections
     set selected = v_clean, prints = v_prints,
         client_note = left(nullif(trim(coalesce(p_note, '')), ''), 2000),
         last_saved_at = now(), updated_at = now(),
         status = case when p_submit then 'enviada' else status end,
         submitted_at = case when p_submit then now() else submitted_at end
   where id = s.id;

  if p_submit then
    -- cria (ou atualiza) a galeria de entrega como rascunho, pronta para receber as fotos tratadas
    v_delivery := s.delivery_id;
    if v_delivery is not null and not exists (select 1 from public.photo_deliveries where id = v_delivery) then
      v_delivery := null;
    end if;
    begin
      if v_delivery is null then
        v_dslug := s.slug;
        if exists (select 1 from public.photo_deliveries where slug = v_dslug) then
          v_dslug := left(s.slug, 70) || '-' || substr(md5(random()::text), 1, 4);
        end if;
        insert into public.photo_deliveries (slug, title, client_name, client_whatsapp, event_id, event_date,
                                             drive_url, pin, active, selection_id)
        values (v_dslug, s.title, s.client_name, s.client_whatsapp, s.event_id, s.event_date,
                coalesce(nullif(trim(s.final_drive_url), ''), s.drive_url), s.pin,
                false, s.id)
        returning id into v_delivery;
        update public.photo_selections set delivery_id = v_delivery where id = s.id;
      else
        update public.photo_deliveries
           set title = s.title, client_name = s.client_name, client_whatsapp = s.client_whatsapp,
               drive_url = case when nullif(trim(s.final_drive_url), '') is not null and not active
                                then s.final_drive_url else drive_url end,
               updated_at = now()
         where id = v_delivery;
      end if;
    exception when others then null;
    end;

    begin
      execute 'select private.notify_whatsapp($1)' using
        format('📸 %s terminou a escolha das fotos (%s fotos%s) — %s', s.client_name, v_count,
               case when v_units > 0 then format(', %s revelações', v_units) else '' end, s.title);
    exception when others then null;
    end;
  end if;

  return json_build_object('status', case when p_submit then 'enviada' else 'aberta' end, 'count', v_count, 'prints', v_units);
end;
$fn$;

revoke all on function public.save_selection(text, text, jsonb, text, boolean, jsonb) from public;
grant execute on function public.save_selection(text, text, jsonb, text, boolean, jsonb) to anon, authenticated;

select count(*) as selecoes, (select print_sizes from public.studio_settings where id = 1) as tamanhos
  from public.photo_selections;
