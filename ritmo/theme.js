(function(){
 'use strict';
 let saved;try{saved=localStorage.getItem('ritmo-black-theme-v1');}catch{}
 const root=document.documentElement;root.dataset.theme=saved==='light'?'light':'dark';
 function updateTheme(){const dark=root.dataset.theme==='dark',button=document.getElementById('theme-toggle');if(button){button.textContent=dark?'☾ Black dark · trocar':'☀ Claro ativo · trocar';button.setAttribute('aria-pressed',String(dark));button.setAttribute('aria-label',dark?'Ativar tema claro':'Ativar tema escuro');}document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#050505':'#f5f6f2');}
 updateTheme();let promptEvent=null;
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();promptEvent=e;const native=document.getElementById('install-native');if(native)native.hidden=false;});
 window.addEventListener('appinstalled',()=>{promptEvent=null;document.getElementById('install-app').hidden=true;document.getElementById('install-help').close();});
 window.addEventListener('DOMContentLoaded',()=>{
  updateTheme();const dialog=document.getElementById('install-help'),install=document.getElementById('install-app');
  document.getElementById('theme-toggle').onclick=()=>{root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('ritmo-black-theme-v1',root.dataset.theme);}catch{}updateTheme();};
  if(window.matchMedia('(display-mode: standalone)').matches||navigator.standalone)install.hidden=true;
  install.onclick=()=>{document.getElementById('install-native').hidden=!promptEvent;document.getElementById('install-status').textContent='';dialog.showModal();};
  document.getElementById('install-close').onclick=()=>dialog.close();
  document.getElementById('install-confirm').onclick=async()=>{if(!promptEvent)return;const event=promptEvent;promptEvent=null;document.getElementById('install-native').hidden=true;try{await event.prompt();const choice=await event.userChoice;document.getElementById('install-status').textContent=choice.outcome==='accepted'?'Instalação solicitada. Confira o ícone na tela inicial.':'Você pode instalar depois, seguindo as instruções acima.';}catch{document.getElementById('install-status').textContent='Siga as instruções do seu navegador acima para adicionar à tela inicial.';}};
  if('serviceWorker' in navigator&&window.isSecureContext)navigator.serviceWorker.register('/ritmo/sw.js',{scope:'/ritmo/',updateViaCache:'none'}).catch(()=>{});
 });
})();
