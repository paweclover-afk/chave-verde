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
const M=require('../daybyday/platform-model.js');
test('conversão preserva rotina, financeiro e registros anteriores',()=>{
 const day='2026-11-19',days={
 [day]:{items:[{id:'old',name:'Trabalho',details:'Meu registro',time:'10:00',category:'work',done:true}],wellness:{training:[],meals:[],mobility:[],water:2,notes:'Minha nota'}},
 '2000-01-01':{finance:{debts:[],expenses:[]}},
 '2026-11-01':{monthly:Array(12).fill(true)}
 };
 const snapshot=structuredClone(days),state=M.toState(Object.entries(days).map(([day,payload])=>({day,payload})));
 assert.deepEqual(M.collect({state,sessions:state.sessions},days),snapshot);
 state.water[day]=3;const saved=M.collect({state,sessions:state.sessions},days);
 assert.deepEqual(saved[day].items,snapshot[day].items);assert.deepEqual(saved[day].wellness,snapshot[day].wellness);assert.equal(saved[day].platform.water,3);assert.deepEqual(days,snapshot);
});
test('plano inicial vazio, configuração isolada e séries na data correta',()=>{
 assert.deepEqual(M.emptyPlan(),{workouts:[],mobility:[],meals:[],guide:{}});
 assert.doesNotThrow(()=>validateDay(M.configDay,{userPlan:M.emptyPlan()}));
 assert.throws(()=>validateDay('2026-11-19',{userPlan:M.emptyPlan()}));
 const p=M.daily();p.sessions=[{date:'2026-11-18',exercise:'my-exercise',variant:'Máquina',basis:'kg',notes:'',rows:[{kg:20,reps:10}]}];
 assert.throws(()=>validateDay('2026-11-19',{platform:p}));
 p.sessions[0].date='2026-11-19';assert.doesNotThrow(()=>validateDay('2026-11-19',{platform:p}));
});
