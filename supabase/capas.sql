-- Capa: ponto de foco (rosto/assunto) e capa automática da entrega criada pela seleção
alter table public.photo_deliveries add column if not exists cover_focus text not null default '50% 35%';

create or replace function public.delivery_default_cover()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.cover_url is null and new.selection_id is not null then
    select 'https://lh3.googleusercontent.com/d/' || (p ->> 'id') || '=w2000'
      into new.cover_url
      from public.photo_selections s, jsonb_array_elements(s.photos) p
     where s.id = new.selection_id and p ->> 'name' = (s.selected ->> 0)
     limit 1;
  end if;
  return new;
end;
$fn$;
revoke all on function public.delivery_default_cover() from public, anon, authenticated;
drop trigger if exists delivery_default_cover on public.photo_deliveries;
create trigger delivery_default_cover before insert on public.photo_deliveries
  for each row execute function public.delivery_default_cover();

create or replace function public.get_delivery(p_slug text, p_pin text default null)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  d public.photo_deliveries;
  st public.studio_settings;
  v_code text;
begin
  select * into d from public.photo_deliveries where slug = lower(trim(p_slug)) and active;
  if not found then
    return json_build_object('status', 'not_found');
  end if;
  if d.expires_at is not null and d.expires_at < (now() at time zone 'America/Sao_Paulo')::date then
    return json_build_object('status', 'expired', 'client_name', d.client_name, 'title', d.title);
  end if;
  if coalesce(d.pin, '') <> '' and coalesce(trim(p_pin), '') <> d.pin then
    return json_build_object('status', case when coalesce(p_pin, '') = '' then 'need_pin' else 'wrong_pin' end,
      'client_name', d.client_name, 'title', d.title, 'cover_url', d.cover_url, 'cover_focus', d.cover_focus);
  end if;

  v_code := d.referral_code;
  if v_code is null then
    loop
      v_code := upper(substr(regexp_replace(split_part(d.client_name, ' ', 1), '[^A-Za-z]', '', 'g'), 1, 5))
                || lpad((floor(random() * 900) + 100)::int::text, 3, '0');
      exit when not exists (select 1 from public.photo_deliveries where referral_code = v_code);
    end loop;
  end if;

  update public.photo_deliveries
     set views = views + 1, last_viewed_at = now(), first_viewed_at = coalesce(first_viewed_at, now()),
         referral_code = v_code
   where id = d.id;

  select * into st from public.studio_settings where id = 1;

  return json_build_object('status', 'ok', 'title', d.title, 'client_name', d.client_name,
    'event_date', d.event_date, 'drive_url', d.drive_url, 'cover_url', d.cover_url, 'cover_focus', d.cover_focus,
    'message', d.message, 'expires_at', d.expires_at, 'review_url', st.google_review_url,
    'products', coalesce(st.products, '[]'::jsonb), 'referral_reward', st.referral_reward,
    'referral_code', v_code);
end;
$fn$;

-- entregas já criadas pela seleção, ainda sem capa
update public.photo_deliveries d
   set cover_url = 'https://lh3.googleusercontent.com/d/' || (p ->> 'id') || '=w2000'
  from public.photo_selections s, jsonb_array_elements(s.photos) p
 where d.cover_url is null and d.selection_id = s.id and p ->> 'name' = (s.selected ->> 0);

select count(*) filter (where cover_url is null) as sem_capa, count(*) as entregas from public.photo_deliveries;
