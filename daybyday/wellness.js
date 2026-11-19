'use strict';
let wellnessTab='training';
function wellnessDay(){return state[key()]?.wellness||{training:[],meals:[],mobility:[],notes:'',water:0};}
function changeWellness(change){
 if(blocked){toast('Baixe seu backup e recarregue para resolver o conflito antes de editar.');return;}
 try{const next=structuredClone(wellnessDay());change(next);const record={...state[key()],wellness:next};T.validateDaybyday(record);if(new TextEncoder().encode(JSON.stringify(record)).length>145000)throw Error('Limite do dia atingido. Baixe um backup.');state[key()]=record;persist();renderWellness();}catch(e){toast(e.message);}
}
function wellnessField(form,title,type='text',max=160){const label=el('label',title),input=el(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type;input.maxLength=max;label.append(input);form.append(label);return input;}
function renderWellness(){
 const root=$('wellness-section');if(!root)return;root.replaceChildren(el('h2','Meus cuidados'));
 const tabs=el('div',undefined,'wellness-tabs');const names={training:'Treino',meals:'Alimentação',mobility:'Mobilidade',diary:'Diário',history:'Histórico'};
 for(const [id,name] of Object.entries(names)){const button=el('button',name,'secondary');button.type='button';button.setAttribute('aria-pressed',String(wellnessTab===id));button.onclick=()=>{wellnessTab=id;renderWellness();};tabs.append(button);}root.append(tabs);
 const w=wellnessDay();
 if(wellnessTab==='history'){
  root.append(el('h3','Meus registros por data'));
  const records=Object.entries(state).filter(([,r])=>r.wellness).sort(([a],[b])=>b.localeCompare(a));
  if(!records.length)root.append(el('p','Seu histórico aparecerá quando você salvar seus primeiros registros.','smallnote'));
  for(const [day,r] of records){const box=el('details');box.append(el('summary',dateLabel(day)));for(const kind of ['training','meals','mobility'])for(const item of r.wellness[kind]){box.append(el('p',names[kind]+': '+item.name+(item.done?' · concluído':' · pendente')+(item.details?' · '+item.details:'')));if(item.sets?.length)box.append(el('p',item.sets.map((s,i)=>`Série ${i+1}: ${s.kg} kg × ${s.reps}`).join(' · ')));}if(r.wellness.notes)box.append(el('p',r.wellness.notes));box.append(el('p',r.wellness.water+' copos de água'));const open=el('button','Abrir esta data','secondary');open.onclick=()=>{wellnessTab='diary';changeDate(new Date(day+'T12:00:00'));};box.append(open);root.append(box);}return;
 }
 if(wellnessTab==='diary'){
  const form=el('form');const notes=wellnessField(form,'Minha anotação do dia','textarea',2000);notes.value=w.notes;
  const water=wellnessField(form,'Copos de água','number');water.min=0;water.max=1000;water.step=1;water.required=true;water.value=w.water;
  const save=el('button','Salvar diário','primary');save.type='submit';form.append(save);form.onsubmit=e=>{e.preventDefault();changeWellness(next=>{next.notes=notes.value;next.water=water.valueAsNumber;});};root.append(form);return;
 }
 const kind=wellnessTab;root.append(el('h3',names[kind]+' · '+dateLabel(key())));
 if(!w[kind].length)root.append(el('p','Nenhum registro nesta data. Adicione suas próprias atividades e orientações.','smallnote'));
 for(const item of w[kind]){
  const box=el('div',undefined,'wellness-item'),label=el('label'),check=el('input');check.type='checkbox';check.checked=item.done;check.onchange=()=>changeWellness(next=>{next[kind].find(x=>x.id===item.id).done=check.checked;});label.append(check,document.createTextNode(item.name));box.append(label,el('p',item.details,'smallnote'));
  if(kind==='training'){
   if(item.sets.length)box.append(el('p',item.sets.map((s,i)=>`Série ${i+1}: ${s.kg} kg × ${s.reps}`).join(' · ')));
   const sets=el('form'),kg=wellnessField(sets,'Carga (kg)','number'),reps=wellnessField(sets,'Repetições','number');kg.min=0;kg.max=2000;kg.step='0.01';kg.required=true;reps.min=1;reps.max=1000;reps.step=1;reps.required=true;
   const add=el('button','Registrar série','secondary');add.type='submit';sets.append(add);sets.onsubmit=e=>{e.preventDefault();changeWellness(next=>next.training.find(x=>x.id===item.id).sets.push({kg:kg.valueAsNumber,reps:reps.valueAsNumber}));};box.append(sets);
   if(item.sets.length){const undo=el('button','Remover última série','secondary');undo.onclick=()=>changeWellness(next=>next.training.find(x=>x.id===item.id).sets.pop());box.append(undo);}
  }
  const edit=el('details'),summary=el('summary','Editar registro'),form=el('form'),name=wellnessField(form,'Nome'),details=wellnessField(form,'Detalhes e orientações','textarea',1000);name.required=true;name.value=item.name;details.value=item.details;const save=el('button','Salvar alterações','secondary');save.type='submit';form.append(save);form.onsubmit=e=>{e.preventDefault();changeWellness(next=>{const row=next[kind].find(x=>x.id===item.id);row.name=name.value.trim();row.details=details.value;});};edit.append(summary,form);box.append(edit);
  const remove=el('button','Excluir registro','secondary');remove.onclick=()=>{if(confirm('Excluir este registro de '+dateLabel(key())+'?'))changeWellness(next=>{next[kind]=next[kind].filter(x=>x.id!==item.id);});};box.append(remove);root.append(box);
 }
 const editor=el('details');editor.append(el('summary','Adicionar '+({training:'exercício',meals:'refeição',mobility:'movimento'}[kind])));const form=el('form'),name=wellnessField(form,'Nome'),details=wellnessField(form,'Detalhes e orientações','textarea',1000);name.required=true;
 const save=el('button','Adicionar','primary');save.type='submit';form.append(save);form.onsubmit=e=>{e.preventDefault();changeWellness(next=>next[kind].push({id:crypto.randomUUID(),name:name.value.trim(),details:details.value,done:false,...(kind==='training'?{sets:[]}: {})}));};editor.append(form);root.append(editor);
}
