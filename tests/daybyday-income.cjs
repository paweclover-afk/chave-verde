const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../daybyday/personal-finance.js');
test('renda de 400 semanal vira 1600 mensal na base de quatro semanas',()=>{
 const income={amount:40000,frequency:'week'};assert.equal(P.income(income,'week'),40000);assert.equal(P.income(income,'month'),160000);
 const model={income,entries:[],categories:[],alerts:[]};for(const month of ['2026-11-20','2026-12-01','2027-02-01']){const summary=P.summary(model,'month',month);assert.equal(summary.income,160000);assert.equal(summary.balance,160000);}assert.equal(P.weeklyPlan(model,'2026-11-20').income,40000);assert.deepEqual(income,{amount:40000,frequency:'week'});
});
test('renda mensal mantém seu valor e equivalente semanal divide por quatro',()=>{
 assert.equal(P.income({amount:160000,frequency:'month'},'month'),160000);assert.equal(P.income({amount:160000,frequency:'month'},'week'),40000);assert.equal(P.income(null,'month'),0);
});
