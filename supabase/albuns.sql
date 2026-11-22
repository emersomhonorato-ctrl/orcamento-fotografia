-- =====================================================================
-- Diagramação de álbuns: o estúdio monta as lâminas com as fotos tratadas (Drive)
-- e o cliente aprova cada lâmina ou pede troca pelo link /album/<codigo>
-- =====================================================================
create table if not exists public.photo_albums (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  slug text not null unique,
  title text not null,
  client_name text not null,
  client_whatsapp text,
  event_id text,
  drive_url text not null,
  photos jsonb not null default '[]'::jsonb,       -- [{ "id": "...", "name": "EME_1158.jpg", "w": 3, "h": 2 }]
  size text not null default '30x30',              -- formato do álbum (largura x altura de uma página)
  spreads jsonb not null default '[]'::jsonb,      -- lâminas: [{ "layout": "...", "slots": [{ "photo": id, "ox": .5, "oy": .5 }] }]
  message text,
  status text not null default 'rascunho' check (status in ('rascunho', 'enviado', 'ajustes', 'aprovado')),
  feedback jsonb not null default '{}'::jsonb,     -- { "0": { "ok": true }, "3": { "ok": false, "note": "trocar a foto da esquerda" } }
  version int not null default 1,
  sent_at timestamptz,
  answered_at timestamptz,
  approved_at timestamptz,
  views int not null default 0,
  last_viewed_at timestamptz
);
alter table public.photo_albums enable row level security;
drop policy if exists "album: admin" on public.photo_albums;
create policy "album: admin" on public.photo_albums for all to authenticated
  using (lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com')
  with check (lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com');

-- Página do cliente: só o que precisa para ver o álbum
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
    'approved_at', a.approved_at);
end;
$fn$;

-- Resposta do cliente: aprova lâmina por lâmina (ou pede troca com comentário) e, no fim, envia
create or replace function public.answer_album(p_slug text, p_feedback jsonb, p_finish boolean default false)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  a public.photo_albums;
  v_total int;
  v_ok int;
  v_changes int;
  v_status text;
begin
  select * into a from public.photo_albums where slug = lower(trim(p_slug)) for update;
  if not found or a.status = 'rascunho' then raise exception 'Álbum não encontrado.'; end if;
  if a.status = 'aprovado' then raise exception 'Este álbum já foi aprovado. Para mudar algo, fale comigo pelo WhatsApp.'; end if;
  if jsonb_typeof(coalesce(p_feedback, '{}'::jsonb)) <> 'object' then raise exception 'Resposta inválida.'; end if;

  v_total := jsonb_array_length(a.spreads);
  select count(*) filter (where (v ->> 'ok')::boolean is true), count(*) filter (where (v ->> 'ok')::boolean is false)
    into v_ok, v_changes
    from jsonb_each(p_feedback) as f(k, v)
   where k ~ '^\d+$' and k::int < v_total;

  v_status := a.status;
  if p_finish then
    v_status := case when v_changes > 0 then 'ajustes' when v_ok >= v_total then 'aprovado' else a.status end;
    if v_status = a.status and v_changes = 0 then raise exception 'Aprove todas as lâminas ou peça a troca das que quiser mudar.'; end if;
  end if;

  update public.photo_albums
     set feedback = p_feedback, updated_at = now(),
         status = v_status,
         answered_at = case when p_finish then now() else answered_at end,
         approved_at = case when p_finish and v_status = 'aprovado' then now() else approved_at end
   where id = a.id;

  if p_finish then
    begin
      execute 'select private.notify_whatsapp($1)' using
        case when v_status = 'aprovado' then format('📖 %s APROVOU o álbum — %s', a.client_name, a.title)
             else format('📖 %s pediu ajustes em %s lâmina(s) do álbum — %s', a.client_name, v_changes, a.title) end;
    exception when others then null;
    end;
  end if;
  return json_build_object('status', v_status, 'ok', v_ok, 'changes', v_changes, 'total', v_total);
end;
$fn$;

revoke all on function public.get_album(text) from public;
revoke all on function public.answer_album(text, jsonb, boolean) from public;
grant execute on function public.get_album(text) to anon, authenticated;
grant execute on function public.answer_album(text, jsonb, boolean) to anon, authenticated;

select 'ok' as resultado;
