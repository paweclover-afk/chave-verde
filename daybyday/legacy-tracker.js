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
    if(st.daybyday!==undefined){
      if(!object(st.daybyday))throw Error('Histórico DayByDay inválido.');
      for(const [d,v] of Object.entries(st.daybyday)){if(!validDate(d)||v?.monthly!==undefined&&!d.endsWith('-01'))throw Error('Data DayByDay inválida.');validateDaybyday(v);}
    }
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
  function validateDaybyday(v){
    if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!['items','monthly','finance','wellness'].includes(k)))throw Error('DayByDay inválido.');
    if(v.items!==undefined){
      if(!Array.isArray(v.items)||v.items.length>100)throw Error('Lista DayByDay inválida.');
      const ids=new Set();
      for(const x of v.items){
        if(!x||typeof x!=='object'||typeof x.id!=='string'||!x.id||x.id.length>100||ids.has(x.id)||typeof x.name!=='string'||!x.name.trim()||x.name.length>160||typeof x.details!=='string'||x.details.length>500||!/^([01]\d|2[0-3]):[0-5]\d$/.test(x.time)||typeof x.done!=='boolean'||!['rest','health','study','work','self','english','pt','cook'].includes(x.category))throw Error('Atividade DayByDay inválida.');
        ids.add(x.id);
      }
    }
    if(v.wellness!==undefined){
      const w=v.wellness, text=(x,n)=>typeof x==='string'&&x.length<=n;
      if(!w||typeof w!=='object'||Array.isArray(w)||Object.keys(w).some(k=>!['training','meals','mobility','notes','water'].includes(k))||!text(w.notes,2000)||!Number.isInteger(w.water)||w.water<0||w.water>1000)throw Error('Registro de saúde inválido.');
      for(const kind of ['training','meals','mobility']){
        if(!Array.isArray(w[kind])||w[kind].length>100)throw Error('Lista de saúde inválida.');
        const ids=new Set();
        for(const x of w[kind]){
          if(!x||typeof x!=='object'||!text(x.id,100)||!x.id||ids.has(x.id)||!text(x.name,160)||!x.name.trim()||!text(x.details,1000)||typeof x.done!=='boolean'||Object.keys(x).some(k=>!['id','name','details','done','sets'].includes(k)))throw Error('Atividade de saúde inválida.');
          ids.add(x.id);
          if(kind==='training'){
            if(!Array.isArray(x.sets)||x.sets.length>20)throw Error('Séries inválidas.');
            for(const row of x.sets)if(!row||!Number.isFinite(row.kg)||row.kg<0||row.kg>2000||!Number.isInteger(row.reps)||row.reps<1||row.reps>1000)throw Error('Carga ou repetições inválidas.');
          }else if(x.sets!==undefined)throw Error('Séries fora do treino.');
        }
      }
    }
    if(v.finance!==undefined)validateFinance(v.finance);
    if(v.monthly!==undefined&&(!Array.isArray(v.monthly)||v.monthly.length!==12||v.monthly.some(x=>typeof x!=='boolean')))throw Error('Checklist mensal inválido.');
    return v;
  }
  const financeDay='2000-01-01';
  const expenseCategories=['Supermercado','Lazer','Suplementos','Transporte','Moradia','Outros'];
  const financeCurrencies=['BRL','EUR','GBP'];
  const validFinanceDate=date=>typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&dateKey(new Date(date+'T12:00:00'))===date;
  const validAmount=n=>Number.isSafeInteger(n)&&n>0&&n<=99999999999;
  const paidAmount=debt=>debt.payments.reduce((sum,p)=>sum+p.amount,0);
  function fridayOnOrAfter(day){
    const date=new Date(day+'T12:00:00');
    date.setDate(date.getDate()+(5-date.getDay()+7)%7);
    return dateKey(date);
  }
  function debtDue(debt, projectedPayment=0){
    const paid=paidAmount(debt)+projectedPayment,balance=debt.amount-paid;
    const schedulePaid=Math.max(0,paid-(debt.scheduleBase||0));
    if(balance<=0)return null;
    const completed=debt.frequency==='once'?0:Math.floor(schedulePaid/debt.installment);
    const date=new Date(debt.firstDue+'T12:00:00');
    if(debt.frequency==='week')date.setDate(date.getDate()+7*debt.interval*completed);
    if(debt.frequency==='month'){
      const originalDay=date.getDate();
      date.setDate(1);date.setMonth(date.getMonth()+debt.interval*completed);
      const lastDay=new Date(date.getFullYear(),date.getMonth()+1,0).getDate();
      date.setDate(Math.min(originalDay,lastDay));
    }
    const nominalDay=dateKey(date);
    return {day:fridayOnOrAfter(nominalDay),nominalDay,balance,due:debt.frequency==='once'?balance:Math.min(balance,debt.installment-schedulePaid%debt.installment)};
  }
  function validateFinance(ledger){
    const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
    const text=(v,max)=>typeof v==='string'&&v.trim()&&v.length<=max;
    if(!object(ledger)||!Array.isArray(ledger.debts)||!Array.isArray(ledger.expenses)||ledger.debts.length>100||ledger.expenses.length>800)throw Error('Registros financeiros inválidos ou acima do limite.');
    const ids=new Set();
    function unique(v){if(!object(v)||!text(v.id,100)||ids.has(v.id))return false;ids.add(v.id);return true;}
    for(const d of ledger.debts){
      if(!unique(d)||!text(d.name,100)||!financeCurrencies.includes(d.currency)||!['debt','consortium'].includes(d.kind)||!validAmount(d.amount)||!validFinanceDate(d.firstDue)||!['once','week','month'].includes(d.frequency)||!Number.isInteger(d.interval)||d.interval<1||d.interval>52||!validAmount(d.installment)||d.installment>d.amount||!Array.isArray(d.payments)||d.payments.length>500)throw Error('Dívida ou consórcio inválido.');
      for(const p of d.payments)if(!unique(p)||!validAmount(p.amount)||!validFinanceDate(p.date))throw Error('Pagamento inválido.');
      if(d.scheduleBase!==undefined&&(!Number.isSafeInteger(d.scheduleBase)||d.scheduleBase<0||d.scheduleBase>paidAmount(d)))throw Error('Histórico do acordo inválido.');
      if(paidAmount(d)>d.amount)throw Error('Os pagamentos ultrapassam o saldo da dívida.');
    }
    for(const x of ledger.expenses)if(!unique(x)||!text(x.name,160)||!financeCurrencies.includes(x.currency)||!expenseCategories.includes(x.category)||!validAmount(x.amount)||!validFinanceDate(x.date))throw Error('Despesa inválida.');
    return ledger;
  }
  const api={dateKey,number,normalize,summary,context,previous,validateBackup,validateDaybyday,financeDay,expenseCategories,financeCurrencies,validateFinance,paidAmount,debtDue,fridayOnOrAfter};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LegacyDaybydayTracker=api;
})(typeof window!=='undefined'?window:globalThis);
