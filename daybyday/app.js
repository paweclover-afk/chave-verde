'use strict';
const $=id=>document.getElementById(id),T=Tracker,P=window.PLAN;
const fmt=n=>n===null?'—':Number(n).toLocaleString('pt-BR',{maximumFractionDigits:2});
const dateLabel=k=>new Date(k+'T12:00:00').toLocaleDateString('pt-BR');
let storageWarning=false;
function readStorage(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch{storageWarning=true;return fallback;}}
let legacy={},state=window.RitmoCloud.initialState;state.notes??={};state.daybyday??={};state.foodPlans??={};
if(!state||!state.agenda||!Array.isArray(state.sessions)){
 state={agenda:{},water:{},mobility:{},mealchoices:{},selections:{},trainingTime:'19:30',sessions:[]};
 for(const [d,v] of Object.entries(legacy.water||{})){const parts=d.split('-');if(parts.length===3)state.water[`${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`]=v;}
}
let selected=new Date(),view='overview',editing=null,dirty=false;
let historyExercise=P.workouts[0]?.exercises[0]?.id||'',historyContext='';
const drafts=new Map(),allExercises=P.workouts.flatMap(w=>w.exercises.map(e=>({...e,workout:w.id,workoutTitle:w.title}))),exerciseById=new Map(allExercises.map(e=>[e.id,e]));
let toastTimer;
function toast(msg,undo){clearTimeout(toastTimer);$('toast').replaceChildren(document.createTextNode(msg));if(undo){const b=el('button','Desfazer','undo');b.onclick=()=>{undo();$('toast').hidden=true;};$('toast').append(b);}$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,undo?15000:5000);}
function persist(){return window.RitmoCloud.queueState(backup());}
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
const key=()=>T.dateKey(selected),dayWorkout=()=>P.workouts.find(w=>w.day===selected.getDay()),chosenWorkout=()=>P.workouts.find(w=>w.id===(state.selections[key()]||dayWorkout()?.id));
function switchView(v){if(v==='financeiro')v='finance';if($('moremenu').open)$('moremenu').close();view=v;history.replaceState(null,'','#'+v);render();document.querySelector('#'+v).scrollIntoView({behavior:'auto',block:'start'});}
function changeDate(d){if(Number.isNaN(d.getTime()))return;selected=d;render();}
function agenda(){const k=key();state.agenda[k]??=[];return state.agenda[k];}
const celebrationPhrases=[
 'Você fechou o dia com chave de ouro!',
 'Cada tarefa contou. Olha onde você chegou!',
 'Missão cumprida. Parabéns pelo seu dia!',
 'O que você planejou virou realidade.',
 'Hoje você cumpriu tudo o que se propôs a fazer.',
 'Seu esforço merece ser comemorado!',
 'Você deu um passo de cada vez e chegou aos 100%.',
 'Que satisfação ver tudo concluído!',
 'Sua constância apareceu em cada tarefa.',
 'Hoje você fez acontecer!',
 'A última tarefa fechou um dia inteiro de dedicação.',
 'Você cuidou do que era importante para você.',
 'Seu planejamento saiu do papel!',
 'Que orgulho do que você fez hoje!',
 'Hoje teve foco, dedicação e resultado.',
 'Você honrou o compromisso que fez consigo.',
 'Seu dia rendeu. Aproveite essa sensação!',
 'O esforço de hoje é motivo de orgulho.',
 'Você levou sua rotina até o fim!',
 'A lista está completa. A conquista é sua!',
 'Hoje você encontrou tempo para o que importa.',
 'Seu ritmo te trouxe até aqui.',
 'Você fez o que estava ao seu alcance e concluiu tudo.',
 'Hoje você mostrou o valor dos pequenos passos.',
 'Guarde a alegria de ver seu esforço dar resultado.',
 'Você concluiu a lista. Agora pode respirar fundo!',
 'Sua dedicação merece uma pausa para comemorar.',
 'Você começou, seguiu e terminou!',
 'Hoje você fez por você.',
 'Que bom ver seu esforço se transformar em progresso.',
 'Você fez uma tarefa de cada vez e completou o dia.',
 'Seu dia terminou com uma conquista para lembrar.',
 'Seu cuidado com a rotina deu resultado hoje.',
 'Você fez espaço para suas prioridades.',
 'Cada marcação conta um pouco do seu esforço.',
 'Dia completo. Aproveite o orgulho de ter chegado aqui!',
 'Você cumpriu o combinado com você.',
 'Hoje você foi até o fim no seu ritmo.',
 'Seu foco valeu a pena!',
 'Parabéns por terminar o que você começou.',
 'Você merece comemorar cada tarefa concluída.',
 'Hoje o plano ganhou vida nas suas mãos.',
 'Você fez caber o que era importante.',
 'Sua persistência fez diferença hoje.',
 'Você tem um bom motivo para sorrir hoje.',
 'O mérito de cada tarefa concluída é seu.',
 'Você encerrou a lista com 100%. Que conquista!',
 'Celebre o dia que você construiu, tarefa por tarefa.',
 'Seu esforço ficou visível. Parabéns!',
 'Tudo concluído. Esse momento é seu!'
];
let lastCelebrationPhrase=-1;
function celebrateCompletion(items){
 if(!items.length||!items.every(item=>item.done))return;
 const count=celebrationPhrases.length;
 lastCelebrationPhrase=(lastCelebrationPhrase+1+Math.floor(Math.random()*(count-1)))%count;
 const dialog=el('dialog',undefined,'completion-celebration');
 const heading=el('h2','100% das tarefas concluídas!');
 heading.id='completion-heading';
 dialog.setAttribute('aria-labelledby',heading.id);
 const close=el('button','Comemorar!','primary');
 close.type='button';
 close.onclick=()=>dialog.close();
 dialog.append(el('div','🏆','completion-trophy'),heading,el('p',celebrationPhrases[lastCelebrationPhrase]),close);
 dialog.firstChild.setAttribute('aria-hidden','true');
 dialog.onclose=()=>dialog.remove();
 document.body.append(dialog);
 dialog.showModal();
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const confetti=el('div',undefined,'completion-confetti');
 confetti.setAttribute('aria-hidden','true');
 const colors=['#f472b6','#fbcfe8','#fbbf24','#a78bfa','#60a5fa'];
 for(let i=0;i<40;i++){
  const piece=el('i');
  piece.style.setProperty('--confetti-x',Math.random()*100+'%');
  piece.style.setProperty('--confetti-drift',Math.random()*180-90+'px');
  piece.style.setProperty('--confetti-delay',Math.random()*.7+'s');
  piece.style.backgroundColor=colors[i%colors.length];
  confetti.append(piece);
 }
 dialog.append(confetti);
 setTimeout(()=>confetti.remove(),2900);
}
function render(){
 document.body.dataset.screen=view;
 const titles={finance:['Financeiro','Seus gastos, contas e planejamento.'],daybyday:['DayByDay','Sua rotina, um checkbox de cada vez.'],diary:['Meu diário','Seus registros de cada dia, guardados para consultar depois.'],overview:['No seu ritmo.','Marque suas atividades do dia e acompanhe seu progresso.'],training:['Meu treino e minhas cargas','Confira a data, preencha as séries e toque em Salvar exercício.'],mobility:['Mobilidade e alongamentos','Veja a sequência e marque o que você fez.'],food:['Minhas refeições','Consulte os horários, as porções e as opções do seu plano.'],history:['Minha evolução','Veja como as cargas mudaram de um treino para o outro.']};
 $('pagetitle').textContent=titles[view][0];$('pageintro').textContent=titles[view][1];$('homehero').hidden=view!=='overview';document.querySelector('.stats').hidden=['daybyday','finance'].includes(view);document.querySelector('.datecard').hidden=view==='finance';$('add').hidden=view==='finance';$('add').textContent='+ Nova atividade';

 document.querySelectorAll('.view').forEach(n=>n.hidden=n.id!==view);
 document.querySelectorAll('nav button[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-current',b.dataset.view===view?'page':'false');});
 $('moremenu-toggle').classList.toggle('active',['mobility','history','diary','finance'].includes(view));$('datepick').value=key();$('dateLabel').textContent=selected.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

 if(view==='finance'){renderFinance();return;}
 $('days').replaceChildren();let mon=new Date(selected);mon.setDate(mon.getDate()-((mon.getDay()+6)%7));
 for(let i=0;i<7;i++){const d=new Date(mon);d.setDate(d.getDate()+i);const b=el('button',undefined,'day'+(T.dateKey(d)===key()?' selected':''));b.append(document.createTextNode(d.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','')),el('b',d.getDate()));b.setAttribute('aria-label',d.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'}));b.setAttribute('aria-pressed',T.dateKey(d)===key());b.onclick=()=>changeDate(d);$('days').append(b);}
 const a=daybydayItems(),done=a.filter(x=>x.done).length,water=state.water[key()]||0;
 $('activitycount').replaceChildren(document.createTextNode(done+' '),el('small','/ '+a.length+' concluídas'));
 $('progress').style.width=(a.length?done/a.length*100:0)+'%';
 const sets=state.sessions.filter(s=>s.date===key()).reduce((sum,s)=>sum+T.summary(s).sets,0);
 $('setcount').replaceChildren(document.createTextNode(sets+' '),el('small','séries'));
 $('waterstat').replaceChildren(document.createTextNode(fmt(water*.25)+' '),el('small','litros'));$('cups').textContent=water+' copos';
 const w=dayWorkout();$('herotitle').textContent=w?'Hoje tem '+w.title.toLocaleLowerCase('pt-BR')+'.':'Seu dia, no seu ritmo.';
 if(view==='overview'||view==='daybyday'){const content=$('daybydaycontent');$(view==='overview'?'homechecklist':'daybyday').append(content);renderDaybyday();}if(view==='diary')renderDiary();if(view==='overview')renderAgenda();if(view==='training')renderTraining();if(view==='mobility')renderMobility();if(view==='food')renderFood();if(view==='history'){renderEvolution();renderHistory();}
 if(view==='overview')renderHomeLayout();
}
function renderAgenda(){
 const w=dayWorkout();$('workouttitle').textContent=w?w.title:'OFF de musculação';$('workoutdesc').textContent=w?'Abra o treino para registrar suas séries.':'Cadastre seu próprio treino na aba Treinos e cargas.';
 $('events').replaceChildren();for(const item of [...(state.agenda[key()]||[])].sort((a,b)=>a.time.localeCompare(b.time))){const row=el('div',undefined,'event'+(item.done?' completed':'')),body=el('div',undefined,'eventbody'),c=el('button',item.done?'✓':'','check'+(item.done?' done':''));
 body.append(el('strong',item.name),el('small',item.details));c.setAttribute('aria-label',(item.done?'Desmarcar ':'Concluir ')+item.name);c.setAttribute('aria-pressed',!!item.done);c.onclick=()=>{
  item.done=!item.done;
  persist();
  render();
  if(item.done)celebrateCompletion(agenda());
 };
 const tools=el('div',undefined,'eventtools'),edit=el('button','Editar'),del=el('button','Excluir');edit.setAttribute('aria-label','Editar '+item.name);del.setAttribute('aria-label','Excluir '+item.name);edit.onclick=()=>openActivity(item);del.onclick=()=>{const d=key(),snapshot={...item};state.agenda[d]=state.agenda[d].filter(x=>x.id!==item.id);persist();render();toast('Atividade removida.',()=>{state.agenda[d].push(snapshot);persist();render();});};tools.append(edit,del);
 row.append(el('div',item.time,'time'),el('div',{meal:'🥗',workout:'↗',habit:'〰'}[item.type]||'☀','eventicon'),body,c,tools);$('events').append(row);}
 const old=legacy.days?.[`${selected.getFullYear()}-${selected.getMonth()+1}-${selected.getDate()}`]||[];$('legacy').replaceChildren();if(!old.length)$('legacy').append(el('p','Nenhum registro anterior nesta data.','smallnote'));for(const x of old)$('legacy').append(el('p',`${x.time} · ${x.name}${x.done?' · concluído':''}`,'smallnote'));
}
function openActivity(item){editing=item||null;$('modaltitle').textContent=item?'Editar atividade':'Uma nova atividade';$('form').reset();$('name').value=item?.name||'';$('time').value=item?.time||state.trainingTime;$('type').value=item?.type||'workout';$('details').value=item?.details||'';$('modal').showModal();}
function renderTraining(){
 const w=chosenWorkout();renderSessionNav(w);$('workouttabs').replaceChildren();for(const t of [...P.workouts,{id:'off',title:'Descanso / sem treino'}]){const b=el('button',t.id==='off'?t.title:(t.day===-1?'Escolha livre':['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][t.day])+' · '+t.title,(w?.id||'off')===t.id?'active':'');b.setAttribute('aria-pressed',(w?.id||'off')===t.id);b.onclick=()=>{state.selections[key()]=t.id;persist();render();};$('workouttabs').append(b);}
 const content=$('workoutcontent');content.replaceChildren();appendPlanButton(content,'training');
 if(!w){content.append(el('h2','Seu treino','trainingheading'),el('p','Cadastre seus exercícios ou selecione um treino acima para registrar suas séries.','smallnote'));return;}
 const heading=el('div',undefined,'trainingheading');heading.append(el('h2',w.title),el('p','Seu plano pessoal · siga suas próprias orientações.','smallnote'));content.append(heading,el('p',w.notes||'Registre os valores realizados em cada exercício.','cardio'),el('p','3. Em cada exercício, digite o peso que usou e as repetições que fez. Depois toque em Salvar exercício. Se não realizou uma série, deixe os campos dela vazios.','smallnote'));
 for(const e of w.exercises)content.append(exerciseForm(e));
 $('guide').replaceChildren();for(const [title,body] of Object.entries(P.guide)){const p=el('p');p.append(el('strong',title+': '),document.createTextNode(body));$('guide').append(p);}
}
const bases=['Carga total (kg)','Por halter (kg)','Por lado (kg)','Peso da máquina (kg)','Peso corporal / sem carga','Elástico / sem kg'];
function defaultBasis(e){return e.timed?'Peso corporal / sem carga':e.name.includes('elástico')?'Elástico / sem kg':e.name.toLowerCase().includes('halter')?'Por halter (kg)':'Carga total (kg)';}
function exerciseForm(e){
 const d=key(),dk=d+'|'+e.id,saved=state.sessions.find(s=>s.date===d&&s.exercise===e.id),draft=drafts.get(dk),record=draft||saved;
 const section=el('section',undefined,'exerciseblock');section.id=e.id;const head=el('div',undefined,'exercisehead'),titles=el('div');titles.append(el('h3',e.name),el('div',`Ritmo: ${e.tempo||'não informado'} · Descanso: ${e.rest||'não informado'}`,'label'));head.append(titles,el('span',draft?'Não salvo':saved?'Registro salvo':'Sem registro','recordstatus'));section.append(head);
 section.append(el('div',e.sets.map((s,i)=>`${i+1}ª série: ${s}`).join('\n')+(e.note?'\n'+e.note:''),'prescription'));
 const form=el('form',undefined,'loadform'),fields=el('div',undefined,'contextfields');form.append(el('p',e.timed?'Preencha quantos segundos você manteve cada série. Se não usou peso extra, deixe Peso vazio.':'Exemplo de preenchimento: se você usou 20 kg e fez 12 repetições, digite 20 em Peso e 12 em Repetições. Use seus valores reais.','entryhelp'));
 const variantLabel=el('label','Equipamento / variação'),variant=el(e.options.length?'select':'input');
 if(e.options.length){for(const name of e.options){const o=el('option',name);o.value=name;variant.append(o);}}else{variant.type='text';variant.maxLength=80;variant.placeholder='Ex.: máquina 1, barra, halteres';}
 variant.value=record?.variant||(e.options[0]||'Padrão');variant.required=true;variantLabel.append(variant);
 const basisLabel=el('label','Como você conta o peso?'),basis=el('select');for(const name of bases){const o=el('option',name);o.value=name;basis.append(o);}basis.value=record?.basis||defaultBasis(e);basisLabel.append(basis);fields.append(variantLabel,basisLabel);const settings=el('details',undefined,'exerciseoptions'),settingsTitle=el('summary','Equipamento e ajuda'),settingsHint=el('small',basis.value+' · '+variant.value);settingsTitle.append(settingsHint);settings.append(settingsTitle,form.querySelector('.entryhelp'),fields);settings.open=window.matchMedia('(min-width:901px) and (pointer:fine)').matches;form.append(settings);
 const wrap=el('div',undefined,'tablewrap'),table=el('table'),thead=el('thead'),tr=el('tr');for(const text of ['Série','Peso (kg)',e.timed?'Segundos feitos':'Repetições feitas'])tr.append(el('th',text));thead.append(tr);table.append(thead);const tbody=el('tbody'),inputs=[];
 e.sets.forEach((pres,i)=>{const row=el('tr'),label=el('td',(i+1)+'ª');label.append(el('small',pres));const kg=el('input'),reps=el('input');kg.type=reps.type='number';kg.min='0';kg.max='2000';kg.step='0.01';kg.inputMode='decimal';kg.placeholder='—';reps.min='1';reps.max=e.timed?'7200':'1000';reps.step=e.timed?'0.1':'1';reps.inputMode=e.timed?'decimal':'numeric';reps.placeholder='—';kg.value=record?.rows[i]?.kg??'';reps.value=record?.rows[i]?.reps??'';kg.setAttribute('aria-label',`${e.name}, série ${i+1}, peso em kg`);reps.setAttribute('aria-label',`${e.name}, série ${i+1}, ${e.timed?'segundos':'repetições'} realizados`);const td1=el('td'),td2=el('td');td1.dataset.label='Peso (kg)';td2.dataset.label=e.timed?'Segundos':'Repetições';td1.append(kg);td2.append(reps);row.append(label,td1,td2);tbody.append(row);inputs.push({kg,reps});});table.append(tbody);wrap.append(table);form.append(wrap);
 const noteLabel=el('label','Observações · execução, reserva, drop ou elástico'),note=el('input');note.type='text';note.maxLength=500;note.placeholder='Ex.: boa execução, drop com 15 kg × 8 reps';note.value=record?.notes||'';noteLabel.append(note);form.append(noteLabel);
 const savebar=el('div',undefined,'savebar'),status=el('p',saved?'Salvo nesta data. Você pode editar e salvar novamente.':'Ainda não salvo. Toque no botão após preencher.');status.setAttribute('role','status');const save=el('button','Salvar exercício','primary');save.type='submit';savebar.append(status,save);form.append(savebar);const comparison=el('div',undefined,'comparison');
 const makeRecord=()=>({date:d,exercise:e.id,variant:variant.value.trim(),basis:basis.value,notes:note.value.trim(),rows:inputs.map(r=>({kg:r.kg.value,reps:r.reps.value}))});
 const updateComparison=()=>{comparison.replaceChildren();const prev=T.previous(state.sessions,e.id,d,variant.value.trim(),basis.value);if(!prev){comparison.append(el('strong','Ainda não há um treino anterior para comparar'),document.createTextNode('Salve suas séries hoje. Quando repetir este exercício em outro dia, a comparação aparecerá aqui. Use o mesmo equipamento e a mesma forma de contar o peso.'));return;}
 const p=T.summary(prev);comparison.append(el('strong','Sessão anterior · '+dateLabel(prev.date)),document.createTextNode(prev.rows.map((r,i)=>r.reps===null?null:`S${i+1}: ${r.kg===null?'sem kg':fmt(r.kg)+' kg'} × ${fmt(r.reps)} ${e.timed?'s':'reps'}`).filter(Boolean).join(' · ')));
 const current=state.sessions.find(s=>s.date===d&&s.exercise===e.id&&s.variant===variant.value.trim()&&s.basis===basis.value);
 if(current){const c=T.summary(current);if(c.max!==null&&p.max!==null){const delta=c.max-p.max;comparison.append(el('p',`Maior carga da sessão: ${fmt(c.max)} kg · ${delta>0?'+':''}${fmt(delta)} kg em relação à anterior. Compare também as repetições por série.`));}}
 };
 const dirtyMark=()=>{settingsHint.textContent=basis.value+' · '+variant.value;drafts.set(dk,makeRecord());dirty=true;status.textContent='Você alterou os dados. Toque em Salvar exercício.';head.lastChild.textContent='Não salvo';};form.addEventListener('input',dirtyMark);variant.addEventListener('change',()=>{dirtyMark();updateComparison();});basis.addEventListener('change',()=>{dirtyMark();updateComparison();});
 form.onsubmit=event=>{event.preventDefault();if(!form.reportValidity())return;try{const rec=makeRecord();if(!rec.variant)throw Error('Informe o equipamento ou a variação.');rec.rows=T.normalize(rec.rows,e.timed);rec.updatedAt=new Date().toISOString();state.sessions=state.sessions.filter(s=>!(s.date===d&&s.exercise===e.id));state.sessions.push(rec);if(persist()){drafts.delete(dk);dirty=drafts.size>0;status.textContent='Exercício salvo em '+dateLabel(d)+'.';head.lastChild.textContent='Registro salvo';updateComparison();const count=state.sessions.filter(s=>s.date===key()).reduce((sum,s)=>sum+T.summary(s).sets,0);$('setcount').replaceChildren(document.createTextNode(count+' '),el('small','séries'));section.replaceWith(exerciseForm(e));renderSessionNav(chosenWorkout());toast('Carga e repetições salvas.');}}catch(error){status.textContent=error.message;status.classList.add('danger');}};
 updateComparison();section.append(form,comparison);const hist=el('button','Ver histórico deste exercício →','historylink');hist.onclick=()=>{historyExercise=e.id;historyContext=T.context(makeRecord());switchView('history');};section.append(hist);
 if(saved){const remove=el('button','Remover registro desta data','historylink');remove.style.cssText='display:block;color:#8c5d51;font-size:11px';remove.onclick=()=>{const copy=structuredClone(state.sessions.find(s=>s.date===d&&s.exercise===e.id));state.sessions=state.sessions.filter(s=>!(s.date===d&&s.exercise===e.id));drafts.delete(dk);dirty=drafts.size>0;persist();render();toast('Registro removido.',()=>{state.sessions=state.sessions.filter(s=>!(s.date===d&&s.exercise===e.id));state.sessions.push(copy);persist();render();});};section.append(remove);}return section;
}
function renderMobility(){
 const k=key();state.mobility[k]??=[];$('mobilitylist').replaceChildren();appendPlanButton($('mobilitylist'),'mobility');
 if(!P.mobility.length)$('mobilitylist').append(el('p','Cadastre sua sequência de mobilidade.','smallnote'));
 P.mobility.forEach(([name,reps],i)=>{const row=el('div',undefined,'event'),body=el('div',undefined,'eventbody'),done=state.mobility[k][i],check=el('button',done?'✓':'','check'+(done?' done':''));body.append(el('strong',name),el('small',reps));check.setAttribute('aria-label',(done?'Desmarcar ':'Concluir ')+name);check.setAttribute('aria-pressed',!!done);check.onclick=()=>{while(state.mobility[k].length<P.mobility.length)state.mobility[k].push(false);state.mobility[k][i]=!done;persist();renderMobility();};row.append(el('div',String(i+1).padStart(2,'0'),'time'),body,check);$('mobilitylist').append(row);});
}
function renderFood(){
 const content=$('mealcontent');content.replaceChildren();appendPlanButton(content,'meals');if(P.foodNotes)content.append(el('pre',P.foodNotes,'mealtext smallnote'));
 if(!P.meals.length)content.append(el('p','Cadastre seus horários, refeições, porções e substituições.','smallnote'));
 P.meals.forEach((meal,i)=>{const section=el('section',undefined,'mealblock');section.append(el('h3',(meal.time?meal.time+' · ':'')+meal.title),el('pre',meal.ingredients,'mealtext'));for(const sub of meal.substitutions){const detail=el('details');detail.append(el('summary','Opção de substituição'),el('pre',sub,'mealtext'));section.append(detail);}const button=el('button',state.mealchoices[key()]?.[i]?'✓ Refeição realizada':'Marcar como realizada','secondary');button.setAttribute('aria-pressed',!!state.mealchoices[key()]?.[i]);button.onclick=()=>{state.mealchoices[key()]??=[];while(state.mealchoices[key()].length<P.meals.length)state.mealchoices[key()].push(0);state.mealchoices[key()][i]=state.mealchoices[key()][i]?0:1;persist();renderFood();};section.append(button);content.append(section);});
}
function evolutionGroups(){
 const groups=new Map(),period=new Set(evolutionDates().map(T.dateKey));
 for(const session of state.sessions){
  if(!period.has(session.date)||!exerciseById.has(session.exercise))continue;
  const groupKey=JSON.stringify([session.exercise,session.variant,session.basis]);
  if(!groups.has(groupKey))groups.set(groupKey,[]);
  groups.get(groupKey).push(session);
 }
 return Array.from(groups.values(),sessions=>sessions.sort((a,b)=>b.date.localeCompare(a.date)))
  .sort((a,b)=>b[0].date.localeCompare(a[0].date));
}
function evolutionDates(endDate=new Date(),length=30){
 return Array.from({length},(_,i)=>new Date(endDate.getFullYear(),endDate.getMonth(),endDate.getDate()-length+1+i,12));
}
function renderEvolution(dates=evolutionDates(),grid=$('evolutioncards'),period=$('evolutionperiod')){
 const start=T.dateKey(dates[0]),end=T.dateKey(dates.at(-1));
 period.textContent='Meu histórico · '+dateLabel(start)+' a '+dateLabel(end);
 grid.replaceChildren();
 if(grid===$('evolutioncards'))$('exportevolution').disabled=!state.sessions.some(s=>s.date>=start&&s.date<=end);
 const days=new Map(dates.map(date=>[T.dateKey(date),date.getDay()]));
 const sessions=new Map(state.sessions.filter(s=>days.has(s.date)).map(s=>[s.exercise+'|'+s.date,s]));
 const basisLabels={'Carga total (kg)':'Total','Peso da máquina (kg)':'Máquina','Por halter (kg)':'Por halter','Por lado (kg)':'Por lado','Peso corporal / sem carga':'Peso corporal','Elástico / sem kg':'Elástico'};
 for(const workout of P.workouts){
  const exerciseIds=new Set(workout.exercises.map(e=>e.id));
  const recordedDates=new Set([...sessions.values()].filter(s=>exerciseIds.has(s.exercise)).map(s=>s.date));
  const columns=[...days].filter(([date,weekday])=>weekday===workout.day||recordedDates.has(date)).map(([date])=>date);
  const contextsByExercise=new Map();
  for(const exercise of workout.exercises){
   const contexts=new Map();
   for(const date of columns){
    const session=sessions.get(exercise.id+'|'+date);
    if(!session?.basis?.endsWith('(kg)'))continue;
    const weight=T.summary(session).max;
    if(weight===null)continue;
    const context=T.context(session);
    if(!contexts.has(context))contexts.set(context,{label:[session.variant==='Padrão'?'':session.variant,basisLabels[session.basis]||session.basis].filter(Boolean).join(' · '),weights:[]});
    contexts.get(context).weights.push(weight);
   }
   contextsByExercise.set(exercise.id,contexts);
  }
  const printing=grid===$('evolution-print-grid');
  const pageSize=printing?8:Math.max(1,columns.length);
  const pageCount=Math.max(1,Math.ceil(columns.length/pageSize));
  for(let page=0;page<pageCount;page++){
   const pageDates=columns.slice(page*pageSize,(page+1)*pageSize);
   const section=el('section',undefined,'evolution-workout');
   const weekday=new Date(2026,0,4+workout.day,12).toLocaleDateString('pt-BR',{weekday:'long'});
   const title=weekday+' · '+workout.title+(pageCount>1?' · Parte '+(page+1)+' de '+pageCount:'');
   const wrap=el('div',undefined,'evolution-scroll'),table=el('table',undefined,'evolution-table');
   wrap.tabIndex=0;
   wrap.setAttribute('role','region');
   wrap.setAttribute('aria-label',title);
   const head=table.createTHead().insertRow();
   for(const label of ['Exercício',...pageDates.map(d=>dateLabel(d).slice(0,printing?10:5)),'Variação no período']){
    const th=el('th',label);
    th.scope='col';
    head.append(th);
   }
   const body=table.createTBody();
   for(const exercise of workout.exercises){
    const row=body.insertRow(),name=el('th',exercise.name);
    name.scope='row';
    row.append(name);
    const contexts=contextsByExercise.get(exercise.id);
    for(const date of pageDates){
     const session=sessions.get(exercise.id+'|'+date),cell=row.insertCell();
     const basis=session?.basis,shortBasis=basisLabels[basis]||basis;
     const weight=session&&basis?.endsWith('(kg)')?T.summary(session).max:null;
     if(weight===null){
      cell.append(el('span',session?(basis==='Peso corporal / sem carga'||basis==='Elástico / sem kg'?shortBasis:'Sem carga em kg'):'Sem registro','evolution-square'));
      continue;
     }
     const comparison=contexts.get(T.context(session));
     const square=el('span',undefined,'evolution-square has-load');
     square.append(el('strong',fmt(weight)+' kg'),el('small',comparison.label));
     cell.append(square);
    }
    const variations=row.insertCell();
    for(const {label,weights} of contexts.values()){
     if(weights.length<2)continue;
     const delta=Number((weights.at(-1)-weights[0]).toFixed(2));
     const square=el('span',undefined,'evolution-square'+(delta>0?' has-load':''));
     square.append(el('strong',(delta>0?'+':'')+fmt(delta)+' kg'));
     if(contexts.size>1)square.append(el('small',label));
     variations.append(square);
    }
    if(!variations.childElementCount)variations.append(el('span',contexts.size>1?'Referências distintas':contexts.size?'1 carga lançada':'Sem comparação','evolution-square'));
   }
   wrap.append(table);
   section.append(el('h4',title),wrap);
   grid.append(section);
  }
 }
}
const pdfPreset=$('evolution-pdf-preset'),pdfStart=$('evolution-pdf-start'),pdfEnd=$('evolution-pdf-date');
function updatePdfPeriod(){
 const custom=pdfPreset.value==='custom';
 const today=new Date();
 pdfStart.max=pdfEnd.max=T.dateKey(today);
 $('evolution-pdf-custom').hidden=!custom;
 pdfStart.disabled=pdfEnd.disabled=!custom;
 pdfEnd.setCustomValidity('');
 const status=$('evolution-pdf-period');
 let dates;
 if(custom){
  if(!pdfStart.validity.valid||!pdfEnd.validity.valid){
   status.textContent='Escolha duas datas até hoje.';
   return [];
  }
  if(pdfStart.value>pdfEnd.value){
   const message='A data final deve ser igual ou posterior à data de início.';
   pdfEnd.setCustomValidity(message);
   status.textContent=message;
   return [];
  }
  const start=new Date(pdfStart.value+'T12:00:00'),end=new Date(pdfEnd.value+'T12:00:00');
  dates=[];
  for(let date=start;date<=end;date=new Date(date.getFullYear(),date.getMonth(),date.getDate()+1,12))dates.push(date);
 }else{
  dates=evolutionDates(today,Number(pdfPreset.value));
  pdfStart.value=T.dateKey(dates[0]);
  pdfEnd.value=T.dateKey(dates.at(-1));
 }
 status.textContent=dateLabel(pdfStart.value)+' a '+dateLabel(pdfEnd.value)+' · '+dates.length+(dates.length===1?' dia':' dias');
 return dates;
}
pdfPreset.onchange=updatePdfPeriod;
for(const input of [pdfStart,pdfEnd]){
 input.oninput=updatePdfPeriod;
 input.onfocus=updatePdfPeriod;
}
updatePdfPeriod();
$('evolution-pdf-form').onsubmit=event=>{
 event.preventDefault();
 const dates=updatePdfPeriod();
 if(!dates.length)return;
 renderEvolution(dates,$('evolution-print-grid'),$('evolution-print-period'));
 window.print();
};
function renderHistory(){
 const select=$('historyexercise');select.replaceChildren();for(const e of allExercises){const o=el('option',`${e.workout.toUpperCase()} · ${e.name}`);o.value=e.id;select.append(o);}select.value=historyExercise;select.onchange=()=>{historyExercise=select.value;historyContext='';renderHistory();};
 const e=exerciseById.get(historyExercise),sessions=state.sessions.filter(s=>s.exercise===historyExercise).sort((a,b)=>a.date.localeCompare(b.date)),contexts=[...new Set(sessions.map(T.context))];const context=$('historycontext');context.replaceChildren();
 if(!contexts.includes(historyContext))historyContext=contexts[0]||'';
 for(const c of contexts){const o=el('option',c.split('|||').join(' · '));o.value=c;context.append(o);}context.value=historyContext;context.disabled=!contexts.length;context.onchange=()=>{historyContext=context.value;renderHistory();};
 const records=sessions.filter(s=>T.context(s)===historyContext),content=$('historycontent');content.replaceChildren();$('exporthistory').disabled=!records.length;
 if(!records.length){content.append(el('p','Você ainda não salvou este exercício. Registre o primeiro treino para começar o histórico. Com duas datas salvas, você poderá comparar as cargas.','empty'));const start=el('button','Ir para os treinos e registrar','primary');start.onclick=()=>switchView('training');content.append(start);return;}
 const first=T.summary(records[0]),last=T.summary(records.at(-1)),summary=el('div',undefined,'historysummary');for(const [label,value] of [['Sessões registradas',records.length],['Maior carga · última sessão',last.max===null?'Sem carga em kg':fmt(last.max)+' kg'],['Variação desde o início',last.max!==null&&first.max!==null?(last.max-first.max>0?'+':'')+fmt(last.max-first.max)+' kg':'Sem comparação em kg']]){const card=el('div');card.append(el('small',label),el('strong',value));summary.append(card);}content.append(summary);
 const plotted=records.filter(s=>T.summary(s).max!==null).slice(-12);if(plotted.length){const chart=el('div',undefined,'historychart'),max=Math.max(...plotted.map(s=>T.summary(s).max),1);chart.setAttribute('role','img');chart.setAttribute('aria-label','Maior carga por sessão: '+plotted.map(s=>dateLabel(s.date)+', '+fmt(T.summary(s).max)+' kg').join('; '));for(const s of plotted){const val=T.summary(s).max,col=el('div'),bar=el('i');bar.style.height=(val/max*105)+'px';col.append(el('b',fmt(val)+' kg'),bar,el('small',dateLabel(s.date).slice(0,5)));chart.append(col);}content.append(chart,el('p','Maior carga registrada por sessão · até as últimas 12 sessões. Não é uma recomendação de aumento de carga.','chartcaption'));}
 const wrap=el('div',undefined,'tablewrap'),table=el('table'),head=el('tr');for(const text of ['Data','Séries realizadas','Maior carga','Variação anterior'])head.append(el('th',text));table.classList.add('mobile-records');const thead=el('thead');thead.append(head);table.append(thead);const tbody=el('tbody');records.slice().reverse().forEach(s=>{const index=records.indexOf(s),prev=index>0?T.summary(records[index-1]):null,cur=T.summary(s),delta=prev&&prev.max!==null&&cur.max!==null?cur.max-prev.max:null,row=el('tr'),date=el('td'),link=el('button',dateLabel(s.date),'historylink');link.onclick=()=>{selected=new Date(s.date+'T12:00:00');state.selections[key()]=e.workout;switchView('training');document.getElementById(e.id)?.scrollIntoView({behavior:'auto',block:'start'});};date.append(link);const detail=el('td');detail.append(el('span',s.rows.map((r,i)=>r.reps===null?null:`S${i+1}: ${r.kg===null?'sem kg':fmt(r.kg)+' kg'} × ${fmt(r.reps)} ${e.timed?'s':'reps'}`).filter(Boolean).join(' · ')));if(s.notes)detail.append(el('small',s.notes));row.append(date,detail,el('td',cur.max===null?'—':fmt(cur.max)+' kg'),el('td',delta===null?'—':(delta>0?'+':'')+fmt(delta)+' kg'));row.dataset.mobileRecord='true';Array.from(row.children).forEach((td,i)=>td.dataset.label=['Data','Séries realizadas','Maior carga','Variação anterior'][i]);tbody.append(row);});table.append(tbody);wrap.append(table);content.append(wrap,el('p','Toque na data para abrir e corrigir o registro. Comparações separam os treinos e os contextos de carga; confira as repetições e a técnica.','smallnote'));
}
function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type})),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportEvolution(){
 const groups=evolutionGroups();
 if(!groups.length)return;
 const escapeXml=value=>String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 const cell=(value,style='')=>{
  const attr=style?' ss:StyleID="'+style+'"':'';
  if(value===null)return '<Cell'+attr+'/>';
  const type=style==='date'?'DateTime':typeof value==='number'?'Number':'String';
  return '<Cell'+attr+'><Data ss:Type="'+type+'">'+escapeXml(value)+'</Data></Cell>';
 };
 const day=value=>cell(value+'T00:00:00.000','date');
 const row=cells=>'<Row>'+cells.join('')+'</Row>';
 const sheet=(name,widths,head,rows)=>'<Worksheet ss:Name="'+name+'"><Table>'
  +widths.map(width=>'<Column ss:Width="'+width+'"/>').join('')
  +row(head.map(label=>cell(label,'header')))+rows.join('')+'</Table>'
  +'<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane></WorksheetOptions></Worksheet>';
 const change=(current,previous)=>current===null||previous===null?null:Number((current-previous).toFixed(2));
 const summaryRows=[],sessionRows=[];
 for(const sessions of groups){
  const latest=sessions[0],first=sessions.at(-1);
  const labels=[exerciseById.get(latest.exercise).name,latest.variant,latest.basis];
  const weights=sessions.map(session=>T.summary(session).max);
  const latestKg=weights[0],firstKg=weights.at(-1);
  const progress=change(latestKg,firstKg);
  const scale=Math.max(1,...weights);
  summaryRows.push(row([...labels.map(value=>cell(value)),cell(sessions.length),day(first.date),cell(firstKg),
   day(latest.date),cell(latestKg),cell(progress,progress>0?'gain':'delta')]));
  for(let i=sessions.length-1;i>=0;i--){
   const kg=weights[i],delta=change(kg,weights[i+1]??null);
   const bar=kg===null?'': '█'.repeat(kg===0?0:Math.max(1,Math.round(kg/scale*16)));
   sessionRows.push(row([...labels.map(value=>cell(value)),day(sessions[i].date),cell(kg),
    cell(delta,delta>0?'gain':'delta'),cell(bar,'bar')]));
  }
 }
 const xml='<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>'
  +'<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'
  +'<Styles><Style ss:ID="Default" ss:Name="Normal"><Font ss:FontName="Calibri" ss:Size="11"/><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style>'
  +'<Style ss:ID="header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#272027" ss:Pattern="Solid"/></Style>'
  +'<Style ss:ID="date"><NumberFormat ss:Format="dd/mm/yyyy"/></Style>'
  +'<Style ss:ID="delta"><NumberFormat ss:Format="+0.##;-0.##;0"/></Style>'
  +'<Style ss:ID="gain" ss:Parent="delta"><Font ss:Bold="1" ss:Color="#782453"/><Interior ss:Color="#FCE7F3" ss:Pattern="Solid"/></Style>'
  +'<Style ss:ID="bar"><Font ss:FontName="Consolas" ss:Color="#A13678"/></Style></Styles>'
  +sheet('Resumo',[160,110,110,55,80,85,80,85,100],['Exercício','Equipamento','Referência da carga','Sessões','Primeira data','1ª carga máx. (kg)','Última data','Última carga máx. (kg)','Desde o início (kg)'],summaryRows)
  +sheet('Sessões',[160,110,110,80,85,110,155],['Exercício','Equipamento','Referência da carga','Data','Carga máxima (kg)','Diferença anterior (kg)','Carga relativa ao pico do exercício'],sessionRows)
  +'</Workbook>';
 download(xml,'ritmo-evolucao-cargas-'+T.dateKey(new Date())+'.xml','application/vnd.ms-excel;charset=utf-8');
}
$('exportevolution').onclick=exportEvolution;
function backup(){return {app:'daybyday-system',version:2,owner:window.RitmoCloud.owner(),plan:P,originalDays:window.RitmoCloud.originalDays(),exportedAt:new Date().toISOString(),state:{...state,sessions:undefined},sessions:state.sessions,legacy};}
function exportBackup(){download(JSON.stringify(backup(),null,2),'daybyday-backup-'+T.dateKey(new Date())+'.json','application/json');toast('Backup exportado. Ele contém seus registros pessoais.');}
async function importBackup(event){const file=event.target.files[0];if(!file)return;try{if(file.size>15*1024*1024)throw Error('Use um arquivo de até 15 MB.');const raw=JSON.parse(await file.text());if(raw.owner!==window.RitmoCloud.owner())throw Error('Use um backup desta conta.');const days=raw.app==='daybyday'&&raw.version===1?raw.days:raw.app==='daybyday-system'&&raw.version===2?raw.originalDays:null;if(!days||typeof days!=='object'||Array.isArray(days))throw Error('Backup inválido.');for(const [day,p]of Object.entries(days)){if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||T.dateKey(new Date(day+'T12:00:00'))!==day)throw Error('Data inválida.');T.validateDaybyday(p);}if(!confirm('Combinar este backup com seus registros? Nas datas repetidas, os dados do arquivo serão usados. Uma cópia atual será baixada antes.'))return;exportBackup();await window.RitmoCloud.restoreDays(days);}catch(e){toast(e.message);}finally{event.target.value='';}}
$('export').onclick=$('exportmobile').onclick=$('exportmenu').onclick=exportBackup;$('import').onchange=$('importmobile').onchange=$('importmenu').onchange=importBackup;
$('prev').onclick=()=>{const d=new Date(selected);d.setDate(d.getDate()-7);changeDate(d);};$('next').onclick=()=>{const d=new Date(selected);d.setDate(d.getDate()+7);changeDate(d);};$('today').onclick=()=>changeDate(new Date());$('datepick').onchange=()=>changeDate(new Date($('datepick').value+'T12:00:00'));
$('more').onclick=()=>{state.water[key()]=(state.water[key()]||0)+1;persist();render();};$('less').onclick=()=>{state.water[key()]=Math.max(0,(state.water[key()]||0)-1);persist();render();};
$('add').onclick=()=>editDaybyday();$('cancel').onclick=()=>$('modal').close();$('form').onsubmit=event=>{event.preventDefault();const name=$('name').value.trim();if(!name)return;const obj={id:editing?.id||'custom-'+Date.now(),name,time:$('time').value,type:$('type').value,details:$('details').value.trim(),done:editing?.done||false};if(editing){state.agenda[key()]=agenda().map(x=>x.id===editing.id?obj:x);if(obj.id==='training')state.trainingTime=obj.time;}else agenda().push(obj);persist();$('modal').close();render();toast('Atividade salva.');};
$('addlegacyactivity').onclick=()=>openActivity();
$('openworkout').onclick=$('starttraining').onclick=()=>switchView('training');document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>switchView(b.dataset.go));document.querySelectorAll('nav button[data-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});


function renderSessionNav(w){
 const nav=$('sessionnav');nav.replaceChildren();nav.hidden=!w;if(!w)return;
 const saved=state.sessions.filter(s=>s.date===key()&&w.exercises.some(e=>e.id===s.exercise)).length;
 const heading=el('div');heading.append(el('p','Registros de '+dateLabel(key()),'recorddate'));heading.append(el('strong',saved+' de '+w.exercises.length+' exercícios com registro salvo'),el('p','Use a lista para ir direto ao exercício que você está fazendo.','smallnote'));
 const label=el('label','Ir para o exercício'),select=el('select');select.id='exercisejump';select.setAttribute('aria-label','Ir para o exercício');w.exercises.forEach((e,i)=>{const done=state.sessions.some(s=>s.date===key()&&s.exercise===e.id),o=el('option',(i+1)+'. '+e.name+(done?' · salvo':''));o.value=e.id;select.append(o);});label.append(select);
 const go=el('button','Abrir exercício ↓','primary');go.onclick=()=>document.getElementById(select.value)?.scrollIntoView({behavior:'auto',block:'start'});const date=el('button','Alterar data','secondary');date.onclick=()=>{$('datepick').scrollIntoView({behavior:'auto',block:'center'});$('datepick').focus({preventScroll:true});};nav.append(heading,label,go,date);
}

function renderDiary(){
 const k=key(),a=daybydayItems(),sessions=state.sessions.filter(s=>s.date===k);$('daynote').value=state.notes[k]||'';$('diarysummary').replaceChildren();const stats=el('div',undefined,'historysummary');for(const [name,value] of [['Atividades concluídas',a.filter(x=>x.done).length+' / '+a.length],['Séries salvas',sessions.reduce((n,s)=>n+T.summary(s).sets,0)],['Água registrada',fmt((state.water[k]||0)*.25)+' L'],['Mobilidades feitas',(state.mobility[k]||[]).filter(Boolean).length+' / '+P.mobility.length]]){const item=el('div');item.append(el('small',name),el('strong',value));stats.append(item);}$('diarysummary').append(stats);renderPreviousRecords($('diarysummary'),k);
 const dates=[...new Set([...Object.keys(state.agenda),...Object.keys(state.notes),...state.sessions.map(s=>s.date)])].sort().reverse(),table=el('table'),head=el('tr');for(const title of ['Dia','Atividades','Séries','Água','Anotação'])head.append(el('th',title));table.classList.add('mobile-records');table.append(head);for(const d of dates){const row=el('tr'),cell=el('td'),b=el('button',dateLabel(d),'historylink');b.onclick=()=>changeDate(new Date(d+'T12:00:00'));cell.append(b);row.append(cell,el('td',(state.agenda[d]||[]).filter(x=>x.done).length),el('td',state.sessions.filter(s=>s.date===d).reduce((n,s)=>n+T.summary(s).sets,0)),el('td',fmt((state.water[d]||0)*.25)+' L'),el('td',state.notes[d]||'—'));row.dataset.mobileRecord='true';Array.from(row.children).forEach((td,i)=>td.dataset.label=['Dia','Atividades feitas','Séries salvas','Água','Anotação'][i]);table.append(row);}$('diaryhistory').replaceChildren(table);$('auditlist').replaceChildren();
}
$('daynoteform').onsubmit=e=>{e.preventDefault();state.notes[key()]=$('daynote').value.trim();persist();toast('Anotação registrada. Confira a confirmação de salvamento online.');renderDiary();};
$('auditload').onclick=async()=>{const date=key();$('auditlist').textContent='Consultando…';try{const data=await window.RitmoCloud.audit(date);if(date!==key())return;$('auditlist').replaceChildren();if(!data.changes.length)$('auditlist').append(el('p','Nenhuma alteração online para este dia.','smallnote'));for(const change of data.changes){const p=el('p','Versão '+change.revision+' · '+new Date(change.created_at).toLocaleString('pt-BR'),'smallnote');const detail=el('details');detail.append(el('summary','Ver esta versão'),el('pre',JSON.stringify(change.payload,null,2),'mealtext'));$('auditlist').append(p,detail);}}catch(e){$('auditlist').textContent=e.message;}};

$('moremenu-toggle').onclick=()=>$('moremenu').showModal();$('closemore').onclick=()=>$('moremenu').close();
function daybydayItems(d=key()){
 state.daybyday[d]??={};
 if(!state.daybyday[d].items){state.daybyday[d].items=[];}
 const routines=state.daybyday['2000-01-02']?.routines||[];
 const weekday=String(new Date(d+'T12:00:00').getDay());
 let added=false;
 for(const routine of routines){
  if(d<routine.from||state.daybyday[d].skippedRoutines?.includes(routine.id)||!(routine.repeat==='daily'||routine.repeat===weekday)||state.daybyday[d].items.some(item=>item.id===routine.id))continue;
  if(state.daybyday[d].items.length>=100)break;
  const {from,repeat,...item}=routine;state.daybyday[d].items.push({...item,done:false});added=true;
 }
 if(added)persist();
 return state.daybyday[d].items;
}
const daybydayCategories={rest:'Descanso e rotina',health:'Saúde',study:'Estudos',work:'Trabalho',self:'Autocuidado',english:'Idiomas',pt:'Português',cook:'Cozinha'};
function daybydayProgress(title,done,total){
 const box=el('div',undefined,'db-progress'),top=el('div',undefined,'title'),pct=total?Math.round(done/total*100):0,bar=el('progress');bar.max=total||1;bar.value=done;bar.setAttribute('aria-label',title);top.append(el('strong',title),el('strong',done?pct+'%':'—'));box.append(top,bar,el('p',done+' de '+total+' concluídas','smallnote'));return box;
}
function renderDaybyday(){
 const content=$('daybydaycontent'),d=key(),items=daybydayItems(),done=items.filter(x=>x.done).length;content.replaceChildren();
 const intro=el('div',undefined,'card db-intro');intro.append(el('span','DAYBYDAY','tag'),el('h2','Um dia de cada vez.'),el('p','Cada atividade marcada conta para a porcentagem, inclusive as opcionais. Toque em uma data no calendário para consultar ou registrar outro dia.','smallnote'));
 const source=el('details');source.append(el('summary','Sobre esta rotina'),el('p','Sua rotina pessoal. Cadastre atividades para uma data ou com repetição. O Início e a Minha rotina mostram as mesmas marcações.','smallnote'));intro.append(source);content.append(intro);
 const daily=el('section',undefined,'card db-daily'),title=el('div',undefined,'title'),actions=el('div',undefined,'db-actions'),add=el('button','+ Atividade','secondary'),reset=el('button','Desmarcar o dia','secondary');
 add.onclick=()=>editDaybyday();reset.disabled=!done;reset.onclick=()=>{if(!confirm('Desmarcar apenas as atividades DayByDay de '+dateLabel(d)+'?'))return;const snapshot=structuredClone(items);items.forEach(x=>x.done=false);persist();render();toast('Marcações do dia removidas.',()=>{state.daybyday[d].items=snapshot;persist();render();});};actions.append(add,reset);title.append(el('h3',selected.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})),actions);daily.append(title,daybydayProgress('Atividades concluídas no dia',done,items.length));
 const list=el('div',undefined,'db-timeline');
 for(const item of [...items].sort((a,b)=>a.time.localeCompare(b.time))){
  const row=el('div',undefined,'db-item db-'+item.category+(item.done?' db-done':'')),label=el('label',undefined,'db-checklabel'),check=el('input'),body=el('span',undefined,'db-body'),tools=el('div',undefined,'db-tools'),edit=el('button','Editar','secondary'),remove=el('button','Excluir','secondary');check.type='checkbox';check.checked=item.done;check.onchange=()=>{item.done=check.checked;persist();render();const restored=document.querySelector('[data-db-id="'+CSS.escape(item.id)+'"]');restored?.focus();if(item.done)celebrateCompletion(items);};check.dataset.dbId=item.id;check.setAttribute('aria-label',item.name+' às '+item.time);body.append(el('small',item.time+' · '+daybydayCategories[item.category]+(item.optional?' · Opcional':''),'db-time'),el('strong',item.name));if(item.details)body.append(el('small',item.details));label.append(check,body);edit.setAttribute('aria-label','Editar '+item.name);edit.onclick=()=>editDaybyday(item);remove.setAttribute('aria-label','Excluir '+item.name);remove.onclick=()=>{const snapshot=structuredClone(items);state.daybyday[d].items=items.filter(x=>x.id!==item.id);if(state.daybyday['2000-01-02']?.routines?.some(r=>r.id===item.id)){state.daybyday[d].skippedRoutines??=[];state.daybyday[d].skippedRoutines.push(item.id);}persist();render();toast('Atividade removida desta data.',()=>{state.daybyday[d].items=snapshot;if(state.daybyday[d].skippedRoutines)state.daybyday[d].skippedRoutines=state.daybyday[d].skippedRoutines.filter(id=>id!==item.id);persist();render();});};tools.append(edit,remove);row.append(label,tools);list.append(row);
 }
 if(view==='daybyday')for(const tools of list.querySelectorAll('.db-tools')){
  const menu=el('details',undefined,'home-item-menu'),summary=el('summary','•••');
  summary.setAttribute('aria-label','Opções da atividade');
  menu.append(summary,...Array.from(tools.children));tools.replaceChildren(menu);
 }
 if(!items.length)list.append(el('p','Nenhuma atividade nesta data. Toque em + Atividade para começar.','smallnote'));daily.append(list);content.append(daily);
 content.append(monthCalendar());
}
function editDaybyday(item){
 const d=key(),dialog=el('dialog',undefined,'db-editor'),form=el('form');
 form.append(el('h3',item?'Editar atividade':'Nova atividade'));
 function field(title,type,value,max){
  const label=el('label',title),input=el('input');
  input.type=type;input.value=value;input.required=true;input.setAttribute('aria-label',title);
  if(max)input.maxLength=max;label.append(input);form.append(label);return input;
 }
 const name=field('Atividade','text',item?.name||'',160);
 const time=field('Horário','time',item?.time||'08:00');
 const details=field('Detalhes (opcional)','text',item?.details||'',500);details.required=false;
 const label=el('label','Categoria'),category=el('select');
 category.setAttribute('aria-label','Categoria');
 for(const [value,title] of Object.entries(daybydayCategories)){const option=el('option',title);option.value=value;category.append(option);}
 category.value=item?.category||'rest';label.append(category);form.append(label);
 const repeatLabel=el('label','Repetir'),repeat=el('select');repeat.setAttribute('aria-label','Repetir');
 for(const [value,title] of [['once','Somente nesta data'],['daily','Todos os dias'],['1','Toda segunda-feira'],['2','Toda terça-feira'],['3','Toda quarta-feira'],['4','Toda quinta-feira'],['5','Toda sexta-feira'],['6','Todo sábado'],['0','Todo domingo']]){
  const option=el('option',title);option.value=value;repeat.append(option);
 }
 repeatLabel.append(repeat);
 if(!item)form.append(repeatLabel);
 form.append(el('p',item?'A edição vale para '+dateLabel(d)+'.':'A rotina começa a partir de '+dateLabel(d)+'. Cada dia terá suas próprias marcações.','smallnote'));
 const actions=el('div',undefined,'actions'),cancel=el('button','Cancelar','secondary'),save=el('button','Salvar atividade','primary'),error=el('p',undefined,'smallnote');
 error.setAttribute('role','status');cancel.type='button';cancel.onclick=()=>dialog.close();save.type='submit';
 actions.append(cancel,save);form.append(error,actions);dialog.append(form);document.body.append(dialog);dialog.onclose=()=>dialog.remove();
 form.onsubmit=event=>{
  event.preventDefault();error.textContent='';
  if(window.RitmoCloud.blocked()){error.textContent='Atualize os registros antes de cadastrar a atividade.';return;}
  if(!name.value.trim()){name.setCustomValidity('Informe o nome da atividade.');name.reportValidity();return;}
  const items=daybydayItems(d);
  if(!item&&items.length>=100){error.textContent='Limite de 100 atividades nesta data.';return;}
  const record={id:item?.id||crypto.randomUUID(),name:name.value.trim(),time:time.value,details:details.value.trim(),category:category.value,done:item?.done||false};
  if(!item&&repeat.value!=='once'){
   const configuration=state.daybyday['2000-01-02']||{items:[],routines:[]};
   if((configuration.routines||[]).length>=50){error.textContent='Limite de 50 rotinas atingido.';return;}
   configuration.routines??=[];
   configuration.routines.push({...record,from:d,repeat:repeat.value});
   state.daybyday['2000-01-02']=configuration;
   daybydayItems(d);
  }else state.daybyday[d].items=item?items.map(x=>x.id===item.id?record:x):[...items,record];
  persist();dialog.close();switchView('daybyday');toast(repeat.value==='once'?'Atividade salva.':'Rotina salva e sincronizando.');
 };
 name.oninput=()=>name.setCustomValidity('');dialog.showModal();
}

