'use strict';
(function(root){
 const key=d=>d.toISOString().slice(0,10);
 function monthDate(month,day){const [y,m]=month.split('-').map(Number);return key(new Date(Date.UTC(y,m-1,Math.min(day,new Date(Date.UTC(y,m,0)).getUTCDate()))));}
 function nextMonth(month,offset){const [y,m]=month.split('-').map(Number);return key(new Date(Date.UTC(y,m-1+offset,1))).slice(0,7);}
 function validate(finance){
  for(const field of ['accounts','cards','purchases','billPayments','spending','salary'])if(finance[field]!==undefined&&(!Array.isArray(finance[field])||finance[field].length>500))throw Error('Limite financeiro excedido.');
  const ids=new Set();
  const id=x=>{if(!x||typeof x.id!=='string'||x.id.length>100||ids.has(x.id))throw Error('Identificador financeiro inválido.');ids.add(x.id);};
  const amount=n=>Number.isSafeInteger(n)&&n>0&&n<=99999999999;
  const date=d=>typeof d==='string'&&/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d)&&!isNaN(Date.parse(d))&&key(new Date(d+'T12:00:00Z'))===d;
  const name=n=>typeof n==='string'&&n.trim().length>0&&n.length<=160;
  const currency=c=>['GBP','EUR','BRL'].includes(c);
  for(const income of finance.salary||[]){id(income);if(!amount(income.amount)||!currency(income.currency)||!date(income.from)||!['week','month'].includes(income.frequency))throw Error('Renda inválida.');}
  for(const purchase of finance.spending||[]){
    id(purchase);
    if(!name(purchase.name)||!amount(purchase.amount)||!currency(purchase.currency)||!date(purchase.date)||!['week','month','once'].includes(purchase.frequency)||!Number.isInteger(purchase.installments)||purchase.installments<1||purchase.installments>1200||purchase.amount<purchase.installments||typeof purchase.category!=='string'||purchase.category.length>100||!['card','pix','cash','debit','other'].includes(purchase.method))throw Error('Gasto inválido.');
  }
  for(const a of finance.accounts||[]){id(a);if(!name(a.name)||!amount(a.amount)||!currency(a.currency)||!date(a.start)||!['week','month','once'].includes(a.frequency)||a.installments!==undefined&&(!Number.isInteger(a.installments)||a.installments<1||a.installments>1200))throw Error('Conta inválida.');}
  for(const c of finance.cards||[]){id(c);if(!name(c.name)||!currency(c.currency)||![c.closing,c.due].every(n=>Number.isInteger(n)&&n>=1&&n<=31))throw Error('Cartão inválido.');}
  for(const p of finance.purchases||[]){id(p);if(!(finance.cards||[]).some(c=>c.id===p.card)||!name(p.name)||!amount(p.amount)||!date(p.date)||!Number.isInteger(p.installments)||p.installments<1||p.installments>120)throw Error('Compra inválida.');}
  for(const p of finance.billPayments||[]){id(p);if(typeof p.ref!=='string'||p.ref.length>200||!date(p.date)||!amount(p.amount))throw Error('Pagamento inválido.');}
 }
 function occurrences(finance,month){
  const end=monthDate(month,31),rows=[];
  for(const a of finance.accounts||[]){
   let day=a.start,index=0;
   while(day<=end&&(a.installments===undefined||index<a.installments)){
    rows.push({ref:a.id+'@'+day,source:a,id:a.id,name:a.name,day,amount:a.amount,currency:a.currency,frequency:a.frequency,installment:index+1,totalInstallments:a.installments,kind:'account'});
    if(a.frequency==='once')break;
    index++;
    if(a.frequency==='month')day=monthDate(nextMonth(a.start.slice(0,7),index),Number(a.start.slice(8)));
    else{const d=new Date(a.start+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+index*7);day=key(d);}
   }
  }
  for(const purchase of finance.spending||[]){
    const installments=purchase.frequency==='once'?1:purchase.installments;
    for(let i=0;i<installments;i++){
      let day=purchase.date;
      if(purchase.frequency==='month')day=monthDate(nextMonth(purchase.date.slice(0,7),i),Number(purchase.date.slice(8)));
      if(purchase.frequency==='week'){const d=new Date(purchase.date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+i*7);day=key(d);}
      if(day>end)break;
      const amount=Math.floor(purchase.amount/installments)+(i<purchase.amount%installments?1:0);
      const ref=purchase.id+'@'+day;
      const paid=(finance.billPayments||[]).filter(p=>p.ref===ref).reduce((sum,p)=>sum+p.amount,0);
      rows.push({ref,id:purchase.id,source:purchase,name:purchase.name,day,amount,currency:purchase.currency,frequency:purchase.frequency,installment:i+1,totalInstallments:installments,kind:'spending',initialPaid:purchase.frequency==='once'?amount:0});
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
  return rows.map(r=>{const paid=(r.initialPaid||0)+(finance.billPayments||[]).filter(p=>p.ref===r.ref).reduce((s,p)=>s+p.amount,0);return {...r,paid,balance:Math.max(0,r.amount-paid)};}).filter(r=>r.day.startsWith(month)||r.balance>0).sort((a,b)=>a.day.localeCompare(b.day)||a.ref.localeCompare(b.ref));
 }
 function incomeTotal(finance,month,legacy){
  const result={};
  for(const currency of ['GBP','EUR','BRL']){
    const relevant=(finance.salary||[]).filter(r=>r.currency===currency).sort((a,b)=>a.from.localeCompare(b.from));
    const rate=relevant.filter(r=>r.from<=monthDate(month,31)).at(-1);
    if(!rate){result[currency]=legacy(currency);continue;}
    if(rate.frequency==='month'){result[currency]=rate.amount;continue;}
    let total=0;
    for(let day=month+'-01';day<=monthDate(month,31);){
      if(new Date(day+'T12:00:00Z').getUTCDay()===5){
        const current=relevant.filter(r=>r.from<=day).at(-1);
        if(current?.frequency==='week')total+=current.amount;
      }
      const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);day=key(d);
    }
    result[currency]=total;
  }
  return result;
 }
 const api={validate,occurrences,monthDate,nextMonth,incomeTotal};
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FinancePlan=api;
})(typeof window==='object'?window:globalThis);
