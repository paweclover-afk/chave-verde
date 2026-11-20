(function(root){
 'use strict';
 const complete=items=>Array.isArray(items)&&items.length>0&&items.every(item=>item.done===true);
 function streak(days,day){
  let count=0,date=new Date(day+'T12:00:00Z');
  while(complete(days[date.toISOString().slice(0,10)]?.items)){
   count++;date.setUTCDate(date.getUTCDate()-1);
  }
  return count;
 }
 function message(days){
  if(days===2)return 'Dois dias seguidos! Sua constância faz a diferença. Continue assim! 💖';
  if(days===3)return 'Três dias seguidos! Você está transformando atitude em hábito. Orgulhe-se! 🌟';
  if(days>=7)return days+' dias seguidos! Sua dedicação merece essa comemoração. Que conquista! 🏆';
  if(days>3)return days+' dias seguidos! Você está evoluindo. Siga no seu ritmo, um dia de cada vez. ✨';
  return 'Você fez acontecer! Tenha orgulho do seu esforço e celebre essa conquista. 💖';
 }
 const api={complete,streak,message};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.RitmoCompletion=api;
})(typeof window==='object'?window:globalThis);
