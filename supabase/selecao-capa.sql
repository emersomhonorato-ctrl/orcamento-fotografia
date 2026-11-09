-- =====================================================================
-- Seleção: foto de capa escolhida pelo fotógrafo (aparece no cartão da
-- aba Seleção e no topo da página de escolha do cliente)
-- =====================================================================
alter table public.photo_selections add column if not exists cover_id text;

-- Devolve só o id da capa (com a mesma senha da galeria), sem contar visita
create or replace function public.get_selection_cover(p_slug text, p_pin text default null)
returns text
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  s public.photo_selections;
begin
  select * into s from public.photo_selections where slug = lower(trim(p_slug));
  if not found then return null; end if;
  if coalesce(s.pin, '') <> '' and coalesce(trim(p_pin), '') <> s.pin then return null; end if;
  return nullif(s.cover_id, '');
end;
$fn$;
revoke all on function public.get_selection_cover(text, text) from public;
grant execute on function public.get_selection_cover(text, text) to anon, authenticated;

select count(*) as selecoes from public.photo_selections;
