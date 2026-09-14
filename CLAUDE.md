# Chave Verde

Site de anúncios de quartos para aluguel (Irlanda, foco em Dublin). HTML/CSS/JS puro, **sem build e sem framework**.
Backend: Supabase (auth, banco, storage no bucket `fotos-quartos`) + Stripe através de funções serverless da Vercel.
Deploy: GitHub → Vercel (`https://chave-verde.vercel.app`).

## Estrutura

```
index.html  painel.html  admin.html  redefinir-senha.html   ← só o HTML (marcação)
css/<pagina>.css      ← estilos de cada página
js/comum.js           ← config do Supabase + utilitários usados por todas as páginas
js/<pagina>.js        ← lógica de cada página
api/                  ← funções serverless (Node) — chamadas como /api/<nome>
assets/               ← imagens
sql/                  ← migrações/triggers já rodados manualmente no SQL Editor do Supabase
docs/                 ← relatórios de pentest e TODO de segurança (não é código; ignorar em buscas)
vercel.json           ← cabeçalhos de segurança e Content-Security-Policy
```

## Onde mexer para cada tarefa

| Assunto | Arquivos |
|---|---|
| Página inicial: listagem, filtros (cidade/distrito/gênero/preço/futuros), cards com carrossel, detalhe do anúncio, lightbox, denúncia, FAQ, login/cadastro | `index.html`, `js/index.js`, `css/index.css` |
| Painel do anunciante: criar/editar/excluir anúncio, fotos, pagar destaque/fotos extras, feedback | `painel.html`, `js/painel.js`, `css/painel.css` |
| Admin: moderação de anúncios, usuários, selo de verificado, admins, mensagens, denúncias | `admin.html`, `js/admin.js`, `css/admin.css` |
| Redefinir senha (link do e-mail) | `redefinir-senha.html`, `js/redefinir-senha.js` |
| `supabaseClient`, `escapeHtml`, `formatEuro`, `getFotosArray`, `formatDisponibilidade`, `isDestacado`, `togglePw` | `js/comum.js` |
| Checkout Stripe | `api/create-checkout-session.js` (+ `startCheckout` em `js/painel.js`) |
| Confirmação de pagamento | `api/verify-payment.js` (+ `checkPaymentReturn` em `js/painel.js`) |
| Ações de admin sobre usuários (service role) | `api/admin-users.js` (+ `js/admin.js`) |

## Supabase

Tabelas: `quartos` (anúncios), `admins`, `verificados`, `denuncias`, `feedback_mensagens`, `pagamentos_processados`.
Variáveis de ambiente das funções `api/`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`.
Mudanças de banco: criar um novo `.sql` em `sql/` e avisar que precisa ser rodado no Supabase.

## Regras importantes

- **Todo dado vindo do usuário inserido em HTML passa por `escapeHtml()`**, inclusive URLs de fotos em `src`/`style`. Já houve XSS por isso.
- Não confiar no navegador para status/pagamento: triggers no banco forçam `status = 'Pendente'` e protegem campos pagos (ver `sql/`).
- Os scripts são clássicos (sem `type="module"`), porque as funções são chamadas por `onclick` no HTML. Por isso tudo é global:
  não redeclarar em `js/<pagina>.js` nada que já exista em `js/comum.js` (dá erro de `const` duplicada).
- Ordem dos scripts em cada página: CDN do supabase-js → `js/comum.js` → `js/<pagina>.js`.
- Um domínio externo novo (script, imagem, API) precisa ser liberado na CSP em `vercel.json`.
- Rodar localmente: `python -m http.server 8080` na raiz (as rotas `/api/*` só funcionam na Vercel).
