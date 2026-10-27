'use strict';
// No response caches: account data, authentication and queued changes stay in
// the existing private API and per-account sync system.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||event.request.mode!=='navigate'||url.origin!==self.location.origin||!url.pathname.startsWith('/daybyday/'))return;
 event.respondWith(fetch(event.request).catch(()=>new Response(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>DayByDay · Sem conexão</title><body style="margin:0;background:#050505;color:#edf3ec;font:18px system-ui;min-height:100vh;display:grid;place-items:center"><main style="max-width:360px;padding:28px"><h1>DayByDay</h1><p>Você está sem conexão. Conecte-se à internet e abra o app novamente para carregar seus registros.</p><p>Alterações ainda não enviadas ficam guardadas neste aparelho pelo sistema de sincronização.</p><a style="color:#d9ed9d" href="/daybyday/#daybyday">Tentar novamente →</a></main></body></html>`,{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})));
});