// Every new app load starts at Home; navigation remains available afterward.
history.replaceState(null,'','#overview');
if('scrollRestoration' in history)history.scrollRestoration='manual';
render();
if(storageWarning)toast('O armazenamento não está disponível ou um registro não pôde ser lido. Exporte um backup antes de sair.');

function monthCalendar(){
 const card=el('section',undefined,'card db-history'),month=key().slice(0,7),header=el('div',undefined,'title db-monthheading'),buttons=el('div',undefined,'db-actions');
 header.append(el('h3','Seu mês, dia a dia'));
 for(const [offset,text,label] of [[-1,'←','Mês anterior'],[1,'→','Próximo mês']]){const button=el('button',text,'secondary');button.type='button';button.setAttribute('aria-label',label);button.onclick=()=>changeDate(new Date(selected.getFullYear(),selected.getMonth()+offset,1,12));buttons.append(button);}header.append(buttons);card.append(header,el('p',selected.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}),'db-monthname'),el('p','Porcentagem das tarefas do DayByDay concluídas em cada data. Toque no dia para consultar. Um traço indica que nenhuma tarefa foi marcada como concluída.','smallnote'));
 const grid=el('div',undefined,'db-calendar');for(const name of ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'])grid.append(el('span',name,'db-weekday'));
 const first=new Date(selected.getFullYear(),selected.getMonth(),1).getDay(),last=new Date(selected.getFullYear(),selected.getMonth()+1,0).getDate();for(let i=0;i<(first+6)%7;i++){const blank=el('span');blank.setAttribute('aria-hidden','true');grid.append(blank);}
 for(let day=1;day<=last;day++){const date=month+'-'+String(day).padStart(2,'0'),records=state.daybyday[date]?.items,done=records?.filter(x=>x.done).length||0,pct=records?.length?Math.round(done/records.length*100):0,button=el('button',undefined,'db-calday'+(date===key()?' active':''));button.type='button';button.dataset.full=String(pct===100);button.style.setProperty('--day-fill',pct+'%');button.append(el('strong',day),el('small',done?pct+'%':'—'));button.setAttribute('aria-label',dateLabel(date)+(records?' · '+done+' de '+records.length+' tarefas concluídas':' · sem registro'));button.setAttribute('aria-pressed',date===key());button.onclick=()=>{selected=new Date(date+'T12:00:00');switchView(view==='overview'?'overview':'daybyday');};grid.append(button);}
 card.append(grid);return card;
}


