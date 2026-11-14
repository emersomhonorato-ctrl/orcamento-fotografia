-- Liga cada pasta do HD a um trabalho (evento) do app
alter table public.hd_works add column if not exists event_id text;
alter table public.hd_works add column if not exists event_label text;
create index if not exists hd_works_event_idx on public.hd_works(event_id);
