-- Chave Verde — corrige upload cross-user no bucket fotos-quartos
-- Rode isso uma vez no Supabase: Dashboard → SQL Editor → New query → cole tudo → Run
--
-- O problema: qualquer usuário autenticado podia enviar arquivos pra QUALQUER
-- pasta do bucket, inclusive a pasta de outro usuário (ex: user-B enviando
-- pra dentro da pasta user-A/...). A política antiga não checava isso.
--
-- A correção: a pessoa só pode enviar arquivo se a primeira parte do caminho
-- (a pasta) for exatamente o próprio user_id dela.

drop policy if exists "Authenticated users can upload photos" on storage.objects;

create policy "Users can only upload to their own folder"
on storage.objects for insert
with check (
  bucket_id = 'fotos-quartos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Bônus: garante que também não dá pra atualizar/apagar arquivo de pasta alheia
-- (hoje não existe nenhuma policy de UPDATE/DELETE, então já é bloqueado por
-- padrão — isso só deixa explícito e permite a própria pessoa editar seus arquivos).

create policy "Users can update their own files"
on storage.objects for update
using (
  bucket_id = 'fotos-quartos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete their own files"
on storage.objects for delete
using (
  bucket_id = 'fotos-quartos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "Anyone can view photos" on storage.objects;
