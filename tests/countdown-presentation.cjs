const {test}=require('node:test'),assert=require('node:assert/strict');
const {period,handleCountdown,welcome}=require('../lib/countdown-presentation.cjs');
test('contagem diária renova às 4h de Londres e exceção tem turno noturno',()=>{
 assert.deepEqual(period(new Date('2026-11-25T12:00:00Z')),{date:'2026-11-25',slot:'day'});
 assert.deepEqual(period(new Date('2026-11-25T18:00:00Z')),{date:'2026-11-25',slot:'evening'});
 assert.deepEqual(period(new Date('2026-11-26T03:59:59Z')),{date:'2026-11-25',slot:'evening'});
 assert.deepEqual(period(new Date('2026-11-26T04:00:00Z')),{date:'2026-11-26',slot:'daily'});
 assert.equal(period(new Date('2027-07-01T02:59:59Z')).date,'2027-06-30');
 assert.equal(period(new Date('2027-07-01T03:00:00Z')).date,'2027-07-01');
});
test('limite é compartilhado entre aparelhos e permite só uma apresentação por turno',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-25T12:00:00Z')});
 let row={revision:1,payload:{foodPlan:{message:{paused:true,schedule:[{id:'routine-update-2026-11-25',date:'2026-11-25',text:'Como usar'}],suspendedSchedule:[{text:'Preservada'}]}}}},writes=0;
 const db={from(){return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:structuredClone(row)};}};},async rpc(_,args){assert.equal(args.p_user,'owner');if(args.p_expected!==row.revision)return {data:{conflict:true}};writes++;row={revision:row.revision+1,payload:args.p_payload};return {data:{revision:row.revision}};}};
 async function call(){const res={status(n){this.code=n;return this;},json(body){this.body=body;return this;}};await handleCountdown({method:'POST',body:{event:'11111111-1111-4111-8111-111111111111'}},res,db,'owner');return res.body;}
 assert.deepEqual(await call(),{show:true,text:'Como usar'});assert.deepEqual(await call(),{show:false});
 t.mock.timers.tick(6*3600000);assert.deepEqual(await call(),{show:true,text:'Como usar'});assert.deepEqual(await call(),{show:false});
 t.mock.timers.tick(9*3600000);assert.deepEqual(await call(),{show:false});t.mock.timers.tick(3600000);assert.deepEqual(await call(),{show:true,text:welcome});assert.match(welcome,/Bom dia! Que bom te ver por aqui/);assert.deepEqual(await call(),{show:false});assert.equal(writes,3);assert.equal(row.payload.foodPlan.message.suspendedSchedule[0].text,'Preservada');
});
