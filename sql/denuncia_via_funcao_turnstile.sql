-- Denúncia agora passa pela função /api/denunciar, que valida o CAPTCHA (Turnstile)
-- antes de gravar. Removemos a permissão de inserir direto como anônimo, pra bots
-- não conseguirem pular o CAPTCHA chamando o Supabase diretamente.
--
-- A função /api/denunciar grava usando a service role, que ignora RLS — então
-- denúncias legítimas continuam funcionando (e continuam anônimas).
-- As policies de SELECT/UPDATE do admin continuam como estão.

drop policy if exists "qualquer um pode denunciar" on public.denuncias;
