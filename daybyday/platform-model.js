(function(root){
 'use strict';
 const configDay='2000-01-03';
 const emptyPlan=()=>({workouts:[],mobility:[],meals:[],guide:{}});
 const obj=v=>v&&typeof v==='object'&&!Array.isArray(v),text=(v,n)=>typeof v==='string'&&v.length<=n;
 const keys=(o,list)=>obj(o)&&Object.keys(o).every(k=>list.includes(k));
 const date=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
 const time=t=>typeof t==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(t);
 function validatePlan(p){
  if(!keys(p,['workouts','mobility','meals','guide','foodNotes'])||!Array.isArray(p.workouts)||p.workouts.length>30||!Array.isArray(p.mobility)||p.mobility.length>100||!Array.isArray(p.meals)||p.meals.length>50||!obj(p.guide)||Object.keys(p.guide).length>30)throw Error('Plano pessoal inválido.');
  if(p.foodNotes!==undefined&&!text(p.foodNotes,10000))throw Error('Orientações alimentares inválidas.');
  const ids=new Set();
  for(const w of p.workouts){
   if(!keys(w,['id','title','day','notes','exercises'])||!text(w.id,100)||!w.id||ids.has(w.id)||!text(w.title,160)||!w.title.trim()||!Number.isInteger(w.day)||w.day< -1||w.day>6||!text(w.notes,2000)||!Array.isArray(w.exercises)||w.exercises.length>100)throw Error('Treino inválido.');ids.add(w.id);
   for(const e of w.exercises){if(!keys(e,['id','name','tempo','rest','note','options','sets','timed'])||!text(e.id,100)||!e.id||ids.has(e.id)||!text(e.name,160)||!e.name.trim()||!text(e.tempo,100)||!text(e.rest,100)||!text(e.note,2000)||!Array.isArray(e.options)||e.options.length>30||e.options.some(x=>!text(x,80))||!Array.isArray(e.sets)||!e.sets.length||e.sets.length>20||e.sets.some(x=>!text(x,160))||typeof e.timed!=='boolean')throw Error('Exercício inválido.');ids.add(e.id);}
  }
  for(const m of p.mobility)if(!Array.isArray(m)||m.length!==2||m.some(x=>!text(x,1000))||!m[0].trim())throw Error('Movimento inválido.');
  for(const m of p.meals)if(!keys(m,['title','time','ingredients','substitutions'])||!text(m.title,160)||!m.title.trim()||(m.time!==''&&!time(m.time))||!text(m.ingredients,10000)||!Array.isArray(m.substitutions)||m.substitutions.length>30||m.substitutions.some(x=>!text(x,2000)))throw Error('Refeição inválida.');
  for(const [k,v] of Object.entries(p.guide))if(!text(k,160)||!text(v,2000))throw Error('Guia inválido.');
  return p;
 }
 function validateDaily(p){
  if(!keys(p,['agenda','water','mobility','mealchoices','selection','sessions','notes','trainingTime'])||!Array.isArray(p.agenda)||p.agenda.length>500||!Number.isInteger(p.water)||p.water<0||p.water>1000||!Array.isArray(p.mobility)||p.mobility.length>100||p.mobility.some(x=>typeof x!=='boolean')||!Array.isArray(p.mealchoices)||p.mealchoices.length>50||p.mealchoices.some(x=>![0,1].includes(x))||!text(p.selection,100)||!text(p.notes,2000)||!time(p.trainingTime)||!Array.isArray(p.sessions)||p.sessions.length>500)throw Error('Registros do dia inválidos.');
  const ids=new Set();for(const e of p.agenda){if(!obj(e)||!text(e.id,100)||!e.id||ids.has(e.id)||!text(e.name,160)||!text(e.details,500)||!time(e.time)||!['meal','habit','workout'].includes(e.type)||typeof e.done!=='boolean')throw Error('Agenda inválida.');ids.add(e.id);}
  const exercises=new Set();for(const s of p.sessions){if(!obj(s)||!date(s.date)||!text(s.exercise,100)||!s.exercise||exercises.has(s.exercise)||!text(s.variant,80)||!text(s.basis,80)||!text(s.notes,500)||!Array.isArray(s.rows)||!s.rows.length||s.rows.length>20)throw Error('Séries inválidas.');exercises.add(s.exercise);let complete=false;for(const row of s.rows){if(!keys(row,['kg','reps'])||(row.kg!==null&&(!Number.isFinite(row.kg)||row.kg<0||row.kg>2000))||(row.reps!==null&&(!Number.isFinite(row.reps)||row.reps<=0||row.reps>7200))||(row.kg!==null&&row.reps===null))throw Error('Carga ou repetições inválidas.');if(row.reps!==null)complete=true;}if(!complete)throw Error('Preencha ao menos uma série.');}
  return p;
 }
 function daily(p={}){return structuredClone(p.platform||{agenda:[],water:p.wellness?.water||0,mobility:[],mealchoices:[],selection:'',sessions:[],notes:p.wellness?.notes||'',trainingTime:'19:30'});}
 function routine(p){return Object.fromEntries(['items','monthly','routines','skippedRoutines'].filter(k=>p[k]!==undefined).map(k=>[k,structuredClone(p[k])]));}
 function toState(rows){const s={agenda:{},water:{},mobility:{},mealchoices:{},selections:{},notes:{},daybyday:{},foodPlans:{},trainingTime:'19:30',sessions:[]};for(const {day,payload:p} of rows){const v=daily(p);s.agenda[day]=v.agenda;s.water[day]=v.water;s.mobility[day]=v.mobility;s.mealchoices[day]=v.mealchoices;s.selections[day]=v.selection;s.notes[day]=v.notes;s.daybyday[day]=routine(p);s.sessions.push(...v.sessions);s.trainingTime=v.trainingTime;if(p.finance)s.finance=structuredClone(p.finance);}return s;}
 function collect(backup,original){const s=backup.state;const days=new Set([...Object.keys(s.agenda),...Object.keys(s.water),...Object.keys(s.mobility),...Object.keys(s.mealchoices),...Object.keys(s.selections),...Object.keys(s.notes||{}),...Object.keys(s.daybyday||{}),...backup.sessions.map(x=>x.date),...(s.finance?['2000-01-01']:[])]),out={};for(const day of days){out[day]={...structuredClone(original[day]||{}),...structuredClone(s.daybyday?.[day]||{}),platform:{agenda:(s.agenda[day]||[]).map(x=>({...x,id:String(x.id),done:!!x.done})),water:s.water[day]||0,mobility:s.mobility[day]||[],mealchoices:s.mealchoices[day]||[],selection:s.selections[day]||'',sessions:backup.sessions.filter(x=>x.date===day),notes:s.notes?.[day]||'',trainingTime:s.trainingTime||'19:30'}};if(!original[day]?.platform&&JSON.stringify(out[day].platform)===JSON.stringify(daily(original[day])))delete out[day].platform;if(day==='2000-01-01'&&s.finance)out[day].finance=structuredClone(s.finance);}return out;}
 const api={configDay,emptyPlan,validatePlan,validateDaily,daily,routine,toState,collect};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.DaybydayModel=api;
})(typeof window==='object'?window:globalThis);
