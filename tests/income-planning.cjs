const {test}=require('node:test'),assert=require('node:assert/strict');
for(const app of ['ritmo','daybyday']){
 const P=require('../'+app+'/personal-finance.js');
 test(app+': 400/semana permanece 400 semanal e planeja 1600 mensal',()=>{
  const model={income:{amount:40000,frequency:'week'},entries:[],categories:[],alerts:[]};
  for(const date of ['2026-11-01','2026-12-01','2027-01-01']){
   assert.equal(P.summary(model,'month',date).income,160000);
   assert.equal(P.summary(model,'week',date).income,40000);
  }
  assert.equal(P.income({amount:160000,frequency:'month'},'week'),40000);
  assert.deepEqual(model.income,{amount:40000,frequency:'week'});
 });
 test(app+': base de renda de quatro semanas não oculta a quinta cobrança do mês',()=>{
  const m={income:{amount:40000,frequency:'week'},entries:[{id:'a',name:'Conta',amount:10000,start:'2027-01-01',frequency:'week',interval:1,count:5,overrides:{}}]};
  const january=P.summary(m,'month','2027-01-01');
  assert.equal(january.total,50000);assert.equal(january.income,160000);assert.equal(january.balance,110000);
 });
}
