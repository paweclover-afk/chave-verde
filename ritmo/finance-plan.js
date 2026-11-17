'use strict';
(function(root){
 const key=d=>d.toISOString().slice(0,10);
 function monthDate(month,day){const [y,m]=month.split('-').map(Number);return key(new Date(Date.UTC(y,m-1,Math.min(day,new Date(Date.UTC(y,m,0)).getUTCDate()))));}
 function nextMonth(month,offset){const [y,m]=month.split('-').map(Number);return key(new Date(Date.UTC(y,m-1+offset,1))).slice(0,7);}
 function validate(finance){
  for(const field of ['accounts','cards','purchases','billPayments'])if(finance[field]!==undefined&&(!Array.isArray(finance[field])||finance[field].length>500))throw Error('Limite financeiro excedido.');
  const ids=new Set();
  const id=x=>{if(!x||typeof x.id!=='string'||x.id.length>100||ids.has(x.id))throw Error('Identificador financeiro inválido.');ids.add(x.id);};
  const amount=n=>Number.isSafeInteger(n)&&n>0&&n<=99999999999;
  const date=d=>typeof d==='string'&&/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d)&&!isNaN(Date.parse(d))&&key(new Date(d+'T12:00:00Z'))===d;
  const name=n=>typeof n==='string'&&n.trim().length>0&&n.length<=160;
  const currency=c=>['GBP','EUR','BRL'].includes(c);
  for(const a of finance.accounts||[]){id(a);if(!name(a.name)||!amount(a.amount)||!currency(a.currency)||!date(a.start)||!['week','month','once'].includes(a.frequency))throw Error('Conta inválida.');}
  for(const c of finance.cards||[]){id(c);if(!name(c.name)||!currency(c.currency)||![c.closing,c.due].every(n=>Number.isInteger(n)&&n>=1&&n<=31))throw Error('Cartão inválido.');}
  for(const p of finance.purchases||[]){id(p);if(!(finance.cards||[]).some(c=>c.id===p.card)||!name(p.name)||!amount(p.amount)||!date(p.date)||!Number.isInteger(p.installments)||p.installments<1||p.installments>120)throw Error('Compra inválida.');}
  for(const p of finance.billPayments||[]){id(p);if(typeof p.ref!=='string'||p.ref.length>200||!date(p.date)||!amount(p.amount))throw Error('Pagamento inválido.');}
 }
 function occurrences(finance,month){
  const end=monthDate(month,31),rows=[];
  for(const a of finance.accounts||[]){
   let day=a.start,index=0;
   while(day<=end){
    rows.push({ref:a.id+'@'+day,source:a,id:a.id,name:a.name,day,amount:a.amount,currency:a.currency,frequency:a.frequency,kind:'account'});
    if(a.frequency==='once')break;
    index++;
    if(a.frequency==='month')day=monthDate(nextMonth(a.start.slice(0,7),index),Number(a.start.slice(8)));
    else{const d=new Date(a.start+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+index*7);day=key(d);}
   }
  }
  for(const card of finance.cards||[]){
   const invoices=new Map();
   for(const p of (finance.purchases||[]).filter(p=>p.card===card.id)){
    let closingMonth=p.date.slice(0,7);
    if(p.date>monthDate(closingMonth,card.closing))closingMonth=nextMonth(closingMonth,1);
    let dueMonth=card.due<=card.closing?nextMonth(closingMonth,1):closingMonth;
    for(let i=0;i<p.installments;i++){
     const day=monthDate(nextMonth(dueMonth,i),card.due);
     if(day>end)continue;
     const value=Math.floor(p.amount/p.installments)+(i<p.amount%p.installments?1:0);
     const item=invoices.get(day)||{ref:card.id+'@'+day,source:card,id:card.id,name:'Fatura '+card.name,day,amount:0,currency:card.currency,frequency:'month',kind:'card'};
     item.amount+=value;invoices.set(day,item);
    }
   }
   rows.push(...invoices.values());
  }
  return rows.map(r=>{const paid=(finance.billPayments||[]).filter(p=>p.ref===r.ref).reduce((s,p)=>s+p.amount,0);return {...r,paid,balance:Math.max(0,r.amount-paid)};}).filter(r=>r.day.startsWith(month)||r.balance>0).sort((a,b)=>a.day.localeCompare(b.day)||a.ref.localeCompare(b.ref));
 }
 const api={validate,occurrences,monthDate,nextMonth};
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FinancePlan=api;
})(typeof window==='object'?window:globalThis);
