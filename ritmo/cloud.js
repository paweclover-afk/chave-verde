(function(){
 'use strict';
 const status=document.getElementById('cloudstatus'),login=document.getElementById('loginpanel'),shell=document.getElementById('app-shell');
 const revisions={},synced={},pending={},extras={};let busy=false,blocked=false,cacheKey='',owner='',timer,lastBackup=null;
 function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));return v;}
 const fingerprint=v=>JSON.stringify(canonical(v));
 function badge(text,kind=''){status.textContent=text;status.dataset.kind=kind;document.getElementById('retrycloud').textContent=blocked?'Atualizar registros':'Sincronizar';}
 const countdownStart=Date.UTC(2026,10,5),countdownEnd=Date.UTC(2027,2,20);
 const dayMs=86400000,countdownTotal=(countdownEnd-countdownStart)/dayMs;
 const countdownCalendar=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'});
 function countdownProgress(now=new Date()){
   const [year,month,day]=countdownCalendar.format(now).split('-').map(Number);
   const date=Date.UTC(year,month-1,day);
   const remaining=Math.max(0,Math.min(countdownTotal,(countdownEnd-date)/dayMs));
   return countdownTotal-remaining;
 }
 function createCountdown(){
   const box=document.createElement('section');
   const bar=document.createElement('progress'),caption=document.createElement('small');
   box.className='daily-countdown';
   bar.max=countdownTotal;
   bar.setAttribute('aria-label','Progresso');
   box.append(bar,caption);
   return box;
 }
 const countdown=createCountdown();
 function updateCountdown(){
   const elapsed=countdownProgress();
   const percent=Math.floor(elapsed/countdownTotal*100);
   countdown.querySelector('progress').value=elapsed;
   countdown.querySelector('small').textContent=elapsed+'/'+countdownTotal+' '+percent+'%';
 }
 async function api(action,body){const r=await fetch('/api/ritmo?action='+action,{credentials:'same-origin',cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});let data;try{data=await r.json();}catch{throw Error('Não foi possível falar com o servidor.');}if(!r.ok){const e=Error(data.error||'Não foi possível salvar.');e.status=r.status;throw e;}return data;}
 function registerDeviceAccess(userId){
   const storageKey='ritmo-device-'+userId;
   try{
     const url=new URL(location.href),label=url.searchParams.get('identificar-aparelho');
     let device=JSON.parse(localStorage.getItem(storageKey)||'null');
     if(['leonarda-phone','adilson-phone','adilson-computer'].includes(label)){
       device={id:device?.id||crypto.randomUUID(),label};
       url.searchParams.delete('identificar-aparelho');
       history.replaceState(history.state,'',url);
     }
     device??={id:crypto.randomUUID(),label:'unidentified'};
     localStorage.setItem(storageKey,JSON.stringify(device));
     api('device-access',device).catch(()=>{});
   }catch{}
 }
 function saveQueue(){try{localStorage.setItem(cacheKey,JSON.stringify({owner,pending}));return true;}catch{badge('Não foi possível guardar alterações neste aparelho. Exporte um backup.','error');return false;}}
 function collect(backup){
   const s=backup.state,days=new Set([...Object.keys(s.agenda),...Object.keys(s.water),...Object.keys(s.mobility),...Object.keys(s.mealchoices),...Object.keys(s.selections),...Object.keys(s.notes||{}),...Object.keys(s.daybyday||{}),...Object.keys(s.foodPlans||{}),...backup.sessions.map(x=>x.date),...(s.finance?[Tracker.financeDay]:[])]),out={};
   for(const d of days){const dow=new Date(d+'T12:00:00').getDay();out[d]={...(extras[d]||{}),agenda:(s.agenda[d]||[]).map(e=>({...e,id:String(e.id),done:!!e.done})),water:s.water[d]||0,mobility:s.mobility[d]||Array(6).fill(false),mealchoices:s.mealchoices[d]||[0,3,5,6],selection:s.selections[d]||window.PLAN.workouts.find(w=>w.day===dow)?.id||'off',sessions:backup.sessions.filter(x=>x.date===d),notes:s.notes?.[d]||'',trainingTime:s.trainingTime||'19:30',...(s.daybyday?.[d]?{daybyday:s.daybyday[d]}:{}),...(s.foodPlans?.[d]?{foodPlan:s.foodPlans[d]}:{}),...(s.finance&&d===Tracker.financeDay?{finance:s.finance}:{})};}
   return out;
 }
 function queueState(backup){lastBackup=backup;const days=collect(backup);for(const [day,payload] of Object.entries(days)){const text=fingerprint(payload);if(pending[day]&&fingerprint(pending[day].payload)===text)continue;if(synced[day]===text&&!pending[day])continue;pending[day]={payload:structuredClone(payload),event:crypto.randomUUID(),revision:revisions[day]||0,base:pending[day]?.base||(synced[day]?JSON.parse(synced[day]):{})};}const ok=saveQueue();if(!ok)return false;if(blocked){badge('Há um conflito entre aparelhos. Novas alterações guardadas neste aparelho. Use Atualizar registros para recuperar.','error');return true;}if(Object.keys(pending).length){badge('Salvo neste aparelho · aguardando envio…','pending');clearTimeout(timer);timer=setTimeout(flush,400);}return ok;}
 function applyRemoteDay(day,payload){
   extras[day]=Object.fromEntries(["importedTraining","importMeta","importReceipt"].filter(k=>payload[k]!==undefined).map(k=>[k,structuredClone(payload[k])]));
   const state=window.RitmoCloud?.initialState;
   if(!state)return;
   for(const [field,value] of Object.entries({agenda:payload.agenda||[],water:payload.water||0,mobility:payload.mobility||Array(6).fill(false),mealchoices:payload.mealchoices||[0,3,5,6],selections:payload.selection||'off',notes:payload.notes||''}))state[field][day]=value;
   if(payload.daybyday)state.daybyday[day]=payload.daybyday;
   if(payload.foodPlan)state.foodPlans[day]=payload.foodPlan;
   if(payload.finance&&day===Tracker.financeDay)state.finance=payload.finance;
   state.sessions=state.sessions.filter(s=>s.date!==day).concat(payload.sessions||[]);
 }
 async function reconcilePending(data){
   for(const [day,original] of Object.entries(pending)){
     const row=data.days.find(r=>r.day===day),revision=row?.revision||0,remote=row?.payload||{};
     if(original.revision===revision)continue;
     let base=original.base;
     if(!base){
       if(!original.revision)base={};
       else{const audit=await api('audit&day='+encodeURIComponent(day));base=audit.changes.find(r=>r.revision===original.revision)?.payload;}
     }
     if(!base)throw Error('A versão antiga precisa ser recuperada pelo backup.');
     const item=pending[day];
     const merged=RitmoMerge.merge(base,item.payload,remote);
     pending[day]={payload:merged,base:structuredClone(remote),revision,event:crypto.randomUUID()};
     revisions[day]=revision;synced[day]=fingerprint(remote);
     applyRemoteDay(day,merged);
   }
   saveQueue();
 }
 async function flush(){
   if(busy||blocked||!Object.keys(pending).length)return;busy=true;
   try{while(Object.keys(pending).length){const day=Object.keys(pending).sort()[0],item=pending[day];badge('Salvando seus registros online…','pending');const result=await api('save',{day,...item});revisions[day]=result.revision;synced[day]=fingerprint(item.payload);if(pending[day]===item)delete pending[day];else {pending[day].revision=result.revision;pending[day].base=structuredClone(item.payload);}saveQueue();}badge('✓ Tudo salvo online · '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),'saved');}
   catch(e){if(e.status===409){try{await reconcilePending(await api('load'));badge('Alterações dos aparelhos combinadas. Salvando…','pending');setTimeout(flush,300);}catch(conflict){blocked=true;badge(conflict.message+' Use Atualizar registros para recuperar.','error');}}else if(e.status===401){badge('Sessão encerrada. Exporte um backup e entre novamente para enviar as alterações.','error');}else if(e.status>=400&&e.status<500){badge('Não foi possível salvar: '+e.message+' Alterações preservadas neste aparelho. Corrija o registro e tente sincronizar.','error');}else badge('Sem confirmação do servidor. Alterações guardadas neste aparelho; tentando novamente.','pending');}
   finally{busy=false;}
 }
 function recoverConflict(){
   if(busy)throw Error('Aguarde o salvamento terminar.');
   const snapshot={owner,pending:structuredClone(pending),backup:lastBackup,createdAt:new Date().toISOString()};
   const archiveKey=cacheKey+'-recovery-'+Date.now();
   try{
     localStorage.setItem(archiveKey,JSON.stringify(snapshot));
   }catch{
     throw Error('Não foi possível guardar a cópia de recuperação. Baixe um backup antes de atualizar.');
   }
   const blob=new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'});
   const url=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=url;link.download='ritmo-recuperacao-'+new Date().toISOString().slice(0,10)+'.json';
   document.body.append(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
   localStorage.setItem(cacheKey,JSON.stringify({owner,pending:{}}));
   for(const day of Object.keys(pending))delete pending[day];
   blocked=false;
   location.reload();
 }
 async function boot(){
   try{
    let data=await api('load');let greeting=null;const messagesPaused=data.days.some(r=>r.day==='2026-10-29'&&r.payload.foodPlan?.message?.paused===true);try{if(messagesPaused){const presentation=await api('countdown-presentation',{event:crypto.randomUUID()});if(presentation.show){greeting=presentation.text?{text:presentation.text}:{countdownOnly:true};data=await api('load');}}else{greeting=(await api('message',{event:crypto.randomUUID()})).message;if(greeting&&!greeting.requiresAck)data=await api('load');}}catch{}owner=data.user.id;cacheKey='ritmo-pending-'+owner;window.PLAN=data.plan;
    const state={agenda:{},water:{},mobility:{},mealchoices:{},selections:{},notes:{},daybyday:{},foodPlans:{},trainingTime:'19:30',sessions:[]};
    for(const row of data.days){extras[row.day]=Object.fromEntries(["importedTraining","importMeta","importReceipt"].filter(k=>row.payload[k]!==undefined).map(k=>[k,structuredClone(row.payload[k])]));revisions[row.day]=row.revision;synced[row.day]=fingerprint(row.payload);}
    try{const cached=JSON.parse(localStorage.getItem(cacheKey)||'null');if(cached?.owner===owner){for(const [day,item] of Object.entries(cached.pending||{})){if(fingerprint(item.payload)===synced[day])continue;pending[day]=item; }}}catch{badge('Não foi possível ler alterações locais. Exporte um backup antes de sair.','error');}
    try{await reconcilePending(data);}catch(conflict){blocked=true;badge(conflict.message,'error');}
    const rows=new Map(data.days.map(r=>[r.day,r.payload]));for(const [day,item] of Object.entries(pending))rows.set(day,item.payload);
    for(const [day,p] of rows){state.agenda[day]=p.agenda||[];state.water[day]=p.water||0;state.mobility[day]=p.mobility||Array(6).fill(false);state.mealchoices[day]=p.mealchoices||[0,3,5,6];state.selections[day]=p.selection||'off';state.notes[day]=p.notes||'';if(p.daybyday)state.daybyday[day]=p.daybyday;if(p.foodPlan)state.foodPlans[day]=p.foodPlan;if(p.finance&&day===Tracker.financeDay)state.finance=p.finance;state.sessions.push(...(p.sessions||[]));state.trainingTime=p.trainingTime||'19:30';}
    window.RitmoCloud={initialState:state,queueState,flush,recoverConflict,pending:()=>Object.keys(pending).length,blocked:()=>blocked,audit:day=>api('audit&day='+encodeURIComponent(day))};
    document.getElementById('accountname').textContent=data.user.email;login.hidden=true;shell.hidden=true;document.getElementById('app-loading').hidden=false;
    await new Promise((resolve,reject)=>{const app=document.createElement('script');app.src='app.js?v=hold-2s';app.onload=resolve;app.onerror=()=>reject(Error('Não foi possível abrir o app. Recarregue a página.'));document.body.append(app);});document.getElementById('app-loading').hidden=true;login.hidden=true;shell.hidden=false;window.scrollTo({top:0,left:0,behavior:'instant'});
    const daybyday=document.getElementById('daybyday');
    daybyday.prepend(countdown);
    if(greeting){const dialog=document.createElement('dialog'),title=document.createElement('h2'),text=document.createElement('p'),close=document.createElement('button');dialog.className='personal-message';title.textContent='Uma mensagem para você ❤️';text.textContent=greeting.text;text.style.whiteSpace='pre-wrap';text.style.lineHeight='1.9';close.className='primary';close.textContent=greeting.requiresAck?'Já li a mensagem':'Li sua mensagem ❤️';close.type='button';if(greeting.requiresAck){
      const error=document.createElement('p');
      error.setAttribute('role','status');
      dialog.addEventListener('cancel',event=>event.preventDefault());
      close.onclick=async()=>{
        close.disabled=true;error.textContent='';
        try{
          const day='2026-10-29';
          await flush();
          if(busy||pending[day])throw Error('Aguarde a sincronização e tente novamente.');
          const result=await api('ack-message',{id:greeting.id,event:crypto.randomUUID()});
          if(result.previousRevision===revisions[day]){
            const snapshot=JSON.parse(synced[day]);
            for(const configuration of [snapshot.foodPlan.message,state.foodPlans[day].message]){
              const message=Array.isArray(configuration.schedule)?configuration.schedule.find(entry=>entry.id===greeting.id):configuration;
              if(message)message.acknowledgedAt=result.acknowledgedAt;
            }
            revisions[day]=result.revision;synced[day]=fingerprint(snapshot);
          }
          dialog.close();
        }catch(e){error.textContent=e.message;close.disabled=false;}
      };
      dialog.append(title,text,error,close);
    }else{close.onclick=()=>dialog.close();if(greeting.countdownOnly){close.textContent='Continuar';dialog.setAttribute('aria-label','Progresso');dialog.append(close);}else dialog.append(title,text,close);}
    close.before(countdown);
    dialog.onclose=()=>{if(dialog.contains(countdown))daybyday.prepend(countdown);dialog.remove();window.showFinanceReminders?.(owner);};document.body.append(dialog);dialog.showModal();}else window.showFinanceReminders?.(owner);
    updateCountdown();
    registerDeviceAccess(owner);
    badge(blocked?'Conflito entre aparelhos. Exporte um backup antes de recarregar.':Object.keys(pending).length?'Há alterações aguardando envio.':'✓ Registros carregados da sua conta',blocked?'error':'saved');if(!blocked)flush();
   }catch(e){document.getElementById('app-loading').hidden=true;login.hidden=false;shell.hidden=true;if(e.status!==401)document.getElementById('loginerror').textContent=e.message;}
 }
 document.getElementById('togglepassword').onclick=()=>{const input=document.getElementById('loginpassword'),button=document.getElementById('togglepassword'),show=input.type==='password';input.type=show?'text':'password';button.textContent=show?'Ocultar':'Mostrar';button.setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');button.setAttribute('aria-pressed',String(show));};
 document.getElementById('loginform').onsubmit=async event=>{event.preventDefault();const button=document.getElementById('loginbutton'),error=document.getElementById('loginerror');button.disabled=true;error.textContent='Entrando…';try{await api('login',{email:document.getElementById('loginemail').value.trim(),password:document.getElementById('loginpassword').value});document.getElementById('loginpassword').value='';error.textContent='';await boot();}catch(e){error.textContent=e.message;}finally{button.disabled=false;}};
 document.getElementById('logout').onclick=async()=>{await flush();if(Object.keys(pending).length){badge('Ainda há alterações não enviadas. Aguarde a conexão ou exporte um backup antes de sair.','error');return;}try{await api('logout',{});localStorage.removeItem(cacheKey);location.reload();}catch{badge('Não foi possível sair. Tente novamente.','error');}};
 document.getElementById('retrycloud').onclick=()=>{if(blocked){try{recoverConflict();}catch(error){badge(error.message,'error');}}else flush();};window.addEventListener('online',flush);setInterval(flush,15000);
 window.addEventListener('beforeunload',e=>{if(Object.keys(pending).length){e.preventDefault();e.returnValue='';}});
 let refreshing=false;
 async function refreshFromOtherDevices(){
   if(refreshing||busy||blocked||Object.keys(pending).length||document.hidden||!window.canRefreshRitmo?.())return;
   refreshing=true;
   try{
     const data=await api('load');
     if(busy||blocked||Object.keys(pending).length||!window.canRefreshRitmo?.())return;
     if(fingerprint(data.plan)!==fingerprint(window.PLAN)){location.reload();return;}
     let changed=false;
     for(const row of data.days)if(row.revision!==(revisions[row.day]||0)){
       applyRemoteDay(row.day,row.payload);revisions[row.day]=row.revision;synced[row.day]=fingerprint(row.payload);changed=true;
     }
     if(changed)window.renderRitmoFromCloud?.();
   }catch{}finally{refreshing=false;}
 }
 setInterval(refreshFromOtherDevices,15000);
 window.addEventListener('focus',refreshFromOtherDevices);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateCountdown();});
 setInterval(updateCountdown,60000);
 boot();
})();
