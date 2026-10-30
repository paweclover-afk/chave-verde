(function(){
 'use strict';
 const status=document.getElementById('cloudstatus'),login=document.getElementById('loginpanel'),shell=document.getElementById('app-shell');
 const revisions={},synced={},pending={};let busy=false,blocked=false,cacheKey='',owner='',timer,lastBackup=null;
 function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));return v;}
 const fingerprint=v=>JSON.stringify(canonical(v));
 function badge(text,kind=''){status.textContent=text;status.dataset.kind=kind;}
 async function api(action,body){const r=await fetch('/api/ritmo?action='+action,{credentials:'same-origin',cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});let data;try{data=await r.json();}catch{throw Error('Não foi possível falar com o servidor.');}if(!r.ok){const e=Error(data.error||'Não foi possível salvar.');e.status=r.status;throw e;}return data;}
 function saveQueue(){try{localStorage.setItem(cacheKey,JSON.stringify({owner,pending}));return true;}catch{badge('Não foi possível guardar alterações neste aparelho. Exporte um backup.','error');return false;}}
 function collect(backup){
   const s=backup.state,days=new Set([...Object.keys(s.agenda),...Object.keys(s.water),...Object.keys(s.mobility),...Object.keys(s.mealchoices),...Object.keys(s.selections),...Object.keys(s.notes||{}),...Object.keys(s.daybyday||{}),...Object.keys(s.foodPlans||{}),...backup.sessions.map(x=>x.date)]),out={};
   for(const d of days){const dow=new Date(d+'T12:00:00').getDay();out[d]={agenda:(s.agenda[d]||[]).map(e=>({...e,id:String(e.id),done:!!e.done})),water:s.water[d]||0,mobility:s.mobility[d]||Array(6).fill(false),mealchoices:s.mealchoices[d]||[0,3,5,6],selection:s.selections[d]||window.PLAN.workouts.find(w=>w.day===dow)?.id||'off',sessions:backup.sessions.filter(x=>x.date===d),notes:s.notes?.[d]||'',trainingTime:s.trainingTime||'19:30',...(s.daybyday?.[d]?{daybyday:s.daybyday[d]}:{}),...(s.foodPlans?.[d]?{foodPlan:s.foodPlans[d]}:{})};}
   return out;
 }
 function queueState(backup){lastBackup=backup;if(blocked){badge('Há um conflito entre aparelhos. Exporte o backup antes de recarregar.','error');return true;}const days=collect(backup);for(const [day,payload] of Object.entries(days)){const text=fingerprint(payload);if(pending[day]&&fingerprint(pending[day].payload)===text)continue;if(synced[day]===text&&!pending[day])continue;pending[day]={payload:structuredClone(payload),event:crypto.randomUUID(),revision:revisions[day]||0};}const ok=saveQueue();if(Object.keys(pending).length){badge('Salvo neste aparelho · aguardando envio…','pending');clearTimeout(timer);timer=setTimeout(flush,400);}return ok;}
 async function flush(){
   if(busy||blocked||!Object.keys(pending).length)return;busy=true;
   try{while(Object.keys(pending).length){const day=Object.keys(pending).sort()[0],item=pending[day];badge('Salvando seus registros online…','pending');const result=await api('save',{day,...item});revisions[day]=result.revision;synced[day]=fingerprint(item.payload);if(pending[day]===item)delete pending[day];else pending[day].revision=result.revision;saveQueue();}badge('✓ Tudo salvo online · '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),'saved');}
   catch(e){if(e.status===409){blocked=true;badge(e.message,'error');}else if(e.status===401){badge('Sessão encerrada. Exporte um backup e entre novamente para enviar as alterações.','error');}else badge('Sem confirmação do servidor. Alterações guardadas neste aparelho; tentando novamente.','pending');}
   finally{busy=false;}
 }
 async function boot(){
   try{
    let data=await api('load');let greeting=null;try{greeting=(await api('message',{event:crypto.randomUUID()})).message;if(greeting)data=await api('load');}catch{}owner=data.user.id;cacheKey='ritmo-pending-'+owner;window.PLAN=data.plan;
    const state={agenda:{},water:{},mobility:{},mealchoices:{},selections:{},notes:{},daybyday:{},foodPlans:{},trainingTime:'19:30',sessions:[]};
    for(const row of data.days){revisions[row.day]=row.revision;synced[row.day]=fingerprint(row.payload);}
    try{const cached=JSON.parse(localStorage.getItem(cacheKey)||'null');if(cached?.owner===owner){for(const [day,item] of Object.entries(cached.pending||{})){if(fingerprint(item.payload)===synced[day])continue;pending[day]=item;if(item.revision!==(revisions[day]||0))blocked=true;}}}catch{badge('Não foi possível ler alterações locais. Exporte um backup antes de sair.','error');}
    const rows=new Map(data.days.map(r=>[r.day,r.payload]));for(const [day,item] of Object.entries(pending))rows.set(day,item.payload);
    for(const [day,p] of rows){state.agenda[day]=p.agenda||[];state.water[day]=p.water||0;state.mobility[day]=p.mobility||Array(6).fill(false);state.mealchoices[day]=p.mealchoices||[0,3,5,6];state.selections[day]=p.selection||'off';state.notes[day]=p.notes||'';if(p.daybyday)state.daybyday[day]=p.daybyday;if(p.foodPlan)state.foodPlans[day]=p.foodPlan;state.sessions.push(...(p.sessions||[]));state.trainingTime=p.trainingTime||'19:30';}
    window.RitmoCloud={initialState:state,queueState,flush,pending:()=>Object.keys(pending).length,blocked:()=>blocked,audit:day=>api('audit&day='+encodeURIComponent(day))};
    document.getElementById('accountname').textContent=data.user.email;login.hidden=true;shell.hidden=true;document.getElementById('app-loading').hidden=false;
    await new Promise((resolve,reject)=>{const app=document.createElement('script');app.src='app.js';app.onload=resolve;app.onerror=()=>reject(Error('Não foi possível abrir o app. Recarregue a página.'));document.body.append(app);});document.getElementById('app-loading').hidden=true;login.hidden=true;shell.hidden=false;
    if(greeting){const dialog=document.createElement('dialog'),title=document.createElement('h2'),text=document.createElement('p'),close=document.createElement('button');dialog.className='personal-message';title.textContent='Uma mensagem para você ❤️';text.textContent=greeting.text;text.style.whiteSpace='pre-wrap';text.style.lineHeight='1.9';close.className='primary';close.textContent='Li sua mensagem ❤️';close.type='button';close.onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();dialog.append(title,text,close);document.body.append(dialog);dialog.showModal();}
    badge(blocked?'Conflito entre aparelhos. Exporte um backup antes de recarregar.':Object.keys(pending).length?'Há alterações aguardando envio.':'✓ Registros carregados da sua conta',blocked?'error':'saved');if(!blocked)flush();
   }catch(e){document.getElementById('app-loading').hidden=true;login.hidden=false;shell.hidden=true;if(e.status!==401)document.getElementById('loginerror').textContent=e.message;}
 }
 document.getElementById('togglepassword').onclick=()=>{const input=document.getElementById('loginpassword'),button=document.getElementById('togglepassword'),show=input.type==='password';input.type=show?'text':'password';button.textContent=show?'Ocultar':'Mostrar';button.setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');button.setAttribute('aria-pressed',String(show));};
 document.getElementById('loginform').onsubmit=async event=>{event.preventDefault();const button=document.getElementById('loginbutton'),error=document.getElementById('loginerror');button.disabled=true;error.textContent='Entrando…';try{await api('login',{email:document.getElementById('loginemail').value.trim(),password:document.getElementById('loginpassword').value});document.getElementById('loginpassword').value='';error.textContent='';await boot();}catch(e){error.textContent=e.message;}finally{button.disabled=false;}};
 document.getElementById('logout').onclick=async()=>{await flush();if(Object.keys(pending).length){badge('Ainda há alterações não enviadas. Aguarde a conexão ou exporte um backup antes de sair.','error');return;}try{await api('logout',{});localStorage.removeItem(cacheKey);location.reload();}catch{badge('Não foi possível sair. Tente novamente.','error');}};
 document.getElementById('retrycloud').onclick=flush;window.addEventListener('online',flush);setInterval(flush,15000);
 window.addEventListener('beforeunload',e=>{if(Object.keys(pending).length){e.preventDefault();e.returnValue='';}});
 boot();
})();
