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
  if(days===2)return 'Dois dias seguidos completando todas as tarefas! Sua constância está crescendo. Continue valorizando cada passo dessa evolução. 💖';
  if(days===3)return 'Três dias seguidos dando o seu melhor! Você está transformando atitude em hábito. Tenha orgulho de tudo o que está construindo. 🌟';
  if(days>=7)return days+' dias seguidos com todas as tarefas concluídas! Cada dia conta nessa conquista. Sua dedicação merece ser celebrada! 🏆';
  if(days>3)return days+' dias seguidos cumprindo suas tarefas! Sua dedicação está fazendo a diferença. Siga no seu ritmo, um dia de cada vez. ✨';
  return 'Você fez acontecer, uma tarefa de cada vez. Tenha orgulho do seu esforço e aproveite essa conquista! Amanhã é uma nova oportunidade de cuidar de você. 💖';
 }
 const api={complete,streak,message};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.RitmoCompletion=api;
})(typeof window==='object'?window:globalThis);
