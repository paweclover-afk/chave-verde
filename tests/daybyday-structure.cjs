const {test}=require('node:test'),assert=require('node:assert/strict');
const T=require('../daybyday/tracker.js');
const {validateDay}=require('../lib/daybyday.cjs');
const empty=()=>({training:[],meals:[],mobility:[],notes:'',water:0});
test('registros antigos e checklists permanecem válidos sem novos campos',()=>{
 const old={items:[{id:'a',name:'Estudar',details:'Livro',time:'10:00',category:'study',done:true}],monthly:Array(12).fill(false)};
 assert.equal(validateDay('2026-11-01',old),old);
 const snapshot=structuredClone(old);T.validateDaybyday({...old,wellness:empty()});assert.deepEqual(old,snapshot);
});
test('séries e áreas vazias são aceitas sem plano da Leonarda',()=>{
 const wellness=empty();wellness.training.push({id:'test',name:'Meu exercício',details:'Meu equipamento',done:true,sets:[{kg:12.5,reps:10}]});
 assert.doesNotThrow(()=>validateDay('2026-11-19',{wellness}));
 for(const field of ['NaN','negative','reps']){const bad=structuredClone(wellness);if(field==='NaN')bad.training[0].sets[0].kg=NaN;if(field==='negative')bad.training[0].sets[0].kg=-1;if(field==='reps')bad.training[0].sets[0].reps=0;assert.throws(()=>T.validateDaybyday({wellness:bad}));}
});
test('estrutura rejeita campos inesperados e dados fora dos limites',()=>{
 assert.throws(()=>T.validateDaybyday({wellness:{...empty(),foodPlan:{}}}));
 assert.throws(()=>T.validateDaybyday({wellness:{...empty(),water:1001}}));
 assert.throws(()=>T.validateDaybyday({wellness:{...empty(),notes:'a'.repeat(2001)}}));
});
