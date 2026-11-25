(function(root){
 'use strict';
 function sorted(items,order=[]){const ranks=new Map(order.map((id,i)=>[id,i]));return [...items].sort((a,b)=>(ranks.get(a.id)??Infinity)-(ranks.get(b.id)??Infinity)||a.time.localeCompare(b.time));}
 function move(ids,id,target){const next=ids.filter(x=>x!==id),at=next.indexOf(target);if(!ids.includes(id)||at<0)return [...ids];next.splice(at,0,id);return next;}
 function bind(list,onSave){
  const rows=()=>Array.from(list.children).filter(r=>r.dataset.routineId),ids=()=>rows().map(r=>r.dataset.routineId);
  for(const row of rows()){
   const handle=document.createElement('button');handle.type='button';handle.className='routine-drag';handle.textContent='⠿';handle.setAttribute('aria-label','Reordenar '+row.dataset.routineName);handle.title='Segure e arraste. No teclado, use as setas para cima e para baixo.';row.prepend(handle);
   handle.onkeydown=e=>{if(!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const all=rows(),at=all.indexOf(row),target=all[at+(e.key==='ArrowUp'?-1:1)];if(!target)return;list.insertBefore(row,e.key==='ArrowUp'?target:target.nextSibling);const order=ids();onSave(order,row.dataset.routineId);};
   handle.onpointerdown=e=>{
    if(e.button!==0||!e.isPrimary)return;e.preventDefault();const before=ids(),pointer=e.pointerId,startY=e.clientY;let active=false,y=e.clientY,frame,timer;
    handle.setPointerCapture(pointer);root.ritmoReordering=true;
    const tick=()=>{if(!active)return;const rect=list.getBoundingClientRect(),bottom=Math.min(innerHeight-80,rect.bottom),top=Math.max(80,rect.top);if(y<top+65)window.scrollBy(0,-10);else if(y>bottom-65)window.scrollBy(0,10);place();frame=requestAnimationFrame(tick);};
    const place=()=>{const others=rows().filter(r=>r!==row),target=others.find(r=>{const b=r.getBoundingClientRect();return y<b.top+b.height/2;});if(row.nextElementSibling!==(target||null)){list.insertBefore(row,target||null);handle.setPointerCapture(pointer);}};
    const end=(commit)=>{clearTimeout(timer);cancelAnimationFrame(frame);root.ritmoReordering=false;handle.onpointermove=handle.onpointerup=handle.onpointercancel=handle.onlostpointercapture=null;if(handle.hasPointerCapture(pointer))handle.releasePointerCapture(pointer);row.classList.remove('routine-dragging');if(!commit){for(const id of before){const r=rows().find(r=>r.dataset.routineId===id);if(r)list.append(r);}}if(active&&commit&&ids().join('|')!==before.join('|'))onSave(ids(),row.dataset.routineId);active=false;};
    timer=setTimeout(()=>{active=true;row.classList.add('routine-dragging');handle.setAttribute('aria-pressed','true');frame=requestAnimationFrame(tick);},220);
    handle.onpointermove=event=>{y=event.clientY;if(!active&&Math.abs(y-startY)>10){end(false);return;}if(active){event.preventDefault();place();}};
    handle.onpointerup=()=>{handle.removeAttribute('aria-pressed');end(true);};handle.onpointercancel=handle.onlostpointercapture=()=>{handle.removeAttribute('aria-pressed');end(false);};
   };
  }
 }
 const api={sorted,move,bind};if(typeof module==='object'&&module.exports)module.exports=api;else root.RitmoRoutineOrder=api;
})(typeof window==='object'?window:globalThis);