window.canRefreshRitmo=()=>!dirty&&!drafts.size&&!document.querySelector('dialog[open]')&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName);
window.renderRitmoFromCloud=()=>render();

function renderHomeLayout(){
 const items=daybydayItems(),done=items.filter(item=>item.done).length;
 $('home-month').textContent=selected.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
 $('home-day').textContent=selected.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
 $('home-percent').textContent=done&&items.length?Math.round(done/items.length*100)+'%':'—';
 const title=document.querySelector('#homechecklist .db-daily>.title h3');
 if(title)title.textContent='Rotina do dia';
 for(const tools of document.querySelectorAll('#homechecklist .db-tools')){
  const menu=el('details',undefined,'home-item-menu'),summary=el('summary','•••');
  summary.setAttribute('aria-label','Opções da atividade');
  menu.append(summary,...Array.from(tools.children));tools.replaceChildren(menu);
 }
 const cloud=$('cloudstatus');
 $('home-online').textContent=cloud.dataset.kind==='saved'?'Salvo online':cloud.dataset.kind==='error'?'Verificar sincronização':'Salvando…';
}

$('home-today').onclick=()=>changeDate(new Date());
new MutationObserver(()=>{if(view==='overview'){$('home-online').textContent=$('cloudstatus').dataset.kind==='saved'?'Salvo online':$('cloudstatus').dataset.kind==='error'?'Verificar sincronização':'Salvando…';}}).observe($('cloudstatus'),{attributes:true,childList:true,subtree:true});
