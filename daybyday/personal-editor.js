'use strict';
function appendPlanButton(container,kind){const button=el('button',{training:'Cadastrar ou editar meu treino',meals:'Cadastrar ou editar minhas refeições',mobility:'Cadastrar ou editar minha sequência'}[kind],'secondary');button.type='button';button.onclick=()=>openPersonalPlan(kind);container.append(button);if(kind==='training'){const label=el('label','Importar meu plano organizado','importlabel'),file=el('input');file.type='file';file.accept='application/json';file.id='personal-plan-import';file.style.display='none';label.append(file);file.onchange=async()=>{const selected=file.files[0];if(!selected)return;try{if(dirty)throw Error('Salve suas séries antes de importar.');if(selected.size>150000)throw Error('Use um arquivo de até 150 KB.');const next=JSON.parse(await selected.text());DaybydayModel.validatePlan(next);const merged=structuredClone(P);for(const workout of next.workouts){const i=merged.workouts.findIndex(w=>w.id===workout.id);if(i<0)merged.workouts.push(workout);else merged.workouts[i]=workout;}merged.meals=next.meals;merged.guide={...merged.guide,...next.guide};if(next.mobility.length)merged.mobility=next.mobility;if(next.foodNotes!==undefined)merged.foodNotes=next.foodNotes;DaybydayModel.validatePlan(merged);await window.RitmoCloud.savePlan(merged);}catch(e){toast(e.message);}finally{file.value='';}};container.append(label);}}
function openPersonalPlan(kind){
 if(dirty){toast('Salve suas séries antes de editar o plano.');return;}
 const dialog=el('dialog',undefined,'personal-plan-editor'),form=el('form'),error=el('p');error.setAttribute('role','status');dialog.append(el('h2',{training:'Meu treino',meals:'Minhas refeições',mobility:'Minha mobilidade'}[kind]));
 const choose=el('select');choose.setAttribute('aria-label','Registro para editar');const fresh=el('option','Novo registro');fresh.value='';choose.append(fresh);
 const entries=kind==='training'?P.workouts.flatMap(w=>w.exercises.map(e=>({id:e.id,title:w.title+' · '+e.name}))):kind==='meals'?P.meals.map((m,i)=>({id:String(i),title:m.title})):P.mobility.map((m,i)=>({id:String(i),title:m[0]}));
 for(const entry of entries){const option=el('option',entry.title);option.value=entry.id;choose.append(option);}const label=el('label','Adicionar ou editar');label.append(choose);dialog.append(label,form,error);
 function field(title,type='text',value='',max=160){const label=el('label',title),input=el(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type;input.maxLength=max;input.value=value;label.append(input);form.append(label);return input;}
 function select(title,options,value){const label=el('label',title),input=el('select');for(const [id,text]of options){const option=el('option',text);option.value=id;input.append(option);}input.value=value;label.append(input);form.append(label);return input;}
 function renderEditor(){
  form.replaceChildren();error.textContent='';const plan=structuredClone(P),index=choose.value;
  let build;
  if(kind==='training'){
   const current=plan.workouts.find(w=>w.exercises.some(e=>e.id===index)),exercise=current?.exercises.find(e=>e.id===index);
   const workout=select('Treino',[['','Criar novo treino'],...plan.workouts.map(w=>[w.id,w.title])],current?.id||'');
   const title=field('Nome do treino', 'text',current?.title||''),day=select('Dia da semana',[['-1','Sem dia fixo'],...['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'].map((x,i)=>[String(i),x])],String(current?.day??new Date().getDay()));
   const notes=field('Orientações do treino','textarea',current?.notes||'',2000);title.required=true;
   workout.onchange=()=>{const found=plan.workouts.find(w=>w.id===workout.value);title.value=found?.title||'';day.value=String(found?.day??new Date().getDay());notes.value=found?.notes||'';};
   const name=field('Nome do exercício','text',exercise?.name||''),sets=field('Séries: uma orientação por linha','textarea',exercise?.sets.join('\n')||'',3400),tempo=field('Ritmo / execução','text',exercise?.tempo||'',100),rest=field('Descanso','text',exercise?.rest||'',100),note=field('Observações do exercício','textarea',exercise?.note||'',2000),options=field('Equipamentos / variações: um por linha','textarea',exercise?.options.join('\n')||'',2400),timed=select('Medida',['Repetições','Segundos'].map((x,i)=>[String(i),x]),exercise?.timed?'1':'0');name.required=sets.required=true;
   build=()=>{let target=plan.workouts.find(w=>w.id===workout.value);if(!target){target={id:'w-'+crypto.randomUUID(),title:'',day:0,notes:'',exercises:[]};plan.workouts.push(target);}target.title=title.value.trim();target.day=Number(day.value);target.notes=notes.value;const record={id:exercise?.id||'e-'+crypto.randomUUID(),name:name.value.trim(),sets:sets.value.split('\n').map(x=>x.trim()).filter(Boolean),tempo:tempo.value,rest:rest.value,note:note.value,options:options.value.split('\n').map(x=>x.trim()).filter(Boolean),timed:timed.value==='1'};if(current)current.exercises=current.exercises.filter(e=>e.id!==record.id);target.exercises.push(record);return plan;};
  }else if(kind==='meals'){
   const existing=index!==''?plan.meals[Number(index)]:null;const title=field('Nome da refeição','text',existing?.title||''),time=field('Horário','time',existing?.time||'12:00'),ingredients=field('Alimentos, porções e orientações','textarea',existing?.ingredients||'',10000),substitutions=field('Substituições: uma alternativa por linha','textarea',existing?.substitutions.join('\n')||'',20000);title.required=true;time.required=false;
   build=()=>{const record={title:title.value.trim(),time:time.value,ingredients:ingredients.value,substitutions:substitutions.value.split('\n').map(x=>x.trim()).filter(Boolean)};if(index==='')plan.meals.push(record);else plan.meals[Number(index)]=record;return plan;};
  }else{
   const existing=index!==''?plan.mobility[Number(index)]:null,name=field('Nome do movimento','text',existing?.[0]||'',1000),details=field('Repetições, duração e orientações','textarea',existing?.[1]||'',1000);name.required=true;build=()=>{const record=[name.value.trim(),details.value];if(index==='')plan.mobility.push(record);else plan.mobility[Number(index)]=record;return plan;};
  }
  const save=el('button','Salvar meu plano','primary'),cancel=el('button','Cancelar','secondary');save.type='submit';cancel.type='button';cancel.onclick=()=>dialog.close();form.append(save,cancel);
  form.onsubmit=async e=>{e.preventDefault();save.disabled=true;error.textContent='Salvando…';try{const next=build();DaybydayModel.validatePlan(next);await window.RitmoCloud.savePlan(next);}catch(e){error.textContent=e.message;save.disabled=false;}};
 }
 choose.onchange=renderEditor;renderEditor();dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();
}
function renderPreviousRecords(container,day){
 const old=window.RitmoCloud.originalDays()[day]?.wellness;if(!old)return;
 const details=el('details');details.append(el('summary','Registros da versão anterior'));
 for(const [kind,title]of [['training','Treino'],['meals','Alimentação'],['mobility','Mobilidade']])for(const item of old[kind]||[]){details.append(el('p',title+' · '+item.name+(item.done?' · concluído':'')),el('p',item.details));if(item.sets?.length)details.append(el('p',item.sets.map((s,i)=>'Série '+(i+1)+': '+s.kg+' kg × '+s.reps).join(' · ')));}
 if(old.notes)details.append(el('p',old.notes));container.append(details);
}
