(function(root){
  'use strict';
  const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  function number(value,max,integer=false){
    if(value===''||value===null||value===undefined)return null;
    const n=Number(String(value).replace(',','.'));
    if(!Number.isFinite(n)||n<0||n>max||(integer&&!Number.isInteger(n)))throw Error('Confira os valores: use números positivos dentro do limite do campo.');
    return n;
  }
  function normalize(rows,timed=false){
    let any=false;
    const result=rows.map(row=>{
      const kg=number(row.kg,2000),reps=number(row.reps,timed?7200:1000,!timed);
      if(kg!==null&&reps===null)throw Error(timed?'Informe os segundos da série com carga.':'Informe as repetições da série com carga.');
      if(reps!==null&&reps<=0)throw Error('Repetições ou segundos devem ser maiores que zero.');
      if(reps!==null){any=true;return {kg,reps};}
      return {kg:null,reps:null};
    });
    if(!any)throw Error('Preencha ao menos uma série com repetições ou segundos realizados.');
    return result;
  }
  function summary(session){
    const completed=session.rows.filter(r=>r.reps!==null);
    const loaded=completed.filter(r=>r.kg!==null);
    return {sets:completed.length,max:loaded.length?Math.max(...loaded.map(r=>r.kg)):null,reps:completed.reduce((a,r)=>a+r.reps,0),volume:loaded.reduce((a,r)=>a+r.kg*r.reps,0)};
  }
  const context=s=>`${s.variant}|||${s.basis}`;
  function previous(sessions,exercise,date,variant,basis){return sessions.filter(s=>s.exercise===exercise&&s.date<date&&s.variant===variant&&s.basis===basis).sort((a,b)=>b.date.localeCompare(a.date))[0]||null;}
  function validateBackup(data,plan){
    if(!data||data.app!=='ritmo-leonarda'||data.version!==2||!Array.isArray(data.sessions)||!data.state||typeof data.state!=='object'||Array.isArray(data.state)||!data.legacy||typeof data.legacy!=='object')throw Error('Este arquivo não é um backup válido do Ritmo.');
    const exercises=new Map(plan.workouts.flatMap(w=>w.exercises.map(e=>[e.id,e]))),seen=new Set();
    const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d+'T12:00:00'))&&dateKey(new Date(d+'T12:00:00'))===d;
    const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
    const text=(v,n)=>typeof v==='string'&&v.length<=n;
    if(data.sessions.length>50000)throw Error('Backup muito grande.');
    for(const s of data.sessions){
      const e=exercises.get(s.exercise),id=s.date+'|'+s.exercise;
      if(!e||!validDate(s.date)||seen.has(id)||!text(s.variant,80)||!text(s.basis,80)||!text(s.notes,500)||!Array.isArray(s.rows)||s.rows.length!==e.sets.length)throw Error('Histórico inválido no backup.');
      normalize(s.rows,e.timed);seen.add(id);
    }
    const st=data.state;
    if(!object(st.agenda)||!object(st.mobility)||!object(st.mealchoices)||!object(st.water)||!object(st.selections)||!text(st.trainingTime,5)||!/^\d{2}:\d{2}$/.test(st.trainingTime))throw Error('Agenda inválida no backup.');
    for(const [d,events] of Object.entries(st.agenda)){
      if(!validDate(d)||!Array.isArray(events)||events.length>500)throw Error('Agenda inválida.');
      for(const ev of events)if(!object(ev)||!text(ev.id,100)||!text(ev.name,160)||!text(ev.details,500)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(ev.time)||!['meal','workout','habit'].includes(ev.type))throw Error('Atividade inválida no backup.');
    }
    for(const [d,v] of Object.entries(st.water))if(!validDate(d)||!Number.isInteger(v)||v<0||v>1000)throw Error('Água inválida no backup.');
    for(const [d,v] of Object.entries(st.mobility))if(!validDate(d)||!Array.isArray(v)||v.some(x=>typeof x!=='boolean'))throw Error('Mobilidade inválida.');
    for(const [d,v] of Object.entries(st.mealchoices))if(!validDate(d)||!Array.isArray(v)||v.some(x=>!Number.isInteger(x)||x<0||x>7))throw Error('Refeição inválida.');
    for(const [d,v] of Object.entries(st.selections))if(!validDate(d)||!['off',...plan.workouts.map(w=>w.id)].includes(v))throw Error('Treino inválido.');
    if(data.legacy.days!==undefined&&!object(data.legacy.days))throw Error('Registros anteriores inválidos.');
    return data;
  }
  const api={dateKey,number,normalize,summary,context,previous,validateBackup};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Tracker=api;
})(typeof window!=='undefined'?window:globalThis);
