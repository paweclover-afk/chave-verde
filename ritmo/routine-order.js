(function(root){
 'use strict';
 function sorted(items,order=[]){const ranks=new Map(order.map((id,i)=>[id,i]));return [...items].sort((a,b)=>(ranks.get(a.id)??Infinity)-(ranks.get(b.id)??Infinity)||a.time.localeCompare(b.time));}
 function move(ids,id,target){const next=ids.filter(x=>x!==id),at=next.indexOf(target);if(!ids.includes(id)||at<0)return [...ids];next.splice(at,0,id);return next;}
 function bind(list,onSave){
  const rows=()=>Array.from(list.children).filter(r=>r.dataset.routineId),ids=()=>rows().map(r=>r.dataset.routineId);
  for(const row of rows()){
   row.tabIndex=0;row.setAttribute('aria-label',row.dataset.routineName+'. Segure e arraste. No teclado, use as setas.');
   let suppressUntil=0;
   row.addEventListener('contextmenu',e=>e.preventDefault());row.addEventListener('dragstart',e=>e.preventDefault());
   row.addEventListener('click',e=>{if(Date.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
   row.onkeydown=e=>{if(e.target!==row||!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const all=rows(),at=all.indexOf(row),target=all[at+(e.key==='ArrowUp'?-1:1)];if(!target)return;list.insertBefore(row,e.key==='ArrowUp'?target:target.nextSibling);onSave(ids(),row.dataset.routineId);};
   function start(x,y,touch,pointer){
    if(root.ritmoReordering)return;root.ritmoReordering=true;
    const before=ids(),startX=x,startY=y,scrollX=root.scrollX,scrollY=root.scrollY;let active=false,ended=false,timer,oldBody,oldHtml;
    const place=()=>{const target=rows().filter(r=>r!==row).find(r=>{const b=r.getBoundingClientRect();return y<b.top+b.height/2;});if(row.nextElementSibling!==(target||null))list.insertBefore(row,target||null);};
    const end=commit=>{if(ended)return;ended=true;clearTimeout(timer);root.ritmoReordering=false;document.removeEventListener(touch?'touchmove':'pointermove',moving);document.removeEventListener(touch?'touchend':'pointerup',up);document.removeEventListener(touch?'touchcancel':'pointercancel',cancel);root.removeEventListener('blur',cancel);document.removeEventListener('visibilitychange',hidden);if(active){document.body.style.overflow=oldBody;document.documentElement.style.overflow=oldHtml;root.scrollTo(scrollX,scrollY);suppressUntil=Date.now()+700;}row.classList.remove('routine-dragging');if(!commit)for(const id of before){const r=rows().find(r=>r.dataset.routineId===id);if(r)list.append(r);}if(active&&commit&&ids().join('|')!==before.join('|'))onSave(ids(),row.dataset.routineId);};
    const moving=e=>{const p=touch?Array.from(e.touches).find(t=>t.identifier===pointer):e;if(!p||!touch&&p.pointerId!==pointer)return;x=p.clientX;y=p.clientY;if(!active&&Math.hypot(x-startX,y-startY)>10){end(false);return;}if(active){if(e.cancelable)e.preventDefault();place();}};
    const up=e=>{if(touch&&Array.from(e.touches).some(t=>t.identifier===pointer)||!touch&&e.pointerId!==pointer)return;end(true);};
    const cancel=()=>end(false),hidden=()=>{if(document.hidden)cancel();};
    document.addEventListener(touch?'touchmove':'pointermove',moving,{passive:false});document.addEventListener(touch?'touchend':'pointerup',up);document.addEventListener(touch?'touchcancel':'pointercancel',cancel);root.addEventListener('blur',cancel);document.addEventListener('visibilitychange',hidden);
    timer=setTimeout(()=>{if(!row.isConnected){end(false);return;}active=true;oldBody=document.body.style.overflow;oldHtml=document.documentElement.style.overflow;document.body.style.overflow='hidden';document.documentElement.style.overflow='hidden';row.classList.add('routine-dragging');root.navigator?.vibrate?.(25);},180);
   }
   const interactive=target=>target.closest('button,input,summary,details,a,select,textarea');
   row.addEventListener('touchstart',e=>{if(e.touches.length!==1||interactive(e.target))return;const t=e.touches[0];start(t.clientX,t.clientY,true,t.identifier);},{passive:true});
   row.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||e.button!==0||!e.isPrimary||interactive(e.target))return;e.preventDefault();start(e.clientX,e.clientY,false,e.pointerId);});
  }
 }
 const api={sorted,move,bind};if(typeof module==='object'&&module.exports)module.exports=api;else root.RitmoRoutineOrder=api;
})(typeof window==='object'?window:globalThis);