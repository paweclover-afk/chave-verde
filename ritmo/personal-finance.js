'use strict';
(function(root){
 const dateKey=d=>d.toISOString().slice(0,10);
 const addDays=(day,n)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return dateKey(d);};
 function addMonths(day,n){const d=new Date(day+'T12:00:00Z'),original=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);d.setUTCDate(Math.min(original,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));return dateKey(d);}
 const validDate=s=>typeof s==='string'&&/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s)&&!isNaN(Date.parse(s))&&dateKey(new Date(s+'T12:00:00Z'))===s;
 const amount=n=>Number.isSafeInteger(n)&&n>=0&&n<=99999999999;
 function validate(model){
  if(!model||!Array.isArray(model.entries)||!Array.isArray(model.categories)||!Array.isArray(model.alerts)||model.entries.length>500||model.categories.length>60||model.alerts.length>1000)throw Error('Cadastro financeiro inválido ou limite atingido.');
  if(model.income&&(!amount(model.income.amount)||!['week','month'].includes(model.income.frequency)))throw Error('Renda inválida.');
  const ids=new Set();
  for(const c of model.categories){if(typeof c.id!=='string'||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||c.name.length>80||!/^#[0-9a-f]{6}$/i.test(c.color)||!amount(c.limit))throw Error('Categoria inválida.');ids.add(c.id);}
  ids.clear();
  for(const e of model.entries){
   if(typeof e.id!=='string'||ids.has(e.id)||typeof e.name!=='string'||!e.name.trim()||e.name.length>160||!amount(e.amount)||e.amount===0||!validDate(e.start)||!['once','week','month'].includes(e.frequency)||!Number.isInteger(e.interval)||e.interval<1||e.interval>120||!Number.isInteger(e.count)||e.count<0||e.count>1200||e.end!==undefined&&(!validDate(e.end)||e.end<e.start)||!model.categories.some(c=>c.id===e.category)||!e.overrides||typeof e.overrides!=='object'||Array.isArray(e.overrides))throw Error('Gasto inválido.');
   ids.add(e.id);
   for(const [day,v] of Object.entries(e.overrides)){
    if(!validDate(day)||!v||typeof v!=='object'||v.amount!==undefined&&(!amount(v.amount)||v.amount===0)||v.paid!==undefined&&typeof v.paid!=='boolean'||v.deleted!==undefined&&typeof v.deleted!=='boolean')throw Error('Correção de cobrança inválida.');
   }
  }
  if(model.alerts.some(x=>typeof x!=='string'||x.length>180))throw Error('Histórico de alertas inválido.');
 }
 function occurrences(entries,from,to){
  const rows=[];
  for(const entry of entries){
   for(let index=0;index<(entry.count||1200);index++){
    const day=entry.frequency==='month'?addMonths(entry.start,index*entry.interval):entry.frequency==='week'?addDays(entry.start,index*7*entry.interval):entry.start;
    if(day>to||entry.end&&day>entry.end)break;
    const change=entry.overrides[day]||{};
    if(day>=from&&!change.deleted)rows.push({...entry,...change,source:entry,day,index,amount:change.amount??entry.amount,paid:change.paid??entry.frequency==='once'});
    if(entry.frequency==='once')break;
   }
  }
  return rows.sort((a,b)=>a.day.localeCompare(b.day)||a.name.localeCompare(b.name));
 }
 function period(mode,anchor){
  if(mode==='month'){const start=anchor.slice(0,7)+'-01';return {from:start,to:addDays(addMonths(start,1),-1)};}
  const d=new Date(anchor+'T12:00:00Z');return {from:addDays(anchor,-(d.getUTCDay()+6)%7),to:addDays(anchor,6-(d.getUTCDay()+6)%7)};
 }
 function income(income,mode){if(!income)return 0;if(income.frequency===mode)return income.amount;return Math.round(income.amount*(mode==='month'?52/12:12/52));}
 function summary(model,mode,anchor){
  const range=period(mode,anchor),rows=occurrences(model.entries,range.from,range.to);
  const spent=rows.filter(r=>r.frequency==='once').reduce((s,r)=>s+r.amount,0),fixed=rows.filter(r=>r.frequency!=='once').reduce((s,r)=>s+r.amount,0),paid=rows.filter(r=>r.paid).reduce((s,r)=>s+r.amount,0),revenue=income(model.income,mode);
  return {...range,rows,spent,fixed,paid,income:revenue,total:spent+fixed,balance:revenue-spent-fixed};
 }
 function weeklyReserve(model,anchor){
  const month=period('month',anchor);
  const bills=occurrences(model.entries,month.from,month.to).filter(row=>row.frequency==='month');
  return {bills:bills.map(row=>({name:row.name,day:row.day,monthly:row.amount,weekly:Math.ceil(row.amount*12/52)})),weekly:bills.reduce((sum,row)=>sum+Math.ceil(row.amount*12/52),0)};
 }
 function weeklyPlan(model,anchor){
  const actual=summary(model,'week',anchor),reserve=weeklyReserve(model,anchor);
  const expenses=actual.rows.filter(row=>row.frequency!=='month').reduce((sum,row)=>sum+row.amount,0);
  return {...actual,reserve:reserve.weekly,total:expenses+reserve.weekly,balance:actual.income-expenses-reserve.weekly};
 }
 const api={validate,occurrences,period,income,summary,addDays,addMonths,weeklyReserve,weeklyPlan};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.PersonalFinance=api;
})(typeof window==='object'?window:globalThis);
