-- Proteção contra print (segurar para ver) pode ser desligada em cada seleção e em cada álbum
alter table public.photo_selections add column if not exists protect_photos boolean not null default true;
alter table public.photo_albums add column if not exists protect_photos boolean not null default true;

create or replace function public.selection_protect(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select protect_photos from public.photo_selections where slug = lower(trim(p_slug)) limit 1), true);
$$;
revoke all on function public.selection_protect(text) from public;
grant execute on function public.selection_protect(text) to anon, authenticated;

create or replace function public.get_album(p_slug text)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  a public.photo_albums;
begin
  select * into a from public.photo_albums where slug = lower(trim(p_slug));
  if not found or a.status = 'rascunho' then return json_build_object('status', 'not_found'); end if;
  update public.photo_albums set views = views + 1, last_viewed_at = now() where id = a.id;
  return json_build_object(
    'status', a.status, 'title', a.title, 'client_name', a.client_name, 'message', a.message,
    'photos', a.photos, 'size', a.size, 'spreads', a.spreads, 'feedback', a.feedback, 'version', a.version,
    'approved_at', a.approved_at, 'protect', a.protect_photos);
end;
$fn$;

select 'ok' as resultado;
