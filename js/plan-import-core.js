(function(root){
 'use strict';
 const titles=['Café da manhã','Almoço','Lanche da tarde','Jantar'];
 const clean=s=>String(s||'').normalize('NFKC').replace(/\r/g,'').trim();
 const plain=s=>clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const field=(s,n)=>typeof s==='string'&&s.length<=n;
 const time=s=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
 function joinItems(items){let text='',previous;for(const item of items){const gap=previous&&Number.isFinite(previous.width)?item.x-previous.x-previous.width:Infinity;text+=(text&&gap>1?' ':'')+item.text;previous=item;}return clean(text);}
 function groupOf(title){const s=plain(title);return ['cafe da manha','almoco','lanche da tarde','jantar'].findIndex(x=>s.startsWith(x));}
 function parseDiet(pages){
  const meals=[];let current=null;
  const all=pages.map(p=>p.text).join('\n'),prescribed=all.match(/Prescrito em:\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1]||'';
  for(const page of pages)for(const raw of clean(page.text).split('\n')){
   const line=raw.replace(/\t/g,' ').trim();if(!line)continue;
   if(/^(Café da manhã|Almoço|Lanche da tarde|Jantar)(\s*\([^\n]*\))?$/i.test(line)){
    current={title:line,group:groupOf(line),time:'',ingredients:'',substitutions:[],page:page.number};meals.push(current);continue;
   }
   if(!current||/Acesse o app|Página\s*\d+\s*\/|Prescrito em:|^Doutora?\b|^Planejamento alimentar|^--\s*\d+\s*of\s*\d+/i.test(line))continue;
   if(/^[•●]\s*Opções de substituição/.test(line))current.substitutions.push(line.replace(/^[•●]\s*/,''));
   else if(current.substitutions.length)current.substitutions[current.substitutions.length-1]+=' '+line;
   else current.ingredients+=(current.ingredients?'\n':'')+line;
  }
  if(!meals.length)throw Error('Não reconheci as refeições deste formato. Cole o texto com títulos como Café da manhã, Almoço, Lanche da tarde e Jantar.');
  return {kind:'diet',prescribed,meals};
 }
 function weekday(title){const s=plain(title);return ['domingo','segunda','terca','quarta','quinta','sexta','sabado'].findIndex(x=>s.includes(x));}
 function parseTraining(pages){
  const workouts=[];let workout=null,pendingName='',guide='',captureGuide=false;
  for(const page of pages){
   let columns=null,current=null,lastY=null;
   for(const line of page.lines||page.text.split('\n').map(text=>({text,items:[]}))){
    const text=clean(line.text);if(!text)continue;
    if(/^TREINO.*\bOFF\b/i.test(text)&&workout){workout.notes+='\n\n'+text;continue;}
    if(/^TREINO\s+[\w\d]+\s*[-–—:]/i.test(text)){
     workout={title:text,day:weekday(text),notes:'',exercises:[]};workouts.push(workout);current=null;pendingName='';continue;
    }
    if(!workout){if(/^GUIA DE S[EÉ]RIES/i.test(text))captureGuide=true;if(captureGuide)guide+=(guide?'\n':'')+text;continue;}
    if(/EXERC[IÍ]CIO/.test(text)&&/S[EÉ]RIE/.test(text)){
     const items=line.items||[],series=items.find(i=>/S[EÉ]RIE/.test(i.text)),tempo=items.find(i=>/RITMO/.test(i.text)),rest=items.find(i=>/DESCANSO/.test(i.text));
     if(series&&tempo&&rest){const positions=(page.lines||[]).flatMap(l=>l.items||[]).filter(i=>/^\d+\s*[xX×]\s*\S/.test(i.text)).map(i=>i.x);columns={sets:(positions.length?Math.min(...positions):series.x-36)-3,tempo:tempo.x-12,rest:rest.x-25};}continue;
    }
    if(/^CARDIO|BI\s*[- ]?\s*SET|EXERC[IÍ]CIOS\s+EM\s+VER/i.test(text)){workout.notes+=(workout.notes?'\n':'')+text;continue;}
    if(columns&&line.items?.length){
     const cell=(from,to)=>joinItems(line.items.filter(i=>i.x>=from&&i.x<to));
     const name=cell(-Infinity,columns.sets),sets=cell(columns.sets,columns.tempo),tempo=cell(columns.tempo,columns.rest),rest=cell(columns.rest,Infinity);
     if(name&&/^\d+\s*[xX×]\s*\S/.test(sets)&&(!current||lastY===null||lastY-line.y>18)){
      current={name:(pendingName?pendingName+' ':'')+name,sets:[],tempo:'',rest:'',note:'',timed:false};pendingName='';workout.exercises.push(current);
     }else if(name){
      if(current)current.name+=' '+name;
      else pendingName+=(pendingName?' ':'')+name;
     }
     if(current){
      const match=sets.match(/^(\d{1,2})\s*[xX×]\s*(.+)$/);
      if(match){const n=Number(match[1]);if(n<1||n>20)throw Error('Quantidade de séries fora do limite. Confira o PDF.');for(let i=0;i<n;i++)current.sets.push(match[2]);}
      else if(sets)current.note+=(current.note?' ':'')+sets;
      if(tempo)current.tempo+=(current.tempo?' ':'')+tempo;if(rest)current.rest+=(current.rest?' ':'')+rest;
      current.timed=/prancha/i.test(current.name)||current.sets.every(s=>/^\d+(?:\s*(?:a|-)\s*\d+)?\s*(?:''|’’|”|seg\b|min\b)/i.test(s));
     }
     lastY=line.y;
    }else{
     const match=text.match(/^(.+?)\s+(\d{1,2})\s*[xX×]\s*(.+)$/);
     if(match){current={name:match[1],sets:Array(Number(match[2])).fill(match[3]),tempo:'',rest:'',note:'',timed:/prancha|segundo/i.test(match[1])};workout.exercises.push(current);}
     else if(current&&/^\d{1,2}\s*[xX×]/.test(text)){const m=text.match(/^(\d+)\s*[xX×]\s*(.+)$/);current.sets.push(...Array(Number(m[1])).fill(m[2]));}
    }
   }
  }
  if(!workouts.length||workouts.some(w=>!w.exercises.length))throw Error('Não reconheci exercícios com séries neste formato. Use títulos como Treino A - Segunda e linhas como Agachamento 3 x 10 a 12.');
  return {kind:'training',workouts,guide};
 }
 function validate(draft,app){
  if(!draft||!['diet','training'].includes(draft.kind))throw Error('Tipo de plano inválido.');
  if(draft.kind==='diet'){
   if(!Array.isArray(draft.meals)||!draft.meals.length||draft.meals.length>30||!field(draft.prescribed,30))throw Error('Refeições inválidas.');
   for(const m of draft.meals)if(!field(m.title,160)||!m.title.trim()||!Number.isInteger(m.group)||m.group<0||m.group>3||!time(m.time)||!field(m.ingredients,10000)||!m.ingredients.trim()||!Array.isArray(m.substitutions)||m.substitutions.length>30||m.substitutions.some(s=>!field(s,2000)))throw Error('Confira o nome, horário, porções e substituições de todas as refeições.');
   for(let g=0;g<4;g++)if(new Set(draft.meals.filter(m=>m.group===g).map(m=>m.time)).size>1)throw Error('Use o mesmo horário nas opções da mesma refeição.');
   if(app==='ritmo'&&[0,1,2,3].some((g)=>draft.meals.filter(m=>m.group===g).length!==[2,2,1,2][g]))throw Error('No Ritmo, use o modelo de quatro refeições com 2 opções de café, 2 de almoço, 1 lanche e 2 de jantar. Confira o grupo de cada opção.');
  }else{
   if(draft.guide!==undefined&&!field(draft.guide,2000))throw Error('Reduza as orientações gerais para até 2000 caracteres.');
   if(!Array.isArray(draft.workouts)||!draft.workouts.length||draft.workouts.length>10)throw Error('Importe de 1 a 10 treinos.');
   for(const w of draft.workouts){
    if(!field(w.title,160)||!w.title.trim()||!Number.isInteger(w.day)||w.day<0||w.day>6||!field(w.notes,2000)||!Array.isArray(w.exercises)||!w.exercises.length||w.exercises.length>50)throw Error('Confira o nome, dia da semana e exercícios de cada treino.');
    for(const e of w.exercises)if(!field(e.name,160)||!e.name.trim()||!Array.isArray(e.sets)||!e.sets.length||e.sets.length>20||e.sets.some(s=>!field(s,160)||!s.trim())||!field(e.tempo,100)||!field(e.rest,100)||!field(e.note,2000)||typeof e.timed!=='boolean')throw Error('Confira exercícios, séries, ritmo, descanso e observações.');
   }
  }
  if(JSON.stringify(draft).length>90000)throw Error('Plano muito grande. Importe um documento menor.');
  return draft;
 }
 function dietFields(draft,previous={}){
  const meals=[],groups=[];
  for(let g=0;g<4;g++){
   const options=[];for(const m of draft.meals.filter(m=>m.group===g)){const index=meals.length;meals.push({title:m.title,time:m.time,ingredients:m.ingredients,substitutions:m.substitutions,page:m.page||1});options.push({index,value:g===3?index+1:index});}
   if(options.length)groups.push({title:titles[g],time:meals[options[0].index].time,slot:g,options});
  }
  return {...previous,format:'four-meals',prescribed:draft.prescribed||'Plano importado',meals,groups};
 }
 function trainingFields(draft,prefix){return draft.workouts.map((w,i)=>({id:prefix+'-w'+i,title:w.title,day:w.day,notes:w.notes,exercises:w.exercises.map((e,j)=>({id:prefix+'-w'+i+'-e'+j,name:e.name,sets:e.sets,tempo:e.tempo,rest:e.rest,note:e.note,options:[],timed:e.timed}))}));}
 function mergeTraining(base,imported){
  if(!imported?.workouts)return base;
  const active=new Set(imported.activeIds||[]),all=[...imported.workouts,...base.workouts];
  return {...base,guide:active.size?{'Plano importado':imported.guide||'Confira as orientações do profissional no documento original.'}:base.guide,workouts:all.map(w=>({...w,archived:active.size?!active.has(w.id):imported.workouts.some(i=>i.id===w.id)})).sort((a,b)=>Number(!!a.archived)-Number(!!b.archived))};
 }
 const api={titles,plain,joinItems,parseDiet,parseTraining,validate,dietFields,trainingFields,mergeTraining};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.PlanImportCore=api;
})(typeof window==='object'?window:globalThis);
