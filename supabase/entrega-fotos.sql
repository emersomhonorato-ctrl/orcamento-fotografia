-- =====================================================================
-- Entrega: lista das fotos da pasta do Drive guardada na entrega, para a
-- página do cliente mostrar cada foto com o botão "Baixar".
-- (a lista é lida do Drive pelo app quando a entrega é salva ou ativada)
-- =====================================================================
alter table public.photo_deliveries
  add column if not exists photos jsonb not null default '[]'::jsonb;

-- Mesmas regras do get_delivery (ativa, no prazo, senha), mas sem contar visita
create or replace function public.get_delivery_photos(p_slug text, p_pin text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  d public.photo_deliveries;
begin
  select * into d from public.photo_deliveries where slug = lower(trim(p_slug)) and active;
  if not found then return '[]'::jsonb; end if;
  if d.expires_at is not null and d.expires_at < (now() at time zone 'America/Sao_Paulo')::date then return '[]'::jsonb; end if;
  if coalesce(d.pin, '') <> '' and coalesce(trim(p_pin), '') <> d.pin then return '[]'::jsonb; end if;
  return coalesce(d.photos, '[]'::jsonb);
end;
$fn$;
revoke all on function public.get_delivery_photos(text, text) from public;
grant execute on function public.get_delivery_photos(text, text) to anon, authenticated;

select count(*) as entregas, count(*) filter (where jsonb_array_length(photos) > 0) as com_lista_de_fotos
  from public.photo_deliveries;
