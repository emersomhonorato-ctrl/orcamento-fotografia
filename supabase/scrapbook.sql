-- =====================================================================
-- Álbum scrapbook: oferta opcional na página de entrega.
-- Ligada em cada entrega; preços e texto ficam nas configurações do estúdio.
-- =====================================================================
alter table public.photo_deliveries add column if not exists scrapbook boolean not null default false;
alter table public.studio_settings add column if not exists scrapbook jsonb not null default '{}'::jsonb;

-- Mesmas regras do get_delivery (ativa, no prazo, senha). Devolve null se a oferta está desligada.
create or replace function public.get_delivery_scrapbook(p_slug text, p_pin text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  d public.photo_deliveries;
  s jsonb;
begin
  select * into d from public.photo_deliveries where slug = lower(trim(p_slug)) and active;
  if not found or not d.scrapbook then return null; end if;
  if d.expires_at is not null and d.expires_at < (now() at time zone 'America/Sao_Paulo')::date then return null; end if;
  if coalesce(d.pin, '') <> '' and coalesce(trim(p_pin), '') <> d.pin then return null; end if;
  select scrapbook into s from public.studio_settings where id = 1;
  return coalesce(s, '{}'::jsonb) || jsonb_build_object('enabled', true);
end;
$fn$;
revoke all on function public.get_delivery_scrapbook(text, text) from public;
grant execute on function public.get_delivery_scrapbook(text, text) to anon, authenticated;
