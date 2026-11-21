'use strict';
const crypto=require('node:crypto'),Core=require('../js/plan-import-core.js'),Model=require('../daybyday/platform-model.js');
const dietKeys=['format','prescribed','meals','groups'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const defaults=()=>({agenda:[],water:0,mobility:Array(6).fill(false),mealchoices:[0,3,5,6],selection:'off',sessions:[],notes:'',trainingTime:'19:30'});
function validateTraining(value){
 if(value?.guide!==undefined&&(typeof value.guide!=='string'||value.guide.length>2000))throw Error('Guia do treino inválido.');
 if(!value||!Array.isArray(value.activeIds)||value.activeIds.length>10||value.activeIds.some(id=>typeof id!=='string')||new Set(value.activeIds).size!==value.activeIds.length)throw Error('Plano de treino importado inválido.');
 Model.validatePlan({...Model.emptyPlan(),workouts:value.workouts});
 if(value.activeIds.some(id=>!value.workouts.some(w=>w.id===id)))throw Error('Treino ativo não encontrado.');
}
async function handleImport(req,res,db,userId,app){
 const undo=req.query.action==='undo-plan-import',kind=undo?req.body?.kind:req.body?.draft?.kind;
 const {event,expectedRevision}=req.body||{};
 if(req.method!=='POST'||!uuid.test(event||'')||!Number.isSafeInteger(expectedRevision)||expectedRevision<0||!['diet','training'].includes(kind))return res.status(400).json({error:'Solicitação de importação inválida.'});
 if(!undo)try{Core.validate(req.body.draft,app);}catch(e){return res.status(400).json({error:e.message});}
 const table=app==='ritmo'?'ritmo_days':'daybyday_days',day=app==='ritmo'&&kind==='diet'?'2026-10-29':'2000-01-03';
 const result=await db.from(table).select('payload,revision').eq('user_id',userId).eq('day',day).maybeSingle();
 if(result.error)throw Error('database');
 const row=result.data||{revision:0,payload:app==='ritmo'?defaults():{}},payload=structuredClone(row.payload);
 if(payload.importReceipt?.event===event)return res.json({ok:true,duplicate:true,revision:row.revision});
 if(row.revision!==expectedRevision)return res.status(409).json({error:'O plano foi atualizado em outro acesso. Feche a prévia e importe novamente para conferir a versão atual.'});
 let previous;
 if(undo){
  const revision=payload.importMeta?.[kind]?.beforeRevision;
  if(!Number.isSafeInteger(revision))return res.status(400).json({error:'Não há importação anterior para desfazer.'});
  if(revision===0)previous=app==='ritmo'?defaults():{};
  else{const old=await db.from(app==='ritmo'?'ritmo_changes':'daybyday_changes').select('payload').eq('user_id',userId).eq('day',day).eq('revision',revision).maybeSingle();if(old.error)throw Error('database');if(!old.data)return res.status(409).json({error:'A versão anterior não está disponível. Seu plano atual foi mantido.'});previous=old.data.payload;}
 }
 if(kind==='diet'){
  if(app==='ritmo'){
   if(undo){if(!previous.foodPlan)return res.status(400).json({error:'Não há dieta anterior para restaurar.'});for(const key of dietKeys){if(previous.foodPlan[key]===undefined)delete payload.foodPlan[key];else payload.foodPlan[key]=structuredClone(previous.foodPlan[key]);}}
   else payload.foodPlan=Core.dietFields(req.body.draft,{...(payload.foodPlan||{}),effective:'2026-10-29'});
  }else{
   payload.userPlan=structuredClone(payload.userPlan||Model.emptyPlan());
   if(undo){payload.userPlan.meals=structuredClone(previous.userPlan?.meals||[]);payload.userPlan.foodNotes=previous.userPlan?.foodNotes||'';}
   else{
    const diet=Core.dietFields(req.body.draft);payload.userPlan.meals=diet.groups.map(g=>({title:g.title,time:g.time,ingredients:g.options.map((o,i)=>'Opção '+(i+1)+' — escolha apenas uma:\n'+diet.meals[o.index].ingredients).join('\n\n'),substitutions:g.options.flatMap((o,i)=>diet.meals[o.index].substitutions.map(s=>'Opção '+(i+1)+': '+s))}));
    payload.userPlan.foodNotes='Plano importado'+(req.body.draft.prescribed?' · '+req.body.draft.prescribed:'')+'. Horários confirmados na prévia.';
   }
  }
 }else if(app==='ritmo'){
  const all=payload.importedTraining?.workouts||[];
  if(undo){const prior=previous.importedTraining||{workouts:[],activeIds:[]};payload.importedTraining={workouts:[...prior.workouts,...all.filter(w=>!prior.workouts.some(p=>p.id===w.id))],activeIds:prior.activeIds,guide:prior.guide||''};}
  else{const prefix='pdf-'+crypto.createHash('sha256').update(JSON.stringify(req.body.draft.workouts)).digest('hex').slice(0,20),workouts=Core.trainingFields(req.body.draft,prefix);payload.importedTraining={workouts:[...workouts,...all.filter(w=>!workouts.some(p=>p.id===w.id))],activeIds:workouts.map(w=>w.id),guide:req.body.draft.guide||''};}
  try{validateTraining(payload.importedTraining);}catch(e){return res.status(400).json({error:e.message+' Exporte seu histórico antes de adicionar mais versões.'});}
 }else{
  payload.userPlan=structuredClone(payload.userPlan||Model.emptyPlan());
  const existing=payload.userPlan.workouts;
  const workouts=undo?structuredClone(previous.userPlan?.workouts||[]):Core.trainingFields(req.body.draft,'pdf-'+crypto.createHash('sha256').update(JSON.stringify(req.body.draft.workouts)).digest('hex').slice(0,20));
  payload.userPlan.workouts=[...workouts,...existing.filter(w=>!workouts.some(p=>p.id===w.id)).map(w=>({...w,day:-1,title:w.title.startsWith('Histórico · ')?w.title:('Histórico · '+w.title).slice(0,160)}))];
  if(undo){if(previous.userPlan?.guide?.['Plano importado'])payload.userPlan.guide['Plano importado']=previous.userPlan.guide['Plano importado'];else delete payload.userPlan.guide['Plano importado'];}
  else payload.userPlan.guide['Plano importado']=req.body.draft.guide||'Confira as orientações no documento original.';
 }
 if(app==='daybyday')try{Model.validatePlan(payload.userPlan);}catch(e){return res.status(400).json({error:e.message+' A versão atual foi mantida.'});}
 payload.importMeta={...(payload.importMeta||{})};
 if(undo){if(previous.importMeta?.[kind])payload.importMeta[kind]=previous.importMeta[kind];else delete payload.importMeta[kind];}
 else payload.importMeta[kind]={event,beforeRevision:row.revision};
 payload.importReceipt={event};
 if(Buffer.byteLength(JSON.stringify(payload))>140000)return res.status(400).json({error:'O histórico de versões atingiu o limite. Baixe seu backup antes de importar outro plano.'});
 const saved=await db.rpc(app==='ritmo'?'ritmo_save_day':'daybyday_save_day',{p_user:userId,p_day:day,p_expected:row.revision,p_payload:payload,p_event:event});
 if(saved.error)throw Error('database');
 if(saved.data.conflict)return res.status(409).json({error:'Outro aparelho atualizou o plano durante a confirmação. Importe novamente para conferir as alterações.'});
 return res.json({ok:true,revision:saved.data.revision});
}
module.exports={handleImport,validateTraining};
