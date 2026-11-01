-- ============================================================
--  Bibliothèque Libre — schéma Supabase pour le dépôt gratuit
--  À coller dans Supabase → SQL Editor → New query → Run
-- ============================================================

-- ---------- Tables ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users on delete cascade
);

create table if not exists public.depots (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users on delete cascade,
  titre            text not null check (char_length(titre) between 1 and 200),
  auteur           text not null check (char_length(auteur) between 1 and 120),
  description      text check (char_length(description) <= 2000),
  categorie        text not null check (char_length(categorie) <= 30),
  langue           text not null default 'fr' check (char_length(langue) between 2 and 5),
  annee            int check (annee between 1000 and 2100),
  licence          text not null check (licence in ('domaine-public','cc0','cc-by','cc-by-sa','cc-by-nc','cc-by-nc-nd','lecture-libre')),
  format           text not null check (format in ('epub','pdf')),
  fichier_path     text not null,
  couverture_path  text,
  certifie_droits  boolean not null check (certifie_droits),
  status           text not null default 'en_attente' check (status in ('en_attente','publie','refuse','depublie')),
  motif_refus      text check (char_length(motif_refus) <= 500),
  created_at       timestamptz not null default now(),
  moderated_at     timestamptz
);
create index if not exists depots_status_idx on public.depots (status);
create index if not exists depots_user_idx on public.depots (user_id);

create table if not exists public.signalements (
  id          bigint generated always as identity primary key,
  depot_id    uuid not null references public.depots on delete cascade,
  motif       text not null check (motif in ('droits','contenu_illicite','spam','autre')),
  details     text not null check (char_length(details) between 1 and 1000),
  contact     text check (char_length(contact) <= 200),
  traite      boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------- Fonctions utilitaires ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Anti-abus : 5 dépôts en attente maximum par auteur
create or replace function public.nb_depots_en_attente() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.depots where user_id = auth.uid() and status = 'en_attente';
$$;

-- Un auteur ne peut pas modifier un livre déjà publié ; seul un admin change le statut
create or replace function public.proteger_depot() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Modification réservée à la modération';
  end if;
  return new;
end $$;
drop trigger if exists depots_proteger on public.depots;
create trigger depots_proteger before update on public.depots
  for each row execute function public.proteger_depot();

-- ---------- Sécurité : Row Level Security ----------
alter table public.admins       enable row level security;
alter table public.depots       enable row level security;
alter table public.signalements enable row level security;

-- admins : chacun peut seulement vérifier s'il est admin
drop policy if exists "admins_self" on public.admins;
create policy "admins_self" on public.admins for select to authenticated using (user_id = auth.uid());

-- depots
drop policy if exists "depots_lecture_publique" on public.depots;
create policy "depots_lecture_publique" on public.depots for select
  using (status = 'publie');

drop policy if exists "depots_lecture_auteur" on public.depots;
create policy "depots_lecture_auteur" on public.depots for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "depots_insertion" on public.depots;
create policy "depots_insertion" on public.depots for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'en_attente'
    and moderated_at is null
    and motif_refus is null
    and fichier_path like auth.uid()::text || '/%'
    and (couverture_path is null or couverture_path like auth.uid()::text || '/%')
    and public.nb_depots_en_attente() < 5
  );

drop policy if exists "depots_moderation" on public.depots;
create policy "depots_moderation" on public.depots for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "depots_suppression" on public.depots;
create policy "depots_suppression" on public.depots for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- signalements : tout le monde peut signaler un livre publié ; seuls les admins lisent et traitent
drop policy if exists "signalements_creation" on public.signalements;
create policy "signalements_creation" on public.signalements for insert to anon, authenticated
  with check (traite = false and exists (select 1 from public.depots d where d.id = depot_id and d.status = 'publie'));

drop policy if exists "signalements_admin_lecture" on public.signalements;
create policy "signalements_admin_lecture" on public.signalements for select to authenticated using (public.is_admin());

drop policy if exists "signalements_admin_maj" on public.signalements;
create policy "signalements_admin_maj" on public.signalements for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Stockage des fichiers ----------
-- Buckets publics en lecture (liens de téléchargement directs), écriture limitée au dossier de l'auteur.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('livres', 'livres', true, 26214400, array['application/epub+zip', 'application/pdf']),
  ('couvertures', 'couvertures', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fichiers_envoi_auteur" on storage.objects;
create policy "fichiers_envoi_auteur" on storage.objects for insert to authenticated
  with check (bucket_id in ('livres', 'couvertures') and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "fichiers_suppression" on storage.objects;
create policy "fichiers_suppression" on storage.objects for delete to authenticated
  using (bucket_id in ('livres', 'couvertures')
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ---------- Devenir administrateur ----------
-- 1. Connectez-vous une fois sur moderation.html avec votre e-mail (cela crée votre compte).
-- 2. Puis exécutez (en remplaçant l'e-mail) :
-- insert into public.admins (user_id) select id from auth.users where email = 'votre@email.fr';
