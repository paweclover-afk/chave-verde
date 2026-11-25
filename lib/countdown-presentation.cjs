'use strict';
const crypto=require('node:crypto');
const welcome='Bom dia! Que bom te ver por aqui. 💗\n\nFico feliz que você veio organizar seu dia e cuidar de você. Confira suas atividades, escolha por onde começar e siga no seu ritmo. Cada pequeno passo conta!';
function period(now=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
 const date=new Date(Date.UTC(+parts.year,+parts.month-1,+parts.day-(+parts.hour<4?1:0))).toISOString().slice(0,10);
 return {date,slot:date==='2026-11-25'?(+parts.hour>=18||+parts.hour<4?'evening':'day'):'daily'};
}
async function handleCountdown(req,res,db,userId){
 if(req.method!=='POST')return res.status(405).json({error:'Use POST.'});
 if(!/^[0-9a-f-]{36}$/i.test(req.body?.event||''))return res.status(400).json({error:'Solicitação inválida.'});
 const current=period();
 for(let attempt=0;attempt<4;attempt++){
  const row=await db.from('ritmo_days').select('payload,revision').eq('user_id',userId).eq('day','2026-10-29').maybeSingle();if(row.error)throw Error('database');
  const message=row.data?.payload?.foodPlan?.message;if(!message?.paused)return res.json({show:false});
  const receipt=message.countdownPresentation;
  if(req.query?.action==='ack-countdown-presentation'){
   const key=req.body.key,slot=typeof key==='string'&&key.startsWith(receipt?.date+'|')?key.split('|')[1]:null;
   if(!slot||!receipt?.slots?.includes(slot))return res.status(409).json({error:'A mensagem mudou. Atualize o app.'});
   if(receipt.acknowledgedSlots?.includes(slot))return res.json({ok:true});
   const payload=structuredClone(row.data.payload);payload.foodPlan.message.countdownPresentation.acknowledgedSlots=[...(receipt.acknowledgedSlots||[]),slot];
   const saved=await db.rpc('ritmo_save_day',{p_user:userId,p_day:'2026-10-29',p_expected:row.data.revision,p_payload:payload,p_event:crypto.randomUUID()});if(saved.error)throw Error('database');if(saved.data.conflict)continue;
   return res.json({ok:true});
  }
  const requiresAck=current.date>='2026-11-26',presentationKey=current.date+'|'+current.slot;
  if(receipt?.date===current.date&&(receipt.slots||[]).includes(current.slot))return res.json(requiresAck&&!receipt.acknowledgedSlots?.includes(current.slot)?{show:true,text:welcome,requiresAck:true,presentationKey}:{show:false});
  const payload=structuredClone(row.data.payload);
  payload.foodPlan.message.countdownPresentation={date:current.date,slots:[...(receipt?.date===current.date?receipt.slots:[]),current.slot],acknowledgedSlots:receipt?.date===current.date?receipt.acknowledgedSlots||[]:[]};
  const saved=await db.rpc('ritmo_save_day',{p_user:userId,p_day:'2026-10-29',p_expected:row.data.revision,p_payload:payload,p_event:crypto.randomUUID()});if(saved.error)throw Error('database');if(saved.data.conflict)continue;
  const notice=current.date==='2026-11-25'?message.schedule?.find(m=>m.date===current.date&&m.id==='routine-update-2026-11-25'):null;
  return res.json({show:true,text:notice?.text||(requiresAck?welcome:null),...(requiresAck?{requiresAck:true,presentationKey}:{})});
 }
 return res.status(409).json({error:'Outro acesso atualizou o registro. Tente novamente.'});
}
module.exports={period,handleCountdown,welcome};
